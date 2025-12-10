// routes/accountCallRoutes.js
const express = require('express');

module.exports = (dependencies) => {
const { getDb, authenticateToken, requireRole, buildFilterWhereClause } = dependencies;
const router = express.Router();

// Get all call logs for a specific account
router.get('/account/:accountId', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const db = await getDb();
    
    // Verify account exists
    const [accountRows] = await db.execute('SELECT id FROM accounts WHERE id = ?', [accountId]);
    if (accountRows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Get call logs for this account
    const [callLogs] = await db.execute(`
      SELECT 
        ac.*,
        CONCAT(u.first_name, ' ', u.last_name) as logged_by_name
      FROM account_calls ac
      LEFT JOIN users u ON ac.user_id = u.id
      WHERE ac.account_id = ?
      ORDER BY ac.call_date DESC, ac.created_at DESC
    `, [accountId]);
    
    res.json(callLogs);
  } catch (error) {
    console.error('Error fetching account call logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all account call logs (for reporting/overview)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const { limit, offset, accountId, category, userId } = req.query;
    
    // Determine if pagination should be used
    const usePagination = limit !== undefined || offset !== undefined;
    const limitNum = parseInt(limit) || 50;
    const offsetNum = parseInt(offset) || 0;
    
    let whereConditions = [];
    let queryParams = [];
    
    // Add filters
    if (accountId) {
      whereConditions.push('ac.account_id = ?');
      queryParams.push(accountId);
    }
    
    if (category) {
      whereConditions.push('ac.category = ?');
      queryParams.push(category);
    }
    
    if (userId) {
      whereConditions.push('ac.user_id = ?');
      queryParams.push(userId);
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';
    
    // Build pagination clause
    let paginationClause = '';
    let finalParams = [...queryParams];
    
    if (usePagination) {
      paginationClause = 'LIMIT ? OFFSET ?';
      finalParams.push(limitNum, offsetNum);
    }
    
    const [callLogs] = await db.execute(`
      SELECT 
        ac.*,
        CONCAT(u.first_name, ' ', u.last_name) as logged_by_name,
        a.account_name,
        a.primary_contact_first_name,
        a.primary_contact_last_name
      FROM account_calls ac
      LEFT JOIN users u ON ac.user_id = u.id
      LEFT JOIN accounts a ON ac.account_id = a.id
      ${whereClause}
      ORDER BY ac.call_date DESC, ac.created_at DESC
      ${paginationClause}
    `, finalParams);
    
    // Get total count
    const [countResult] = await db.execute(`
      SELECT COUNT(*) as total
      FROM account_calls ac
      LEFT JOIN accounts a ON ac.account_id = a.id
      ${whereClause}
    `, queryParams);
    
    const total = countResult[0].total;
    
    // Build response based on pagination
    if (usePagination) {
      res.json({
        calls: callLogs,
        total,
        limit: limitNum,
        offset: offsetNum
      });
    } else {
      // Return all data without pagination info
      res.json({
        calls: callLogs,
        total
      });
    }
  } catch (error) {
    console.error('Error fetching account call logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new account call log
router.post('/', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const {
      account_id,
      category,
      notes,
      call_duration,
      call_outcome,
      call_date,
      contact_person
    } = req.body;

    // Validation
    if (!account_id || !category || !call_date) {
      return res.status(400).json({ 
        error: 'account_id, category, and call_date are required' 
      });
    }

    const validCategories = ['Informational', 'Reminder', 'Sale', 'Follow-up', 'Support', 'Meeting', 'Negotiation'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ 
        error: `Invalid category. Must be one of: ${validCategories.join(', ')}` 
      });
    }

    const validOutcomes = ['Successful', 'No Answer', 'Voicemail', 'Busy', 'Disconnected', 'Meeting Scheduled'];
    if (call_outcome && !validOutcomes.includes(call_outcome)) {
      return res.status(400).json({ 
        error: `Invalid call outcome. Must be one of: ${validOutcomes.join(', ')}` 
      });
    }

    const db = await getDb();
    
    // Verify account exists
    const [accountRows] = await db.execute('SELECT id FROM accounts WHERE id = ?', [account_id]);
    if (accountRows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const userName = `${req.user.first_name} ${req.user.last_name}`;

    // Insert call log
    const [result] = await db.execute(`
      INSERT INTO account_calls (
        account_id, user_id, user_name, category, notes, 
        call_duration, call_outcome, call_date, contact_person
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      account_id,
      req.user.id,
      userName,
      category,
      notes || null,
      call_duration || null,
      call_outcome || 'Successful',
      call_date,
      contact_person || null
    ]);

    const callLogId = result.insertId;

    // Get the created call log with user details
    const [newCallLog] = await db.execute(`
      SELECT 
        ac.*,
        CONCAT(u.first_name, ' ', u.last_name) as logged_by_name
      FROM account_calls ac
      LEFT JOIN users u ON ac.user_id = u.id
      WHERE ac.id = ?
    `, [callLogId]);

const [meetingCampaigns] = await db.execute(`
  SELECT id, start_date, end_date, is_open_campaign 
  FROM campaigns 
  WHERE campaign_type = 'account' 
    AND goal_type = 'meetings' 
    AND status = 'active'
    AND auto_join = TRUE
    AND (is_open_campaign = 1 OR DATE(?) BETWEEN DATE(start_date) AND DATE(end_date))
`, [call_date]);

for (const campaign of meetingCampaigns) {
  // Check if account is already a participant
  const [existing] = await db.execute(`
    SELECT id FROM campaign_participants 
    WHERE campaign_id = ? AND entity_type = 'account' AND entity_id = ? AND status = 'active'
  `, [campaign.id, account_id]);
  
  if (existing.length === 0) {
    // Auto-assign account to campaign
    await db.execute(`
      INSERT INTO campaign_participants (campaign_id, entity_type, entity_id, status)
      VALUES (?, 'account', ?, 'active')
    `, [campaign.id, account_id]);
    
    // Update account's campaign_ids
    await db.execute(`
      UPDATE accounts 
      SET campaign_ids = JSON_ARRAY_APPEND(COALESCE(campaign_ids, JSON_ARRAY()), '$', ?)
      WHERE id = ?
    `, [campaign.id, account_id]);
    
    // Log the auto-assignment activity
    await db.execute(`
      INSERT INTO campaign_activities 
      (campaign_id, entity_type, entity_id, activity_type, activity_description, created_by)
      VALUES (?, 'account', ?, 'auto_joined', 'Auto-assigned due to meeting activity', ?)
    `, [campaign.id, account_id, req.user.id]);
  }
}

    res.status(201).json({
      id: callLogId,
      call: newCallLog[0],
      message: 'Account call logged successfully'
    });

  } catch (error) {
    console.error('Error creating account call log:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update an account call log
router.put('/:id', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      category,
      notes,
      call_duration,
      call_outcome,
      call_date,
      contact_person
    } = req.body;

    const db = await getDb();
    
    // Check if call log exists and user owns it (or is manager)
    const [callLogRows] = await db.execute(`
      SELECT * FROM account_calls WHERE id = ?
    `, [id]);
    
    if (callLogRows.length === 0) {
      return res.status(404).json({ error: 'Account call log not found' });
    }
    
    const callLog = callLogRows[0];
    
    // Only allow the user who created the call or managers to edit
    if (callLog.user_id !== req.user.id && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Insufficient permissions to edit this call log' });
    }

    // Validate category if provided
    if (category) {
      const validCategories = ['Informational', 'Reminder', 'Sale', 'Follow-up', 'Support', 'Meeting', 'Negotiation'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({ 
          error: `Invalid category. Must be one of: ${validCategories.join(', ')}` 
        });
      }
    }

    // Validate call outcome if provided
    if (call_outcome) {
      const validOutcomes = ['Successful', 'No Answer', 'Voicemail', 'Busy', 'Disconnected', 'Meeting Scheduled'];
      if (!validOutcomes.includes(call_outcome)) {
        return res.status(400).json({ 
          error: `Invalid call outcome. Must be one of: ${validOutcomes.join(', ')}` 
        });
      }
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];

    if (category !== undefined) {
      updateFields.push('category = ?');
      updateValues.push(category);
    }
    
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(notes);
    }
    
    if (call_duration !== undefined) {
      updateFields.push('call_duration = ?');
      updateValues.push(call_duration);
    }
    
    if (call_outcome !== undefined) {
      updateFields.push('call_outcome = ?');
      updateValues.push(call_outcome);
    }
    
    if (call_date !== undefined) {
      updateFields.push('call_date = ?');
      updateValues.push(call_date);
    }

    if (contact_person !== undefined) {
      updateFields.push('contact_person = ?');
      updateValues.push(contact_person);
    }

    if (updateFields.length === 0) {
      return res.json({ message: 'No changes to update' });
    }

    // Add updated_at
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);

    await db.execute(
      `UPDATE account_calls SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Get updated call log
    const [updatedCallLog] = await db.execute(`
      SELECT 
        ac.*,
        CONCAT(u.first_name, ' ', u.last_name) as logged_by_name
      FROM account_calls ac
      LEFT JOIN users u ON ac.user_id = u.id
      WHERE ac.id = ?
    `, [id]);

    res.json({
      call: updatedCallLog[0],
      message: 'Account call log updated successfully'
    });

  } catch (error) {
    console.error('Error updating account call log:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete an account call log
router.delete('/:id', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    
    // Check if call log exists and user owns it (or is manager)
    const [callLogRows] = await db.execute(`
      SELECT * FROM account_calls WHERE id = ?
    `, [id]);
    
    if (callLogRows.length === 0) {
      return res.status(404).json({ error: 'Account call log not found' });
    }
    
    const callLog = callLogRows[0];
    
    // Only allow the user who created the call or managers to delete
    if (callLog.user_id !== req.user.id && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Insufficient permissions to delete this call log' });
    }

    // Delete the call log
    const [deleteResult] = await db.execute('DELETE FROM account_calls WHERE id = ?', [id]);

    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({ error: 'Account call log not found' });
    }

    res.json({ 
      success: true,
      deletedId: parseInt(id),
      message: 'Account call log deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting account call log:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get call statistics for an account
router.get('/account/:accountId/stats', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const db = await getDb();
    
    // Verify account exists
    const [accountRows] = await db.execute('SELECT id FROM accounts WHERE id = ?', [accountId]);
    if (accountRows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Get call statistics
    const [stats] = await db.execute(`
      SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN category = 'Sale' THEN 1 END) as sales_calls,
        COUNT(CASE WHEN category = 'Follow-up' THEN 1 END) as followup_calls,
        COUNT(CASE WHEN category = 'Meeting' THEN 1 END) as meeting_calls,
        COUNT(CASE WHEN category = 'Informational' THEN 1 END) as info_calls,
        COUNT(CASE WHEN call_outcome = 'Successful' THEN 1 END) as successful_calls,
        COUNT(CASE WHEN call_outcome = 'Meeting Scheduled' THEN 1 END) as meetings_scheduled,
        AVG(call_duration) as avg_duration,
        MAX(call_date) as last_call_date,
        MIN(call_date) as first_call_date
      FROM account_calls 
      WHERE account_id = ?
    `, [accountId]);
    
    // Get call history by category
    const [categoryBreakdown] = await db.execute(`
      SELECT 
        category,
        COUNT(*) as count,
        AVG(call_duration) as avg_duration
      FROM account_calls 
      WHERE account_id = ?
      GROUP BY category
      ORDER BY count DESC
    `, [accountId]);
    
    // Get contact person breakdown
    const [contactBreakdown] = await db.execute(`
      SELECT 
        contact_person,
        COUNT(*) as count
      FROM account_calls 
      WHERE account_id = ? AND contact_person IS NOT NULL
      GROUP BY contact_person
      ORDER BY count DESC
    `, [accountId]);
    
    res.json({
      stats: stats[0],
      category_breakdown: categoryBreakdown,
      contact_breakdown: contactBreakdown
    });
    
  } catch (error) {
    console.error('Error fetching account call statistics:', error);
    res.status(500).json({ error: error.message });
  }
});
router.get('/reports', authenticateToken, async (req, res) => {
  try {
    const { 
      page, 
      limit, 
      filters,
      accountId, 
      category, 
      userId,
      call_outcome,
      start_date,
      end_date,
      contact_person
    } = req.query;

    const db = await getDb();
    let whereConditions = ['1=1'];
    let queryParams = [];
    
    // Determine if pagination should be used
    const usePagination = page !== undefined || limit !== undefined;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    
    // Handle JSON filters from the reports interface
    if (filters) {
      try {
        const parsedFilters = JSON.parse(filters);
        if (Array.isArray(parsedFilters) && parsedFilters.length > 0) {
          const filterResult = buildFilterWhereClause(parsedFilters, 'account_calls');
          
          if (filterResult.whereClause) {
            whereConditions.push(filterResult.whereClause.replace(/^AND\s+/, ''));
            queryParams.push(...filterResult.params);
          }
        }
      } catch (error) {
        console.error('Error parsing filters:', error);
        return res.status(400).json({ error: 'Invalid filter format' });
      }
    }

    // Legacy individual filters for backwards compatibility
    if (accountId) {
      whereConditions.push('ac.account_id = ?');
      queryParams.push(accountId);
    }
    
    if (category) {
      whereConditions.push('ac.category = ?');
      queryParams.push(category);
    }
    
    if (userId) {
      whereConditions.push('ac.user_id = ?');
      queryParams.push(userId);
    }

    if (call_outcome) {
      whereConditions.push('ac.call_outcome = ?');
      queryParams.push(call_outcome);
    }

    if (start_date) {
      whereConditions.push('DATE(ac.call_date) >= ?');
      queryParams.push(start_date);
    }

    if (end_date) {
      whereConditions.push('DATE(ac.call_date) <= ?');
      queryParams.push(end_date);
    }

    if (contact_person) {
      whereConditions.push('ac.contact_person LIKE ?');
      queryParams.push(`%${contact_person}%`);
    }
    
    const whereClause = whereConditions.length > 1 
      ? `WHERE ${whereConditions.slice(1).join(' AND ')}` 
      : '';
    
    // Build the pagination clause
    let paginationClause = '';
    let finalParams = [...queryParams];
    
    if (usePagination) {
      const offset = (pageNum - 1) * limitNum;
      paginationClause = 'LIMIT ? OFFSET ?';
      finalParams.push(limitNum, offset);
    }
    
    // Main report query
    const [accountCallReports] = await db.execute(`
      SELECT 
        ac.id,
        ac.account_id,
        ac.user_id,
        ac.user_name,
        ac.category,
        ac.notes,
        ac.call_duration,
        ac.call_outcome,
        ac.call_date,
        ac.contact_person,
        ac.created_at,
        ac.updated_at,
        CONCAT(u.first_name, ' ', u.last_name) as logged_by_name,
        a.name AS account_name,
        a.contact_fname AS primary_contact_first_name,
        a.contact_lname AS primary_contact_last_name,
        CONCAT(a.contact_fname, ' ', a.contact_lname) as primary_contact_name,
        a.type as company_type,
        a.industry,
        a.contact_phone as account_phone,
        a.contact_email as account_email,
        a.billing_address as address,
        a.billing_city as city,
        a.billing_state as state,
        a.billing_zip as zip_code,
        a.type AS account_status
      FROM account_calls ac
      LEFT JOIN users u ON ac.user_id = u.id
      LEFT JOIN accounts a ON ac.account_id = a.id
      ${whereClause}
      ORDER BY ac.call_date DESC, ac.created_at DESC
      ${paginationClause}
    `, finalParams);
    
    // Get total count for pagination
    const [countResult] = await db.execute(`
      SELECT COUNT(*) as total
      FROM account_calls ac
      LEFT JOIN accounts a ON ac.account_id = a.id
      LEFT JOIN users u ON ac.user_id = u.id
      ${whereClause}
    `, queryParams);
    
    const total = countResult[0].total;

    // Format the response
    const formattedData = accountCallReports.map(call => ({
      id: call.id,
      account_id: call.account_id,
      user_id: call.user_id,
      user_name: call.user_name,
      logged_by_name: call.logged_by_name,
      account_name: call.account_name,
      primary_contact_name: call.primary_contact_name,
      primary_contact_first_name: call.primary_contact_first_name,
      primary_contact_last_name: call.primary_contact_last_name,
      company_type: call.company_type,
      industry: call.industry,
      account_phone: call.account_phone,
      account_email: call.account_email,
      account_status: call.account_status,
      address: call.address,
      city: call.city,
      state: call.state,
      zip_code: call.zip_code,
      category: call.category,
      call_outcome: call.call_outcome,
      call_date: call.call_date,
      call_duration: call.call_duration,
      contact_person: call.contact_person,
      notes: call.notes,
      created_at: call.created_at,
      updated_at: call.updated_at
    }));

    // Build response based on pagination
    if (usePagination) {
      const totalPages = Math.ceil(total / limitNum);
      res.json({
        data: formattedData,
        pagination: {
          currentPage: pageNum,
          totalPages,
          total,
          limit: limitNum,
          offset: (pageNum - 1) * limitNum
        }
      });
    } else {
      // Return all data without pagination info
      res.json({
        data: formattedData,
        total
      });
    }

  } catch (error) {
    console.error('Error fetching account call reports:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================================
// REPORTS STATISTICS ENDPOINT
// ====================================================================
router.get('/reports/stats', authenticateToken, async (req, res) => {
  try {
    const { filters } = req.query;
    const db = await getDb();
    let whereConditions = ['1=1'];
    let queryParams = [];
    
    // Handle JSON filters
    if (filters) {
      try {
        const parsedFilters = JSON.parse(filters);
        if (Array.isArray(parsedFilters) && parsedFilters.length > 0) {
          const filterResult = buildFilterWhereClause(parsedFilters, 'account_calls');
          
          if (filterResult.whereClause) {
            whereConditions.push(filterResult.whereClause.replace(/^AND\s+/, ''));
            queryParams.push(...filterResult.params);
          }
        }
      } catch (error) {
        console.error('Error parsing filters:', error);
        return res.status(400).json({ error: 'Invalid filter format' });
      }
    }
    
    const whereClause = whereConditions.length > 1 
      ? `WHERE ${whereConditions.slice(1).join(' AND ')}` 
      : '';
    
    // Get comprehensive statistics
    const [stats] = await db.execute(`
      SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN category = 'Sale' THEN 1 END) as sales_calls,
        COUNT(CASE WHEN category = 'Follow-up' THEN 1 END) as followup_calls,
        COUNT(CASE WHEN category = 'Informational' THEN 1 END) as info_calls,
        COUNT(CASE WHEN category = 'Reminder' THEN 1 END) as reminder_calls,
        COUNT(CASE WHEN category = 'Support' THEN 1 END) as support_calls,
        COUNT(CASE WHEN category = 'Meeting' THEN 1 END) as meeting_calls,
        COUNT(CASE WHEN category = 'Negotiation' THEN 1 END) as negotiation_calls,
        COUNT(CASE WHEN call_outcome = 'Successful' THEN 1 END) as successful_calls,
        COUNT(CASE WHEN call_outcome = 'No Answer' THEN 1 END) as no_answer_calls,
        COUNT(CASE WHEN call_outcome = 'Voicemail' THEN 1 END) as voicemail_calls,
        COUNT(CASE WHEN call_outcome = 'Busy' THEN 1 END) as busy_calls,
        COUNT(CASE WHEN call_outcome = 'Disconnected' THEN 1 END) as disconnected_calls,
        COUNT(CASE WHEN call_outcome = 'Meeting Scheduled' THEN 1 END) as meetings_scheduled,
        AVG(call_duration) as avg_duration,
        SUM(call_duration) as total_duration,
        MAX(call_date) as last_call_date,
        MIN(call_date) as first_call_date,
        COUNT(DISTINCT account_id) as unique_accounts_contacted,
        COUNT(DISTINCT user_id) as unique_callers
      FROM account_calls ac
      LEFT JOIN accounts a ON ac.account_id = a.id
      ${whereClause}
    `, queryParams);
    
    // Get top callers
    const [topCallers] = await db.execute(`
      SELECT 
        ac.user_name,
        CONCAT(u.first_name, ' ', u.last_name) as logged_by_name,
        COUNT(*) as call_count,
        AVG(ac.call_duration) as avg_duration,
        COUNT(CASE WHEN ac.call_outcome = 'Successful' THEN 1 END) as successful_calls,
        COUNT(CASE WHEN ac.call_outcome = 'Meeting Scheduled' THEN 1 END) as meetings_scheduled,
        COUNT(DISTINCT ac.account_id) as unique_accounts_contacted
      FROM account_calls ac
      LEFT JOIN users u ON ac.user_id = u.id
      LEFT JOIN accounts a ON ac.account_id = a.id
      ${whereClause}
      GROUP BY ac.user_id, ac.user_name, u.first_name, u.last_name
      ORDER BY call_count DESC
      LIMIT 10
    `, queryParams);
    
    // Get calls by category breakdown
    const [categoryBreakdown] = await db.execute(`
      SELECT 
        category,
        COUNT(*) as count,
        AVG(call_duration) as avg_duration,
        COUNT(CASE WHEN call_outcome = 'Successful' THEN 1 END) as successful_count,
        COUNT(CASE WHEN call_outcome = 'Meeting Scheduled' THEN 1 END) as meetings_scheduled,
        COUNT(DISTINCT account_id) as unique_accounts
      FROM account_calls ac
      LEFT JOIN accounts a ON ac.account_id = a.id
      ${whereClause}
      GROUP BY category
      ORDER BY count DESC
    `, queryParams);

    // Get daily call volume (last 30 days or filtered range)
    const [dailyVolume] = await db.execute(`
      SELECT 
        DATE(call_date) as call_date,
        COUNT(*) as call_count,
        COUNT(CASE WHEN call_outcome = 'Successful' THEN 1 END) as successful_count,
        COUNT(CASE WHEN call_outcome = 'Meeting Scheduled' THEN 1 END) as meetings_scheduled,
        COUNT(DISTINCT account_id) as unique_accounts_contacted
      FROM account_calls ac
      LEFT JOIN accounts a ON ac.account_id = a.id
      ${whereClause}
      GROUP BY DATE(call_date)
      ORDER BY call_date DESC
      LIMIT 30
    `, queryParams);

    // ====================================================================
    // QUERY
    // ====================================================================
    // Changed a.account_name to a.name, a.company_type to a.type,
    // and a.account_status to a.type. Updated GROUP BY clause.
    const [topAccounts] = await db.execute(`
      SELECT 
        a.id as account_id,
        a.name as account_name,
        a.type as company_type,
        a.industry,
        a.type as account_status,
        COUNT(*) as call_count,
        AVG(ac.call_duration) as avg_duration,
        COUNT(CASE WHEN ac.call_outcome = 'Successful' THEN 1 END) as successful_calls,
        COUNT(CASE WHEN ac.call_outcome = 'Meeting Scheduled' THEN 1 END) as meetings_scheduled,
        MAX(ac.call_date) as last_call_date,
        MIN(ac.call_date) as first_call_date
      FROM account_calls ac
      LEFT JOIN accounts a ON ac.account_id = a.id
      ${whereClause}
      GROUP BY a.id, a.name, a.type, a.industry
      ORDER BY call_count DESC
      LIMIT 10
    `, queryParams);

    // Get calls by industry breakdown (if industry field exists)
    const [industryBreakdown] = await db.execute(`
      SELECT 
        a.industry,
        COUNT(*) as call_count,
        AVG(ac.call_duration) as avg_duration,
        COUNT(CASE WHEN ac.call_outcome = 'Successful' THEN 1 END) as successful_count,
        COUNT(CASE WHEN ac.call_outcome = 'Meeting Scheduled' THEN 1 END) as meetings_scheduled,
        COUNT(DISTINCT a.id) as unique_accounts
      FROM account_calls ac
      LEFT JOIN accounts a ON ac.account_id = a.id
      ${whereClause}
      GROUP BY a.industry
      HAVING a.industry IS NOT NULL
      ORDER BY call_count DESC
      LIMIT 10
    `, queryParams);

    // ====================================================================
    // QUERY
    // ====================================================================
    // Changed a.account_status to a.type in SELECT, GROUP BY, and HAVING.
    const [statusBreakdown] = await db.execute(`
      SELECT 
        a.type as account_status,
        COUNT(*) as call_count,
        COUNT(CASE WHEN ac.call_outcome = 'Successful' THEN 1 END) as successful_count,
        COUNT(CASE WHEN ac.call_outcome = 'Meeting Scheduled' THEN 1 END) as meetings_scheduled,
        COUNT(CASE WHEN ac.category = 'Sale' THEN 1 END) as sales_calls,
        AVG(ac.call_duration) as avg_duration
      FROM account_calls ac
      LEFT JOIN accounts a ON ac.account_id = a.id
      ${whereClause}
      GROUP BY a.type
      HAVING a.type IS NOT NULL
      ORDER BY call_count DESC
    `, queryParams);
    
    res.json({
      overview: stats[0],
      top_callers: topCallers,
      top_accounts: topAccounts,
      category_breakdown: categoryBreakdown,
      industry_breakdown: industryBreakdown,
      status_breakdown: statusBreakdown,
      daily_volume: dailyVolume
    });
    
  } catch (error) {
    console.error('Error fetching account call statistics:', error);
    res.status(500).json({ error: error.message });
  }
});

  return router;
};