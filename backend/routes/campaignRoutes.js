// routes/campaignRoutes.js
const express = require('express');
module.exports = (dependencies) => {
const { getDb, authenticateToken, CampaignGoalCalculator } = dependencies;

const router = express.Router();

// Supported currencies
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'TRY'];
const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', CAD: 'C$', AUD: 'A$', JPY: '¥', TRY: '₺'
};

// Get all campaigns with pagination and filtering
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status, campaign_type, goal_type } = req.query;
    const offset = (page - 1) * parseInt(limit);
    
    let query = `
      SELECT 
        c.*,
        u.username as created_by_username,
        u.first_name as created_by_fname,
        u.last_name as created_by_lname,
        COUNT(DISTINCT cp.id) as participant_count,
        COUNT(DISTINCT CASE WHEN cp.status = 'active' THEN cp.id END) as active_participants,
        COUNT(DISTINCT CASE WHEN cp.status = 'completed' THEN cp.id END) as completed_participants
      FROM campaigns c
      LEFT JOIN users u ON c.created_by = u.id
      LEFT JOIN campaign_participants cp ON c.id = cp.campaign_id
      WHERE 1=1
    `;
    
    const params = [];
    const countParams = []; // Separate params array for count query
    
    // Build WHERE conditions for both queries
    let whereConditions = '';
    
    if (search && search.trim() !== '' && search !== 'null') {
      whereConditions += ' AND (c.name LIKE ? OR c.description LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
      countParams.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }
    
    if (status && status.trim() !== '' && status !== 'null') {
      whereConditions += ' AND c.status = ?';
      params.push(status);
      countParams.push(status);
    }
    
    if (campaign_type && campaign_type.trim() !== '' && campaign_type !== 'null') {
      whereConditions += ' AND c.campaign_type = ?';
      params.push(campaign_type);
      countParams.push(campaign_type);
    }
    
    if (goal_type && goal_type.trim() !== '' && goal_type !== 'null') {
      whereConditions += ' AND c.goal_type = ?';
      params.push(goal_type);
      countParams.push(goal_type);
    }
    
    // Add conditions to both queries
    query += whereConditions;
    query += ' GROUP BY c.id ORDER BY c.created_at DESC';
    
    // Build count query with same conditions
    const countQuery = `
      SELECT COUNT(DISTINCT c.id) as total
      FROM campaigns c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE 1=1${whereConditions}
    `;
    
    // Execute count query with correct parameters
    const db = await getDb();
    const [countResult] = await db.execute(countQuery, countParams);
    const total = countResult[0].total;
    
    // Add pagination to main query
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    const [campaigns] = await db.execute(query, params);
    
    // Calculate real-time progress for active campaigns
    for (const campaign of campaigns) {
      if (campaign.status === 'active' && campaign.goal_value > 0) {
        try {
          const progress = await CampaignGoalCalculator.calculateSingleCampaignProgress(campaign);
          campaign.current_value = progress.current_value;
          
          // Update in database for cache (optional - for performance)
          await db.execute(
            'UPDATE campaigns SET current_value = ? WHERE id = ?',
            [progress.current_value, campaign.id]
          );
        } catch (error) {
          console.error(`Error calculating progress for campaign ${campaign.id}:`, error);
          // Keep existing current_value if calculation fails
        }
      }
      
      // Add currency symbol for display
      if (campaign.goal_currency && CURRENCY_SYMBOLS[campaign.goal_currency]) {
        campaign.currency_symbol = CURRENCY_SYMBOLS[campaign.goal_currency];
      }
    }
    
    res.json({
      data: campaigns,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        total: total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/recalculate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    
    // Check if campaign exists
    const [campaigns] = await db.execute('SELECT * FROM campaigns WHERE id = ?', [id]);
    if (campaigns.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    const campaign = campaigns[0];
    
    // Calculate progress
    const progress = await CampaignGoalCalculator.calculateSingleCampaignProgress(campaign);
    
    // Update campaign
    await db.execute(
      'UPDATE campaigns SET current_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [progress.current_value, id]
    );
    
    // Log activity
    await db.execute(`
      INSERT INTO campaign_activities 
      (campaign_id, entity_type, entity_id, activity_type, activity_description, created_by)
      VALUES (?, 'campaign', ?, 'recalculated', 'Goal progress recalculated manually', ?)
    `, [id, id, req.user.id]);
    
    res.json({
      success: true,
      message: 'Campaign progress recalculated successfully',
      previous_value: campaign.current_value,
      new_value: progress.current_value,
      goal_value: campaign.goal_value,
      goal_currency: campaign.goal_currency,
      currency_symbol: campaign.goal_currency ? CURRENCY_SYMBOLS[campaign.goal_currency] : null,
      progress_percentage: campaign.goal_value > 0 ? Math.round((progress.current_value / campaign.goal_value) * 100) : 0
    });
    
  } catch (error) {
    console.error('Error recalculating campaign progress:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk recalculation endpoint for all active campaigns
router.post('/recalculate-all', authenticateToken, async (req, res) => {
  try {
    const result = await CampaignGoalCalculator.calculateCampaignProgress();
    
    res.json({
      success: true,
      message: `Successfully recalculated progress for ${result.updated} campaigns`,
      updated_campaigns: result.updated
    });
    
  } catch (error) {
    console.error('Error recalculating all campaigns:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single campaign with detailed information
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    
    // Get campaign details
    const [campaigns] = await db.execute(`
      SELECT 
        c.*,
        u.username as created_by_username,
        u.first_name as created_by_fname,
        u.last_name as created_by_lname
      FROM campaigns c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = ?
    `, [id]);
    
    if (campaigns.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    const campaign = campaigns[0];
    
    // Add currency symbol for display
    if (campaign.goal_currency && CURRENCY_SYMBOLS[campaign.goal_currency]) {
      campaign.currency_symbol = CURRENCY_SYMBOLS[campaign.goal_currency];
    }
    
    // Calculate real-time progress if campaign is active
    if (campaign.status === 'active' && campaign.goal_value > 0) {
      try {
        const progress = await CampaignGoalCalculator.calculateSingleCampaignProgress(campaign);
        campaign.current_value = progress.current_value;
        
        // Update in database
        await db.execute(
          'UPDATE campaigns SET current_value = ? WHERE id = ?',
          [progress.current_value, campaign.id]
        );
      } catch (error) {
        console.error(`Error calculating progress for campaign ${campaign.id}:`, error);
      }
    }
    
    // Get participants with their contributions
    const [participants] = await db.execute(`
      SELECT 
        cp.*,
        CASE 
          WHEN cp.entity_type = 'lead' THEN CONCAT(l.fname, ' ', l.lname)
          WHEN cp.entity_type = 'account' THEN a.name
        END as entity_name,
        CASE 
          WHEN cp.entity_type = 'lead' THEN l.email_address
          WHEN cp.entity_type = 'account' THEN a.contact_email
        END as entity_email,
        CASE 
          WHEN cp.entity_type = 'lead' THEN l.company_name
          WHEN cp.entity_type = 'account' THEN a.type
        END as entity_info
      FROM campaign_participants cp
      LEFT JOIN leads l ON cp.entity_type = 'lead' AND cp.entity_id = l.id
      LEFT JOIN accounts a ON cp.entity_type = 'account' AND cp.entity_id = a.id
      WHERE cp.campaign_id = ?
      ORDER BY cp.joined_at DESC
    `, [id]);
    
    // Get recent activities
    const [activities] = await db.execute(`
      SELECT 
        ca.*,
        CASE 
          WHEN ca.entity_type = 'lead' THEN CONCAT(l.fname, ' ', l.lname)
          WHEN ca.entity_type = 'account' THEN a.name
        END as entity_name,
        u.username as created_by_username
      FROM campaign_activities ca
      LEFT JOIN leads l ON ca.entity_type = 'lead' AND ca.entity_id = l.id
      LEFT JOIN accounts a ON ca.entity_type = 'account' AND ca.entity_id = a.id
      LEFT JOIN users u ON ca.created_by = u.id
      WHERE ca.campaign_id = ?
      ORDER BY ca.created_at DESC
      LIMIT 50
    `, [id]);
    
    res.json({
      ...campaign,
      participants,
      activities
    });
  } catch (error) {
    console.error('Error fetching campaign details:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new campaign
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      description,
      campaign_type,
      goal_type,
      goal_value,
      goal_currency,
      start_date,
      end_date,
      is_open_campaign = false,
      auto_join = true
    } = req.body;
    
    if (!name || !campaign_type || !goal_type) {
      return res.status(400).json({ 
        error: 'Name, campaign type, and goal type are required' 
      });
    }
    
    // Validate goal_type based on campaign_type
    const leadGoalTypes = ['conversion', 'new_added', 'status_change'];
    const accountGoalTypes = ['sales', 'revenue', 'meetings'];
    
    if (campaign_type === 'lead' && !leadGoalTypes.includes(goal_type)) {
      return res.status(400).json({ 
        error: 'Invalid goal type for lead campaign' 
      });
    }
    
    if (campaign_type === 'account' && !accountGoalTypes.includes(goal_type)) {
      return res.status(400).json({ 
        error: 'Invalid goal type for account campaign' 
      });
    }
    
    // Validate currency for sales campaigns
    if (goal_type === 'sales' && goal_currency && !SUPPORTED_CURRENCIES.includes(goal_currency)) {
      return res.status(400).json({ 
        error: 'Invalid currency. Supported currencies: ' + SUPPORTED_CURRENCIES.join(', ')
      });
    }
    
    // Require currency for sales campaigns with goal value
    if (goal_type === 'sales' && goal_value && goal_value > 0 && !goal_currency) {
      return res.status(400).json({ 
        error: 'Currency is required for sales campaigns with goal value'
      });
    }
    
    if (!is_open_campaign && (!start_date || !end_date)) {
      return res.status(400).json({ 
        error: 'Start and end dates are required for non-open campaigns' 
      });
    }
    
    const db = await getDb();
    const [result] = await db.execute(`
      INSERT INTO campaigns 
      (name, description, campaign_type, goal_type, goal_value, goal_currency, start_date, end_date, is_open_campaign, created_by, current_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, [
      name,
      description,
      campaign_type,
      goal_type,
      goal_value || 0,
      goal_type === 'sales' ? goal_currency : null,
      start_date,
      is_open_campaign ? null : end_date,
      is_open_campaign,
      auto_join,
      req.user.id
    ]);
    
    const campaignId = result.insertId;
    
    // Log creation activity
    await db.execute(`
      INSERT INTO campaign_activities 
      (campaign_id, entity_type, entity_id, activity_type, activity_description, created_by)
      VALUES (?, 'campaign', ?, 'created', 'Campaign created', ?)
    `, [campaignId, campaignId, req.user.id]);
    
    res.status(201).json({ 
      success: true, 
      id: campaignId,
      message: 'Campaign created successfully' 
    });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update campaign
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      goal_type,
      goal_value,
      goal_currency,
      start_date,
      end_date,
      is_open_campaign,
      status,
      auto_join
    } = req.body;
    
    const db = await getDb();
    
    // Check if campaign exists and get current values
    const [existing] = await db.execute('SELECT * FROM campaigns WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    const oldCampaign = existing[0];
    const updateFields = [];
    const updateValues = [];
    let needsRecalculation = false;
    
    // Validate currency for sales campaigns
    if (goal_type === 'sales' && goal_currency && !SUPPORTED_CURRENCIES.includes(goal_currency)) {
      return res.status(400).json({ 
        error: 'Invalid currency. Supported currencies: ' + SUPPORTED_CURRENCIES.join(', ')
      });
    }
    
    // Require currency for sales campaigns with goal value
    if (goal_type === 'sales' && goal_value && goal_value > 0 && !goal_currency) {
      return res.status(400).json({ 
        error: 'Currency is required for sales campaigns with goal value'
      });
    }
    
    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (goal_type !== undefined && goal_type !== oldCampaign.goal_type) {
      updateFields.push('goal_type = ?');
      updateValues.push(goal_type);
      needsRecalculation = true;
    }
    if (goal_value !== undefined && goal_value !== oldCampaign.goal_value) {
      updateFields.push('goal_value = ?');
      updateValues.push(goal_value);
      needsRecalculation = true;
    }
    if (goal_currency !== undefined && goal_currency !== oldCampaign.goal_currency) {
      updateFields.push('goal_currency = ?');
      updateValues.push(goal_type === 'sales' ? goal_currency : null);
      // Currency change doesn't require recalculation, just display update
    }
    if (start_date !== undefined && start_date !== oldCampaign.start_date) {
      updateFields.push('start_date = ?');
      updateValues.push(start_date);
      needsRecalculation = true;
    }
    if (end_date !== undefined && end_date !== oldCampaign.end_date) {
      updateFields.push('end_date = ?');
      updateValues.push(end_date);
      needsRecalculation = true;
    }
    if (is_open_campaign !== undefined) {
      updateFields.push('is_open_campaign = ?');
      updateValues.push(is_open_campaign);
      if (is_open_campaign) {
        updateFields.push('end_date = ?');
        updateValues.push(null);
      }
      needsRecalculation = true;
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    if (auto_join !== undefined && auto_join !== oldCampaign.auto_join) {
      updateFields.push('auto_join = ?');
      updateValues.push(auto_join);
    }
    
    updateFields.push('updated_at = NOW()');
    updateValues.push(id);
    
    await db.execute(
      `UPDATE campaigns SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    
    // Recalculate progress if goal-related fields changed and campaign is active
    if (needsRecalculation && (status === 'active' || oldCampaign.status === 'active')) {
      try {
        const [updatedCampaign] = await db.execute('SELECT * FROM campaigns WHERE id = ?', [id]);
        const progress = await CampaignGoalCalculator.calculateSingleCampaignProgress(updatedCampaign[0]);
        
        await db.execute(
          'UPDATE campaigns SET current_value = ? WHERE id = ?',
          [progress.current_value, id]
        );
        
        // Log recalculation activity
        await db.execute(`
          INSERT INTO campaign_activities 
          (campaign_id, entity_type, entity_id, activity_type, activity_description, created_by)
          VALUES (?, 'campaign', ?, 'updated', 'Campaign updated and progress recalculated', ?)
        `, [id, id, req.user.id]);
        
      } catch (error) {
        console.error(`Error recalculating campaign ${id} after update:`, error);
      }
    } else {
      // Log regular update activity
      await db.execute(`
        INSERT INTO campaign_activities 
        (campaign_id, entity_type, entity_id, activity_type, activity_description, created_by)
        VALUES (?, 'campaign', ?, 'updated', 'Campaign updated', ?)
      `, [id, id, req.user.id]);
    }
    
    res.json({ success: true, message: 'Campaign updated successfully' });
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ error: error.message });
  }
});


// Add participants to campaign
router.post('/:id/participants', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { participants } = req.body; // Array of {entity_type, entity_id}
    
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ error: 'Participants array is required' });
    }
    
    const db = await getDb();
    
    const [campaign] = await db.execute('SELECT * FROM campaigns WHERE id = ?', [id]);
    if (campaign.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    const campaignData = campaign[0];
    const participantPromises = [];
    const updatePromises = [];
    
    for (const participant of participants) {
      const { entity_type, entity_id } = participant;
      
      if (!entity_type || !entity_id) continue;
      if (entity_type !== campaignData.campaign_type) {
        continue;
      }
      
      participantPromises.push(
        db.execute(`
          INSERT INTO campaign_participants (campaign_id, entity_type, entity_id, status)
          VALUES (?, ?, ?, 'active')
          ON DUPLICATE KEY UPDATE status = 'active'
        `, [id, entity_type, entity_id])
      );
      
      // Update entity's campaign_ids field with corrected syntax
      const table = entity_type === 'lead' ? 'leads' : 'accounts';
      updatePromises.push(
        db.execute(`
          UPDATE ${table} 
          SET campaign_ids = JSON_ARRAY_APPEND(
            COALESCE(campaign_ids, JSON_ARRAY()), 
            '$', 
            ?
          )
          WHERE id = ? AND NOT JSON_CONTAINS(COALESCE(campaign_ids, JSON_ARRAY()), CAST(? AS CHAR))
        `, [id, entity_id, id.toString()])
      );
      
      // Log activity
      participantPromises.push(
        db.execute(`
          INSERT INTO campaign_activities 
          (campaign_id, entity_type, entity_id, activity_type, activity_description, created_by)
          VALUES (?, ?, ?, 'joined', 'Added or re-activated in campaign', ?)
        `, [id, entity_type, entity_id, req.user.id])
      );
    }
    
    await Promise.all([...participantPromises, ...updatePromises]);
    
    // Trigger goal calculation for the campaign to add their value back
    if (campaignData.status === 'active' && campaignData.goal_value > 0) {
      try {
        await CampaignGoalCalculator.calculateCampaignProgress(id);
      } catch (error) {
        console.error(`Error calculating campaign progress after adding participants:`, error);
      }
    }
    
    res.json({ success: true, message: 'Participants added or re-activated successfully' });
  } catch (error) {
    console.error('Error adding participants:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove participants from campaign
router.delete('/:id/participants', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { participants } = req.body; // Array of {entity_type, entity_id}

    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ error: 'Participants array is required' });
    }

    const db = await getDb();
    
    const [campaignResult] = await db.execute('SELECT * FROM campaigns WHERE id = ?', [id]);
    if (campaignResult.length === 0) {
        return res.status(404).json({ error: 'Campaign not found' });
    }
    const campaignData = campaignResult[0];

    let totalValueToRemove = 0;

    // --- START: NEW LOGIC TO CALCULATE VALUE TO REMOVE ---
    for (const participant of participants) {
        if (campaignData.campaign_type === 'account' && ['sales', 'revenue'].includes(campaignData.goal_type)) {
            // Calculate the sum of product values for this account within the campaign dates
            const [contributionResult] = await db.execute(`
                SELECT COALESCE(SUM(ap.total_amount), 0) as contribution
                FROM account_products ap
                WHERE ap.account_id = ?
                  AND ap.status IN ('delivered', 'completed', 'active')
                  AND ap.purchase_date IS NOT NULL
                  AND DATE(ap.purchase_date) BETWEEN DATE(?) AND DATE(?)
            `, [participant.entity_id, campaignData.start_date, campaignData.end_date]);
            totalValueToRemove += parseFloat(contributionResult[0].contribution);

        } else if (campaignData.campaign_type === 'lead' && campaignData.goal_type === 'conversion') {
            // Check if this lead was converted within the campaign dates
            const [contributionResult] = await db.execute(`
                SELECT COUNT(*) as contribution
                FROM leads l
                WHERE l.id = ?
                  AND l.lead_status = 'converted'
                  AND DATE(l.updated_at) BETWEEN DATE(?) AND DATE(?)
            `, [participant.entity_id, campaignData.start_date, campaignData.end_date]);
            totalValueToRemove += parseInt(contributionResult[0].contribution);
        }
    }

    const removePromises = [];
    const updatePromises = [];

    for (const participant of participants) {
      const { entity_type, entity_id } = participant;
      if (!entity_type || !entity_id) continue;

      removePromises.push(
        db.execute(`
          UPDATE campaign_participants 
          SET status = 'removed' 
          WHERE campaign_id = ? AND entity_type = ? AND entity_id = ?
        `, [id, entity_type, entity_id])
      );

      const table = entity_type === 'lead' ? 'leads' : 'accounts';
      updatePromises.push(
        db.execute(`
          UPDATE ${table} 
          SET campaign_ids = JSON_REMOVE(
            campaign_ids, 
            JSON_UNQUOTE(JSON_SEARCH(campaign_ids, 'one', ?))
          ) 
          WHERE id = ? AND JSON_CONTAINS(campaign_ids, CAST(? as CHAR))
        `, [id.toString(), entity_id, id.toString()])
      );

      removePromises.push(
        db.execute(`
          INSERT INTO campaign_activities 
          (campaign_id, entity_type, entity_id, activity_type, activity_description, created_by) 
          VALUES (?, ?, ?, 'removed', 'Removed from campaign', ?)
        `, [id, entity_type, entity_id, req.user.id])
      );
    }

    await Promise.all([...removePromises, ...updatePromises]);

    // --- START: NEW DIRECT UPDATE OF CAMPAIGN VALUE ---
    if (totalValueToRemove > 0) {
        await db.execute(
            `UPDATE campaigns SET current_value = GREATEST(0, COALESCE(current_value, 0) - ?) WHERE id = ?`,
            [totalValueToRemove, id]
        );
    }
    // As a fallback, we can still run the full recalculation to ensure everything is in sync.
    await CampaignGoalCalculator.calculateCampaignProgress(id);
    // --- END: NEW DIRECT UPDATE ---

    res.json({ 
      success: true, 
      message: 'Participants removed successfully and campaign value updated.' 
    });

  } catch (error) {
    console.error('Error removing participants:', error);
    res.status(500).json({ error: error.message });
  }
});


// Get campaign statistics
router.get('/:id/stats', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    
    const [stats] = await db.execute(`
      SELECT 
        COUNT(DISTINCT cp.id) as total_participants,
        COUNT(DISTINCT CASE WHEN cp.status = 'active' THEN cp.id END) as active_participants,
        COUNT(DISTINCT CASE WHEN cp.status = 'completed' THEN cp.id END) as completed_participants,
        COUNT(DISTINCT ca.id) as total_activities,
        SUM(cp.contribution) as total_contribution,
        c.current_value,
        c.goal_value,
        c.campaign_type,
        c.goal_type,
        c.start_date,
        c.end_date,
        c.is_open_campaign,
        CASE 
          WHEN c.goal_value > 0 THEN (c.current_value / c.goal_value) * 100 
          ELSE 0 
        END as progress_percentage
      FROM campaigns c
      LEFT JOIN campaign_participants cp ON c.id = cp.campaign_id
      LEFT JOIN campaign_activities ca ON c.id = ca.campaign_id
      WHERE c.id = ?
      GROUP BY c.id
    `, [id]);
    
    if (stats.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    const campaignStats = stats[0];
    
    // Get detailed breakdown based on campaign type and goal type
    let detailedStats = {};
    
    if (campaignStats.campaign_type === 'account') {
      if (campaignStats.goal_type === 'sales' || campaignStats.goal_type === 'revenue') {
        // Get product-based statistics
        const [productStats] = await db.execute(`
          SELECT 
            COUNT(DISTINCT ap.id) as total_products_assigned,
            COALESCE(SUM(ap.total_amount), 0) as total_product_value,
            COALESCE(SUM(CASE WHEN ap.status IN ('delivered', 'completed') THEN ap.total_amount END), 0) as completed_value,
            COUNT(DISTINCT CASE WHEN ap.purchase_date IS NOT NULL THEN ap.id END) as products_with_purchase_date
          FROM account_products ap
          JOIN campaign_participants cp ON ap.account_id = cp.entity_id 
            AND cp.entity_type = 'account' 
            AND cp.campaign_id = ?
          WHERE cp.status = 'active'
        `, [id]);
        
        detailedStats = {
          ...productStats[0],
          products_contributing_to_goal: productStats[0].products_with_purchase_date
        };
      } else if (campaignStats.goal_type === 'meetings') {
        // Get meeting/call statistics
        const [meetingStats] = await db.execute(`
          SELECT 
            COUNT(*) as total_calls,
            COUNT(CASE WHEN category IN ('meeting', 'demo', 'presentation') THEN 1 END) as qualifying_meetings,
            COUNT(CASE WHEN call_outcome = 'successful' THEN 1 END) as successful_calls
          FROM account_calls ac
          JOIN campaign_participants cp ON ac.account_id = cp.entity_id 
            AND cp.entity_type = 'account' 
            AND cp.campaign_id = ?
          WHERE cp.status = 'active'
        `, [id]);
        
        detailedStats = meetingStats[0];
      }
    } else if (campaignStats.campaign_type === 'lead') {
      // Get lead-specific statistics
      const [leadStats] = await db.execute(`
        SELECT 
          COUNT(DISTINCT l.id) as total_leads,
          COUNT(CASE WHEN l.lead_status = 'converted' THEN 1 END) as converted_leads,
          COUNT(CASE WHEN l.lead_status = 'qualified' THEN 1 END) as qualified_leads,
          COUNT(CASE WHEN l.lead_status = 'contacted' THEN 1 END) as contacted_leads
        FROM leads l
        JOIN campaign_participants cp ON l.id = cp.entity_id 
          AND cp.entity_type = 'lead' 
          AND cp.campaign_id = ?
        WHERE cp.status = 'active'
      `, [id]);
      
      detailedStats = leadStats[0];
    }
    
    res.json({
      ...campaignStats,
      detailed_stats: detailedStats,
      last_calculated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching campaign stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete campaign
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    
    // Check if campaign exists
    const [existing] = await db.execute('SELECT * FROM campaigns WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    // Get all participants to update their campaign_ids
    const [participants] = await db.execute(`
      SELECT entity_type, entity_id FROM campaign_participants WHERE campaign_id = ?
    `, [id]);
    
    // Update entity campaign_ids before deletion
    const updatePromises = [];
    for (const participant of participants) {
      const table = participant.entity_type === 'lead' ? 'leads' : 'accounts';
      updatePromises.push(
        db.execute(`
          UPDATE ${table} 
          SET campaign_ids = JSON_REMOVE(
            campaign_ids, 
            JSON_UNQUOTE(JSON_SEARCH(campaign_ids, 'one', ?))
          )
          WHERE id = ? AND JSON_CONTAINS(campaign_ids, ?)
        `, [id.toString(), participant.entity_id, id.toString()])
      );
    }
    
    await Promise.all(updatePromises);
    
    // Delete campaign (cascade will handle related records)
    await db.execute('DELETE FROM campaigns WHERE id = ?', [id]);
    
    res.json({ success: true, message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/analytics', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    const [campaigns] = await db.execute('SELECT * FROM campaigns WHERE id = ?', [id]);
    if (campaigns.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const campaign = campaigns[0];

    // --- METRIC 1: Pacing and Forecasting ---
let pacing = null;
if (!campaign.is_open_campaign && campaign.start_date && campaign.end_date && campaign.goal_value > 0) {
  const startDate = new Date(campaign.start_date);
  const endDate = new Date(campaign.end_date);
  const today = new Date();

  if (today >= startDate) {
    // Calculate days more accurately
    const campaignDuration = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))) + 1; // +1 to include start day
    const daysElapsed = Math.max(1, Math.ceil((today - startDate) / (1000 * 60 * 60 * 24))) + 1; // +1 to include start day
    const daysRemaining = Math.max(0, campaignDuration - daysElapsed);
    
    const requiredPace = campaign.goal_value / campaignDuration;
    const currentValue = campaign.current_value || 0;
    const currentPace = currentValue / daysElapsed;
    const projectedValue = currentPace * campaignDuration;
    
    // More lenient on-track calculation (within 10% tolerance)
    const tolerance = 0.9; // 90% of required pace is still "on track"
    const onTrack = currentPace >= (requiredPace * tolerance);

    pacing = {
      daysElapsed,
      daysRemaining,
      campaignDuration,
      requiredPace: Math.round(requiredPace * 100) / 100, // Round to 2 decimal places
      currentPace: Math.round(currentPace * 100) / 100,
      projectedValue: Math.round(projectedValue * 100) / 100,
      onTrack,
      currentValue, // Add this for debugging
      goalValue: campaign.goal_value, // Add this for debugging
      tolerance: tolerance * 100 // Add this to show tolerance percentage
    };
  }
}

// --- METRIC 2: Top Performing Users (The "Leaderboard") ---
let topPerformers = [];

if (campaign.campaign_type === 'account' && ['sales', 'revenue'].includes(campaign.goal_type)) {
  // Enhanced analytics for sales campaigns
  const [performers] = await db.execute(`
    SELECT 
        u.first_name, 
        u.last_name, 
        SUM(ca.value_contributed) as total_sales_value,
        COUNT(CASE WHEN ca.activity_type IN ('product_purchased', 'product_updated') AND ca.value_contributed > 0 THEN 1 END) as product_sales_count,
        COUNT(ca.id) as total_activities,
        AVG(CASE WHEN ca.value_contributed > 0 THEN ca.value_contributed END) as avg_sale_value,
        MAX(ca.value_contributed) as highest_sale_value
    FROM campaign_activities ca
    JOIN users u ON ca.created_by = u.id
    WHERE ca.campaign_id = ? AND ca.value_contributed > 0
    GROUP BY ca.created_by, u.first_name, u.last_name
    ORDER BY total_sales_value DESC
    LIMIT 5
  `, [id]);
  
  topPerformers = performers.map(performer => ({
    first_name: performer.first_name,
    last_name: performer.last_name,
    total_sales_value: parseFloat(performer.total_sales_value || 0),
    product_sales_count: parseInt(performer.product_sales_count || 0),
    total_activities: parseInt(performer.total_activities || 0),
    avg_sale_value: parseFloat(performer.avg_sale_value || 0),
    highest_sale_value: parseFloat(performer.highest_sale_value || 0)
  }));

} else if (campaign.campaign_type === 'lead' && campaign.goal_type === 'conversion') {
  // Enhanced analytics for conversion campaigns
  const [performers] = await db.execute(`
    SELECT 
        u.first_name, 
        u.last_name, 
        SUM(ca.value_contributed) as total_conversions,
        COUNT(CASE WHEN ca.activity_type = 'converted' AND ca.value_contributed > 0 THEN 1 END) as conversion_count,
        COUNT(ca.id) as total_activities
    FROM campaign_activities ca
    JOIN users u ON ca.created_by = u.id
    WHERE ca.campaign_id = ? AND ca.value_contributed > 0
    GROUP BY ca.created_by, u.first_name, u.last_name
    ORDER BY total_conversions DESC
    LIMIT 5
  `, [id]);
  
  topPerformers = performers.map(performer => ({
    first_name: performer.first_name,
    last_name: performer.last_name,
    total_conversions: parseInt(performer.total_conversions || 0),
    conversion_count: parseInt(performer.conversion_count || 0),
    total_activities: parseInt(performer.total_activities || 0)
  }));

} else {
  // Standard analytics for other campaign types
  const [performers] = await db.execute(`
    SELECT 
        u.first_name, 
        u.last_name, 
        SUM(ca.value_contributed) as total_contribution,
        COUNT(ca.id) as total_activities
    FROM campaign_activities ca
    JOIN users u ON ca.created_by = u.id
    WHERE ca.campaign_id = ? AND ca.value_contributed > 0
    GROUP BY ca.created_by, u.first_name, u.last_name
    ORDER BY total_contribution DESC
    LIMIT 5
  `, [id]);
  topPerformers = performers;
}

// --- METRIC 3: Goal-Specific Breakdown ---
let breakdown = null;

if (campaign.campaign_type === 'lead') {
    const [leadStatusBreakdown] = await db.execute(`
        SELECT l.lead_status, COUNT(l.id) as count
        FROM leads l
        JOIN campaign_participants cp ON l.id = cp.entity_id AND cp.entity_type = 'lead'
        WHERE cp.campaign_id = ? AND cp.status = 'active'
        GROUP BY l.lead_status
    `, [id]);
    breakdown = { type: 'lead_status', data: leadStatusBreakdown };

} else if (campaign.campaign_type === 'account' && ['sales', 'revenue'].includes(campaign.goal_type)) {
    const [productBreakdown] = await db.execute(`
        SELECT 
            p.name, 
            SUM(ap.total_amount) as total_value, 
            COUNT(ap.id) as units_sold,
            AVG(ap.total_amount) as avg_sale_value,
            COUNT(DISTINCT ap.account_id) as unique_accounts
        FROM account_products ap
        JOIN products p ON ap.product_id = p.id
        JOIN campaign_participants cp ON ap.account_id = cp.entity_id AND cp.entity_type = 'account'
        WHERE cp.campaign_id = ? AND cp.status = 'active'
          AND ap.purchase_date IS NOT NULL 
          AND DATE(ap.purchase_date) BETWEEN DATE(?) AND DATE(?)
        GROUP BY p.id, p.name
        ORDER BY total_value DESC
        LIMIT 5
    `, [id, campaign.start_date, campaign.end_date]);
    
    breakdown = { 
      type: 'product_revenue', 
      data: productBreakdown.map(item => ({
        name: item.name,
        total_value: parseFloat(item.total_value || 0),
        units_sold: parseInt(item.units_sold || 0),
        avg_sale_value: parseFloat(item.avg_sale_value || 0),
        unique_accounts: parseInt(item.unique_accounts || 0)
      }))
    };
} else if (campaign.campaign_type === 'account' && campaign.goal_type === 'meetings') {
  // Enhanced analytics for meeting campaigns - track call activities
  const [callPerformers] = await db.execute(`
    SELECT 
        u.first_name, 
        u.last_name, 
        u.id as user_id,
        COUNT(ac.id) as total_calls,
        COUNT(CASE WHEN ac.category IN ('Meeting', 'Demo', 'Presentation') THEN 1 END) as meeting_calls,
        COUNT(CASE WHEN ac.call_outcome = 'Successful' THEN 1 END) as successful_calls,
        COUNT(CASE WHEN ac.call_outcome = 'Meeting Scheduled' THEN 1 END) as meetings_scheduled,
        AVG(ac.call_duration) as avg_call_duration,
        SUM(ac.call_duration) as total_call_time,
        COUNT(DISTINCT ac.account_id) as unique_accounts_called,
        MAX(ac.call_date) as last_call_date,
        MIN(ac.call_date) as first_call_date
    FROM account_calls ac
    JOIN users u ON ac.user_id = u.id
    JOIN campaign_participants cp ON ac.account_id = cp.entity_id 
      AND cp.entity_type = 'account' 
      AND cp.campaign_id = ?
    WHERE cp.status = 'active'
      AND DATE(ac.call_date) BETWEEN DATE(?) AND DATE(?)
    GROUP BY u.id, u.first_name, u.last_name
    ORDER BY total_calls DESC, successful_calls DESC
    LIMIT 10
  `, [id, campaign.start_date, campaign.end_date]);
  
  topPerformers = callPerformers.map(performer => ({
    first_name: performer.first_name,
    last_name: performer.last_name,
    user_id: performer.user_id,
    total_calls: parseInt(performer.total_calls || 0),
    meeting_calls: parseInt(performer.meeting_calls || 0),
    successful_calls: parseInt(performer.successful_calls || 0),
    meetings_scheduled: parseInt(performer.meetings_scheduled || 0),
    avg_call_duration: parseFloat(performer.avg_call_duration || 0),
    total_call_time: parseFloat(performer.total_call_time || 0),
    unique_accounts_called: parseInt(performer.unique_accounts_called || 0),
    success_rate: performer.total_calls > 0 ? 
      ((performer.successful_calls / performer.total_calls) * 100).toFixed(1) : '0.0',
    meeting_conversion_rate: performer.total_calls > 0 ? 
      ((performer.meetings_scheduled / performer.total_calls) * 100).toFixed(1) : '0.0',
    last_call_date: performer.last_call_date,
    first_call_date: performer.first_call_date
  }));

  if (breakdown === null) {
    const [callBreakdown] = await db.execute(`
      SELECT 
          ac.category,
          COUNT(ac.id) as call_count,
          COUNT(CASE WHEN ac.call_outcome = 'Successful' THEN 1 END) as successful_count,
          COUNT(CASE WHEN ac.call_outcome = 'Meeting Scheduled' THEN 1 END) as meetings_scheduled,
          AVG(ac.call_duration) as avg_duration,
          COUNT(DISTINCT ac.account_id) as unique_accounts,
          COUNT(DISTINCT ac.user_id) as unique_callers
      FROM account_calls ac
      JOIN campaign_participants cp ON ac.account_id = cp.entity_id 
        AND cp.entity_type = 'account' 
        AND cp.campaign_id = ?
      WHERE cp.status = 'active'
        AND DATE(ac.call_date) BETWEEN DATE(?) AND DATE(?)
      GROUP BY ac.category
      ORDER BY call_count DESC
    `, [id, campaign.start_date, campaign.end_date]);
    
    breakdown = { 
      type: 'call_categories', 
      data: callBreakdown.map(item => ({
        category: item.category,
        call_count: parseInt(item.call_count || 0),
        successful_count: parseInt(item.successful_count || 0),
        meetings_scheduled: parseInt(item.meetings_scheduled || 0),
        avg_duration: parseFloat(item.avg_duration || 0),
        unique_accounts: parseInt(item.unique_accounts || 0),
        unique_callers: parseInt(item.unique_callers || 0),
        success_rate: item.call_count > 0 ? 
          ((item.successful_count / item.call_count) * 100).toFixed(1) : '0.0'
      }))
    };
  }
}

let topEarningAccounts = [];

if (campaign.campaign_type === 'account' && ['sales', 'revenue'].includes(campaign.goal_type)) {
  const [earningAccounts] = await db.execute(`
    SELECT 
      a.id,
      a.name as account_name,
      a.contact_fname,
      a.contact_lname,
      a.contact_email,
      a.industry,
      SUM(ap.total_amount) as total_revenue,
      COUNT(ap.id) as total_purchases,
      AVG(ap.total_amount) as avg_purchase_value,
      MAX(ap.total_amount) as highest_purchase_value,
      MIN(ap.purchase_date) as first_purchase_date,
      MAX(ap.purchase_date) as last_purchase_date,
      COUNT(DISTINCT ap.product_id) as unique_products_purchased,
      GROUP_CONCAT(DISTINCT p.name ORDER BY ap.total_amount DESC SEPARATOR ', ') as top_products
    FROM accounts a
    JOIN campaign_participants cp ON a.id = cp.entity_id 
      AND cp.entity_type = 'account' 
      AND cp.campaign_id = ?
    JOIN account_products ap ON a.id = ap.account_id
    JOIN products p ON ap.product_id = p.id
    WHERE cp.status = 'active'
      AND ap.status IN ('delivered', 'completed', 'active')
      AND ap.purchase_date IS NOT NULL
      AND DATE(ap.purchase_date) BETWEEN DATE(?) AND DATE(?)
    GROUP BY a.id, a.name, a.contact_fname, a.contact_lname, a.contact_email, a.industry
    ORDER BY total_revenue DESC
    LIMIT 10
  `, [id, campaign.start_date, campaign.end_date]);
  
  topEarningAccounts = earningAccounts.map(account => ({
    id: account.id,
    account_name: account.account_name,
    contact_name: `${account.contact_fname || ''} ${account.contact_lname || ''}`.trim() || 'N/A',
    contact_email: account.contact_email,
    industry: account.industry,
    total_revenue: parseFloat(account.total_revenue || 0),
    total_purchases: parseInt(account.total_purchases || 0),
    avg_purchase_value: parseFloat(account.avg_purchase_value || 0),
    highest_purchase_value: parseFloat(account.highest_purchase_value || 0),
    first_purchase_date: account.first_purchase_date,
    last_purchase_date: account.last_purchase_date,
    unique_products_purchased: parseInt(account.unique_products_purchased || 0),
    top_products: account.top_products
  }));
}

let topCallAccounts = [];

if (campaign.campaign_type === 'account' && campaign.goal_type === 'meetings') {
  const [callAccounts] = await db.execute(`
    SELECT 
      a.id,
      a.name as account_name,
      a.contact_fname,
      a.contact_lname,
      a.contact_email,
      a.industry,
      a.type as account_status,
      COUNT(ac.id) as total_calls_received,
      COUNT(CASE WHEN ac.call_outcome = 'Successful' THEN 1 END) as successful_calls,
      COUNT(CASE WHEN ac.call_outcome = 'Meeting Scheduled' THEN 1 END) as meetings_scheduled,
      COUNT(CASE WHEN ac.category IN ('Meeting', 'Demo', 'Presentation') THEN 1 END) as meeting_calls,
      AVG(ac.call_duration) as avg_call_duration,
      SUM(ac.call_duration) as total_call_time,
      COUNT(DISTINCT ac.user_id) as unique_callers,
      MAX(ac.call_date) as last_call_date,
      MIN(ac.call_date) as first_call_date,
      GROUP_CONCAT(DISTINCT ac.contact_person ORDER BY ac.call_date DESC SEPARATOR ', ') as contact_persons
    FROM accounts a
    JOIN campaign_participants cp ON a.id = cp.entity_id 
      AND cp.entity_type = 'account' 
      AND cp.campaign_id = ?
    JOIN account_calls ac ON a.id = ac.account_id
    WHERE cp.status = 'active'
      AND DATE(ac.call_date) BETWEEN DATE(?) AND DATE(?)
    GROUP BY a.id, a.name, a.contact_fname, a.contact_lname, a.contact_email, a.industry, a.type
    ORDER BY total_calls_received DESC, successful_calls DESC
    LIMIT 10
  `, [id, campaign.start_date, campaign.end_date]);
  
  topCallAccounts = callAccounts.map(account => ({
    id: account.id,
    account_name: account.account_name,
    contact_name: `${account.contact_fname || ''} ${account.contact_lname || ''}`.trim() || 'N/A',
    contact_email: account.contact_email,
    industry: account.industry,
    account_status: account.account_status,
    total_calls_received: parseInt(account.total_calls_received || 0),
    successful_calls: parseInt(account.successful_calls || 0),
    meetings_scheduled: parseInt(account.meetings_scheduled || 0),
    meeting_calls: parseInt(account.meeting_calls || 0),
    avg_call_duration: parseFloat(account.avg_call_duration || 0),
    total_call_time: parseFloat(account.total_call_time || 0),
    unique_callers: parseInt(account.unique_callers || 0),
    success_rate: account.total_calls_received > 0 ? 
      ((account.successful_calls / account.total_calls_received) * 100).toFixed(1) : '0.0',
    meeting_conversion_rate: account.total_calls_received > 0 ? 
      ((account.meetings_scheduled / account.total_calls_received) * 100).toFixed(1) : '0.0',
    last_call_date: account.last_call_date,
    first_call_date: account.first_call_date,
    contact_persons: account.contact_persons
  }));
}

    res.json({
      pacing,
      topPerformers,
      topEarningAccounts,
      topCallAccounts,
      breakdown
    });

  } catch (error) {
    console.error('Error fetching campaign analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

  return router;
};