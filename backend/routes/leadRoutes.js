// routes/leadRoutes.js
const express = require('express');

module.exports = (dependencies) => {
  const { 
    getDb, 
    authenticateToken, 
    requireRole,
    applyChainRulesMiddleware,
    logLeadHistory,
    generateDescription,
    leadFieldMapping,
    mapLeadFromRemote,
    buildFilterWhereClause,
    i18next,
    CampaignGoalCalculator
  } = dependencies;

  const router = express.Router();

// Helper function to fetch tasks for leads
const fetchTasksForLeads = async (db, leadIds) => {
  if (leadIds.length === 0) return {};
  
  const placeholders = leadIds.map(() => '?').join(',');
const [tasks] = await db.execute(`
  SELECT 
    t.*,
    CONCAT(u1.first_name, ' ', u1.last_name) AS assigned_to_name,
    CONCAT(u2.first_name, ' ', u2.last_name) AS created_by_name,
    COUNT(DISTINCT ts.id) AS total_subtasks,
    SUM(CASE WHEN ts.is_completed = 1 THEN 1 ELSE 0 END) AS completed_subtasks
  FROM tasks t
  LEFT JOIN users u1 ON t.assigned_to = u1.id
  LEFT JOIN users u2 ON t.created_by = u2.id
  LEFT JOIN task_subtasks ts ON t.id = ts.task_id
  WHERE t.lead_id IN (${placeholders})
  GROUP BY t.id
  ORDER BY t.created_at DESC
`, leadIds);
  
  // Group tasks by lead_id
  const tasksByLead = {};
  tasks.forEach(task => {
    if (!tasksByLead[task.lead_id]) {
      tasksByLead[task.lead_id] = [];
    }
    tasksByLead[task.lead_id].push(task);
  });
  
  return tasksByLead;
};

const fetchCustomFieldsForLeads = async (db, leadIds) => {
  if (leadIds.length === 0) return {};
  
  const placeholders = leadIds.map(() => '?').join(',');
  const [rows] = await db.execute(`
    SELECT 
      cv.record_id, 
      cd.field_name,
      cd.field_label,
      cd.field_type,
      cd.is_read_only,
      cd.is_required,
      cv.value 
    FROM custom_field_values cv
    JOIN custom_field_definitions cd ON cv.definition_id = cd.id
    WHERE cv.record_id IN (${placeholders}) AND cv.module = 'leads'
  `, leadIds);

  const customFieldsByLead = {};
  rows.forEach(row => {
    if (!customFieldsByLead[row.record_id]) {
      customFieldsByLead[row.record_id] = [];
    }
    customFieldsByLead[row.record_id].push({
      field_name: row.field_name,
      field_label: row.field_label,
      field_type: row.field_type,
      is_read_only: row.is_read_only,
      is_required: row.is_required,
      value: row.value
    });
  });

  return customFieldsByLead;
};

const saveOrUpdateCustomFields = async (db, leadId, customFieldsObject) => {
  if (!customFieldsObject || Object.keys(customFieldsObject).length === 0) {
    return;
  }

  const [definitions] = await db.execute(
    "SELECT id, field_name FROM custom_field_definitions WHERE module = 'leads'"
  );
  const definitionMap = new Map(definitions.map(def => [def.field_name, def.id]));

  for (const [fieldName, value] of Object.entries(customFieldsObject)) {
    const definitionId = definitionMap.get(fieldName);
    if (!definitionId) continue;

    let storedValue;
    if (typeof value === 'boolean') {
      storedValue = value ? '1' : '0';
    } else if (Array.isArray(value)) {
      storedValue = JSON.stringify(value);
    } else {
      storedValue = value ?? '';
    }

    const [updateResult] = await db.execute(`
      UPDATE custom_field_values 
      SET value = ? 
      WHERE definition_id = ? AND record_id = ? AND module = ?
    `, [storedValue, definitionId, leadId, 'leads']);

    if (updateResult.affectedRows === 0) {
      try {
        await db.execute(`
          INSERT INTO custom_field_values (definition_id, record_id, module, value)
          VALUES (?, ?, ?, ?)
        `, [definitionId, leadId, 'leads', storedValue]);
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          await db.execute(`
            UPDATE custom_field_values 
            SET value = ? 
            WHERE definition_id = ? AND record_id = ? AND module = ?
          `, [storedValue, definitionId, leadId, 'leads']);
        } else {
          throw error;
        }
      }
    }
  }
};

// Helper function to fetch call logs for leads
const fetchCallLogsForLeads = async (db, leadIds) => {
  if (leadIds.length === 0) return {};
  
  const placeholders = leadIds.map(() => '?').join(',');
  const [callLogs] = await db.execute(`
    SELECT 
      cl.*,
      CONCAT(u.first_name, ' ', u.last_name) as logged_by_name
    FROM call_logs cl
    LEFT JOIN users u ON cl.user_id = u.id
    WHERE cl.lead_id IN (${placeholders})
    ORDER BY cl.call_date DESC
  `, leadIds);
  
  // Group call logs by lead_id
  const callLogsByLead = {};
  callLogs.forEach(callLog => {
    if (!callLogsByLead[callLog.lead_id]) {
      callLogsByLead[callLog.lead_id] = [];
    }
    callLogsByLead[callLog.lead_id].push(callLog);
  });
  
  return callLogsByLead;
};

// Helper function to calculate task counts
const calculateTaskCounts = (tasks) => {
  if (!tasks || tasks.length === 0) {
    return { total: 0, pending: 0, completed: 0, overdue: 0 };
  }
  
  const now = new Date();
  let pending = 0;
  let completed = 0;
  let overdue = 0;
  
  tasks.forEach(task => {
    if (task.task_status === 'pending') {
      pending++;
    }

    if (task.task_status === 'completed') {
      completed++;
    }
    
    const deadline = new Date(task.deadline_date);
    if (deadline < now && !['completed', 'cancelled'].includes(task.task_status)) {
      overdue++;
    }
  });
  
  return {
    total: tasks.length,
    pending,
    completed,
    overdue
  };
};

// Helper function to calculate call counts and stats
const calculateCallCounts = (callLogs) => {
  if (!callLogs || callLogs.length === 0) {
    return { 
      total: 0, 
      recent: 0, 
      sales_calls: 0,
      last_call_date: null 
    };
  }
  
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  
  let recent = 0;
  let sales_calls = 0;
  let lastCallDate = null;
  
  callLogs.forEach(call => {
    const callDate = new Date(call.call_date);
    
    if (callDate >= thirtyDaysAgo) {
      recent++;
    }
    
    if (call.category === 'Sale') {
      sales_calls++;
    }
    
    if (!lastCallDate || callDate > lastCallDate) {
      lastCallDate = callDate;
    }
  });
  
  return {
    total: callLogs.length,
    recent,
    sales_calls,
    last_call_date: lastCallDate
  };
};

// Helper function to build search where clause
function buildSearchWhereClause(search) {
  if (!search || search.trim() === '') {
    return { whereClause: '', params: [] };
  }

  const searchTerm = `%${search.trim()}%`;
  
  // Use FULLTEXT search if you added the fulltext index
  const whereClause = `
    AND (
      MATCH(fname, lname, email_address, company_name, comments) AGAINST (? IN BOOLEAN MODE)
      OR phone_number LIKE ?
      OR city LIKE ?
      OR state LIKE ?
    )
  `;
  
  return {
    whereClause,
    params: [search.trim(), searchTerm, searchTerm, searchTerm]
  };
}

// Bulk create leads
router.post('/bulk', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const leads = req.body; // array of lead objects

    // Helper function to generate keys based on email and/or phone
    const generateKeys = (lead) => {
      const keys = [];
      if (lead.email) keys.push(`email:${lead.email.toLowerCase()}`);
      if (lead.phone) keys.push(`phone:${lead.phone}`);
      return keys;
    };

    // Step 1: filter duplicates based on email or phone, keep the most recent createdAt
    const leadMap = new Map();

    for (const lead of leads) {
      const createdAt = new Date(lead.createdAt || lead.importedAt || new Date().toISOString());

      const keys = generateKeys(lead);

      if (keys.length === 0) {
        const uniqueKey = `unique:${Math.random().toString(36).substr(2, 9)}`;
        leadMap.set(uniqueKey, { lead, createdAt });
        continue;
      }

      // For each key (email and phone), decide if to replace the existing lead
      for (const key of keys) {
        if (!leadMap.has(key)) {
          leadMap.set(key, { lead, createdAt });
        } else {
          const existing = leadMap.get(key);
          if (createdAt > existing.createdAt) {
            leadMap.set(key, { lead, createdAt });
          }
        }
      }
    }

    // Step 2: Collect unique leads from leadMap, ignoring duplicates from multiple keys
    const uniqueLeads = new Map();

    for (const { lead, createdAt } of leadMap.values()) {
      const uniqueId = lead.email?.toLowerCase() + '|' + (lead.phone ?? '');
      // Use uniqueId to prevent duplicates when lead appears under multiple keys
      if (!uniqueLeads.has(uniqueId) || createdAt > new Date(uniqueLeads.get(uniqueId).createdAt)) {
        uniqueLeads.set(uniqueId, lead);
      }
    }

    // Step 3: Insert unique leads into DB skipping duplicates already existing
    const db = await getDb();
    let insertedCount = 0;
    const skippedEmails = [];

    for (const lead of uniqueLeads.values()) {
      const email = lead.email ?? null;
      if (!email) continue;

      // Check if email already exists in DB
      const [existing] = await db.execute('SELECT id FROM leads WHERE email_address = ?', [email]);
      if (existing.length > 0) {
        skippedEmails.push(email);
        continue; // skip duplicates already in DB
      }

      const values = [
        lead.first_name ?? null,
        lead.last_name ?? null,
        email,
        lead.phone ?? null,
        lead.company ?? null,
        lead.address_line1 ?? null,
        lead.city ?? null,
        lead.state ?? null,
        lead.postal_code ?? null,
        lead.country ?? null,
        lead.website ?? null,
        lead.lead_source ?? null,
        lead.notes ?? null,
      ];

      await db.execute(
        `INSERT INTO leads (fname, lname, email_address, phone_number, company_name, address, city, state, zip_code, country, website_url, source, comments)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values
      );
      insertedCount++;
    }

    res.json({
      message: `${insertedCount} leads imported successfully.`,
      skippedDuplicates: skippedEmails,
    });

  } catch (error) {
    console.error('Bulk lead import failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all leads with pagination and search
router.get('/', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const db = await getDb();

    const {
      page,
      limit,
      search = '',
      filters,
      fields
    } = req.query;

    let parsedFilters = [];
    if (filters && filters !== '[]') {
      try {
        parsedFilters = JSON.parse(filters);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid filters format. Must be a JSON string.' });
      }
    }

    const fetchAll = !page && !limit;
    
    // Parse fields parameter for selective field return
    let selectedFields = null;
    if (fields) {
      try {
        selectedFields = fields.split(',').map(f => f.trim());
      } catch (e) {
        return res.status(400).json({ error: 'Invalid fields parameter. Use comma-separated field names.' });
      }
    }
    
    const pageNumber = fetchAll ? 1 : (parseInt(page, 10) || 1);
    const limitNumber = fetchAll ? null : (parseInt(limit, 10) || 20);

    if (!fetchAll && (pageNumber < 1 || limitNumber < 1 || limitNumber > 100)) {
      return res.status(400).json({ 
        error: 'Invalid pagination parameters. Page must be >= 1, limit must be 1-100' 
      });
    }
    
    const { whereClause: searchWhere, params: searchParams } = buildSearchWhereClause(search);
    const { whereClause: filterWhere, params: filterParams } = buildFilterWhereClause(parsedFilters, 'leads');

    const finalWhereClause = `${searchWhere} ${filterWhere}`;
    const finalParams = [...searchParams, ...filterParams];

    let totalItems = null;
    if (!fetchAll) {
      const countQuery = `SELECT COUNT(*) as total FROM leads WHERE 1=1 ${finalWhereClause}`;
      const [countResult] = await db.execute(countQuery, finalParams);
      totalItems = countResult[0].total;
    }
    const mainQueryStartTime = Date.now();
    let selectFields = '*';
    if (selectedFields && selectedFields.length > 0) {
      const fieldsWithId = selectedFields.includes('id') ? selectedFields : ['id', ...selectedFields];
      selectFields = fieldsWithId.join(', ');
    }

    // Build optimized query
    let leadsQuery, queryParams;
    
    if (fetchAll) {
      leadsQuery = `
        SELECT ${selectFields} FROM leads 
        WHERE 1=1 ${finalWhereClause}
        ORDER BY created_at DESC
      `;
      queryParams = finalParams;
    } else {
      const offset = (pageNumber - 1) * limitNumber;
      
      leadsQuery = `
        SELECT ${selectFields} FROM leads 
        WHERE 1=1 ${finalWhereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      queryParams = [...finalParams, limitNumber, offset];
    }
    
    const [rows] = await db.execute(leadsQuery, queryParams);

    const mappedLeads = rows.map(mapLeadFromRemote);
    // Function to filter fields if specified (only needed if selecting * from DB)
    const filterFields = (lead) => {
      if (!selectedFields || selectFields !== '*') return lead;
      
      const filtered = {};
      selectedFields.forEach(field => {
        if (lead.hasOwnProperty(field)) {
          filtered[field] = lead[field];
        }
      });
      return filtered;
    };
    
    let finalLeads;
    
    if (fetchAll) {
      finalLeads = mappedLeads.map(filterFields);
    } else {
      // When paginating, include full data with tasks and calls
      const leadIds = mappedLeads.map(lead => lead.id);
      
      const tasksByLead = await fetchTasksForLeads(db, leadIds);
      const callLogsByLead = await fetchCallLogsForLeads(db, leadIds);
      const customFieldsByLead = await fetchCustomFieldsForLeads(db, leadIds);

      finalLeads = mappedLeads.map(lead => {
        const tasks = tasksByLead[lead.id] || [];
        const callLogs = callLogsByLead[lead.id] || [];
        const custom_fields = customFieldsByLead[lead.id] || [];
        const fullLead = {
          ...lead,
          tasks,
          call_logs: callLogs,
          task_counts: calculateTaskCounts(tasks),
          call_counts: calculateCallCounts(callLogs),
          custom_fields
        };
        
        return filterFields(fullLead);
      });
    }

    const responseStartTime = Date.now();

    // Build response object
    const response = {
      data: finalLeads
    };

    if (!fetchAll) {
      const offset = (pageNumber - 1) * limitNumber;
      const totalPages = Math.ceil(totalItems / limitNumber);
      
      response.pagination = {
        currentPage: pageNumber,
        totalPages,
        total: totalItems,
        limit: limitNumber,
        hasNext: pageNumber < totalPages,
        hasPrev: pageNumber > 1,
        showing: {
          from: totalItems > 0 ? offset + 1 : 0,
          to: Math.min(offset + limitNumber, totalItems)
        }
      };
    } else {
      response.total = finalLeads.length;
    }
    
    console.log(`Response prep took: ${Date.now() - responseStartTime}ms`);
    console.log(`Total request took: ${Date.now() - startTime}ms`);
    
    res.json(response);
    
  } catch (error) {
    console.error('Error fetching leads:', error);
    console.log(`Failed request took: ${Date.now() - startTime}ms`);
    res.status(500).json({ error: error.message });
  }
});

// CREATE lead
router.post('/', authenticateToken, requireRole('user'), applyChainRulesMiddleware, async (req, res) => {
  const db = await getDb();
  await db.execute('START TRANSACTION');
  try {
    const {
      first_name, last_name, email, phone, company, address_line1,
      city, state, postal_code, country, website, lead_source, notes, custom_fields 
    } = req.body;

    const [result] = await db.execute(`
      INSERT INTO leads (fname, lname, email_address, phone_number, company_name, 
                        address, city, state, zip_code, country, website_url, source, comments)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      first_name, last_name, email, phone, company, address_line1,
      city, state, postal_code, country, website, lead_source, notes
    ]);

    const leadId = result.insertId;
    await saveOrUpdateCustomFields(db, leadId, custom_fields);
    
    const userName = `${req.user.first_name} ${req.user.last_name}`;
    const userLanguage = req.user.language || 'en';
    const t = i18next.getFixedT(userLanguage);

    const description = generateDescription(t, 'created', { userName });
    
    await logLeadHistory(leadId, req.user.id, userName, 'created', null, null, null, description);
    
    // Log chain rule applications if any were applied
    if (req.appliedChainRules && req.appliedChainRules.length > 0) {
      for (const rule of req.appliedChainRules) {
        const description = `${userName} triggered chain rule "${rule.rule_name}": ${rule.source_field} → ${rule.target_field} = "${rule.target_value}"`;
        await logLeadHistory(
          leadId, 
          req.user.id, 
          userName,
          'chain_rule_applied', 
          rule.target_field, 
          null, 
          rule.target_value, 
          description
        );
      }
    }

const [relevantCampaigns] = await db.execute(`
    SELECT id FROM campaigns
    WHERE status = 'active'
      AND campaign_type = 'lead'
      AND auto_join = TRUE
      AND (
        is_open_campaign = TRUE
        OR (start_date IS NOT NULL AND end_date IS NOT NULL AND CURDATE() BETWEEN DATE(start_date) AND DATE(end_date))
      )
`);


    if (relevantCampaigns.length > 0) {
        console.log(`Adding new lead ${leadId} to ${relevantCampaigns.length} relevant campaigns.`);
        for (const campaign of relevantCampaigns) {
            await db.execute(`
                INSERT IGNORE INTO campaign_participants (campaign_id, entity_type, entity_id)
                VALUES (?, 'lead', ?)
            `, [campaign.id, leadId]);

            await db.execute(`
                INSERT INTO campaign_activities
                (campaign_id, entity_type, entity_id, activity_type, activity_description, created_by)
                VALUES (?, 'lead', ?, 'joined', 'Automatically added to active campaign', ?)
            `, [campaign.id, leadId, req.user.id]);

            await db.execute(`
              UPDATE leads
              SET campaign_ids = JSON_ARRAY_APPEND(
                COALESCE(campaign_ids, JSON_ARRAY()),
                '$',
                ?
              )
              WHERE id = ? AND NOT JSON_CONTAINS(COALESCE(campaign_ids, JSON_ARRAY()), CAST(? AS CHAR), '$')
            `, [campaign.id, leadId, campaign.id]);

             await CampaignGoalCalculator.calculateCampaignProgress(campaign.id);
        }
    }

    
    await db.execute('COMMIT');
    res.json({ 
      id: leadId, 
      message: 'Lead created successfully',
      chain_rules_applied: req.appliedChainRules || []
    });
    
  } catch (error) {
    await db.execute('ROLLBACK');
    console.error('Error creating lead:', error);
    res.status(500).json({ error: error.message });
  }
});

// UPDATE lead
router.put('/:id', authenticateToken, requireRole('user'), applyChainRulesMiddleware, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const { custom_fields, ...standardUpdates } = updates;
  const db = await getDb();
  await db.execute('START TRANSACTION');
  try {
    const [currentRows] = await db.execute('SELECT * FROM leads WHERE id = ?', [id]);
    
    if (currentRows.length === 0) {
      await db.execute('ROLLBACK');
      return res.status(404).json({ error: 'Lead not found' });
    }

    const currentLead = currentRows[0];
    const updateFields = [];
    const updateValues = [];
    const changes = [];

    for (const [localField, newValue] of Object.entries(standardUpdates)) {
      const remoteField = leadFieldMapping[localField];
      if (remoteField && currentLead[remoteField] !== newValue) {
        updateFields.push(`${remoteField} = ?`);
        updateValues.push(newValue);
        changes.push({
          field_name: localField,
          old_value: currentLead[remoteField],
          new_value: newValue
        });
      }
    }

    await saveOrUpdateCustomFields(db, id, custom_fields);

    if (updateFields.length > 0) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(id);
      
      await db.execute(
        `UPDATE leads SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
    }

    const hasChanges = updateFields.length > 0 || (custom_fields && Object.keys(custom_fields).length > 0);
    
    if (!hasChanges) {
      await db.execute('COMMIT');
      return res.json({ message: 'No changes to update' });
    }

    const userName = `${req.user.first_name} ${req.user.last_name}`;
    const userLanguage = req.user.language || 'en';
    const t = i18next.getFixedT(userLanguage);

    for (const change of changes) {
      const actionType = change.field_name === 'status' ? 'status_changed' : 'updated';
      const description = generateDescription(
        t, 
        actionType, 
        {
          userName,
          fieldName: change.field_name,
          oldValue: change.old_value,
          newValue: change.new_value
        }
      );
      
      await logLeadHistory(
        id, 
        req.user.id, 
        userName,
        actionType, 
        change.field_name, 
        change.old_value, 
        change.new_value, 
        description
      );
    }

    if (req.appliedChainRules && req.appliedChainRules.length > 0) {
      for (const rule of req.appliedChainRules) {
        const description = `${userName} triggered chain rule "${rule.rule_name}": ${rule.source_field} → ${rule.target_field} = "${rule.target_value}"`;
        await logLeadHistory(
          id, 
          req.user.id, 
          userName,
          'chain_rule_applied', 
          rule.target_field, 
          null, 
          rule.target_value, 
          description
        );
      }
    }

    if (changes.length === 0 && custom_fields && Object.keys(custom_fields).length > 0) {
      const description = `${userName} updated custom fields`;
      await logLeadHistory(
        id, 
        req.user.id, 
        userName,
        'updated', 
        null, 
        null, 
        null, 
        description
      );
    }

    await db.execute('COMMIT');

    try {
      const statusChange = changes.find(c => c.field_name === 'status');
      if (statusChange) {
        await CampaignGoalCalculator.triggerGoalCalculation(
          'lead', 
          id, 
          'status_changed',
          { old_status: statusChange.old_value, new_status: statusChange.new_value }
        );
      }

const [newlyRelevantCampaigns] = await db.execute(`
    SELECT id FROM campaigns c
    WHERE c.status = 'active'
      AND c.campaign_type = 'lead'
      AND c.auto_join = TRUE
      AND c.goal_type != 'new_added'
      AND (
        c.is_open_campaign = TRUE
        OR (c.start_date IS NOT NULL AND c.end_date IS NOT NULL AND CURDATE() BETWEEN DATE(start_date) AND DATE(end_date))
      )
      AND NOT EXISTS (
        SELECT 1 FROM campaign_participants cp
        WHERE cp.campaign_id = c.id
          AND cp.entity_type = 'lead'
          AND cp.entity_id = ?
      )
`, [id]);

      if (newlyRelevantCampaigns.length > 0) {
        console.log(`Lead ${id} became eligible for ${newlyRelevantCampaigns.length} new campaigns after update.`);
        for (const campaign of newlyRelevantCampaigns) {
          await db.execute(
            `INSERT IGNORE INTO campaign_participants (campaign_id, entity_type, entity_id) VALUES (?, 'lead', ?)`,
            [campaign.id, id]
          );

          await db.execute(
            `INSERT INTO campaign_activities (campaign_id, entity_type, entity_id, activity_type, activity_description, created_by) VALUES (?, 'lead', ?, 'joined', 'Automatically added to campaign after update', ?)`,
            [campaign.id, id, req.user.id]
          );
          
          await db.execute(`
              UPDATE leads
              SET campaign_ids = JSON_ARRAY_APPEND(COALESCE(campaign_ids, JSON_ARRAY()), '$', ?)
              WHERE id = ? AND NOT JSON_CONTAINS(COALESCE(campaign_ids, JSON_ARRAY()), CAST(? AS CHAR), '$')
            `, [campaign.id, id, campaign.id]);

          await CampaignGoalCalculator.calculateCampaignProgress(campaign.id);
        }
      }
    } catch (campaignError) {
      console.error(`Error processing campaign logic for lead ${id} after update:`, campaignError);
    }

    res.json({ 
      message: 'Lead updated successfully',
      changes_count: changes.length,
      chain_rules_applied: req.appliedChainRules || []
    });
    
  } catch (error) {
    await db.execute('ROLLBACK');
    console.error('Error updating lead:', error);
    res.status(500).json({ error: error.message });
  }
});

// CONVERT lead
router.post('/:id/convert', authenticateToken, requireRole('user'), async (req, res) => {
  const { id } = req.params;
  const accountData = req.body;
  const db = await getDb();
  await db.execute('START TRANSACTION');

  try {
    try {
      const [leadCustomFields] = await db.execute(`
        SELECT cv.*, cd.field_name, cd.field_type, cd.field_label, cd.is_read_only
        FROM custom_field_values cv
        JOIN custom_field_definitions cd ON cv.definition_id = cd.id
        WHERE cv.record_id = ? AND cv.module = 'leads'
      `, [id]);

      const [accountResult] = await db.execute(`
        INSERT INTO accounts (
          name, type, industry, revenue, employees, company_name,
          contact_fname, contact_lname, contact_email, contact_phone,
          billing_address, billing_city, billing_state, billing_zip, billing_country,
          website_url, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        accountData.account_name ?? null,
        accountData.account_type ?? null,
        accountData.company_name ?? null,
        accountData.industry ?? null,
        accountData.annual_revenue ?? null,
        accountData.employee_count ?? null,
        accountData.primary_contact_first_name ?? null,
        accountData.primary_contact_last_name ?? null,
        accountData.primary_contact_email ?? null,
        accountData.primary_contact_phone ?? null,
        accountData.billing_address_line1 ?? null,
        accountData.billing_city ?? null,
        accountData.billing_state ?? null,
        accountData.billing_postal_code ?? null,
        accountData.billing_country ?? null,
        accountData.website ?? null,
        accountData.description ?? null
      ]);
      
      const accountId = accountResult.insertId;

      let customFieldTransfers = [];
      let transferredFieldsCount = 0;
      
      if (leadCustomFields.length > 0) {
        const leadFieldIds = leadCustomFields.map(cf => cf.definition_id);
        const [mappings] = await db.execute(`
          SELECT cfm.*, 
                 lcd.field_name as lead_field_name,
                 lcd.field_type as lead_field_type,
                 lcd.field_label as lead_field_label,
                 acd.field_name as account_field_name,
                 acd.field_type as account_field_type,
                 acd.field_label as account_field_label,
                 acd.id as account_field_def_id
          FROM custom_field_mappings cfm
          JOIN custom_field_definitions lcd ON cfm.lead_field_id = lcd.id
          JOIN custom_field_definitions acd ON cfm.account_field_id = acd.id
          WHERE cfm.lead_field_id IN (${leadFieldIds.map(() => '?').join(',')})
        `, leadFieldIds);

        const mappingLookup = new Map(
          mappings.map(m => [m.lead_field_id, m])
        );
        
        for (const leadField of leadCustomFields) {
          const mapping = mappingLookup.get(leadField.definition_id);
          
          if (mapping) {
            const FIELD_TYPE_COMPATIBILITY = {
              'TEXT': ['TEXT', 'TEXTAREA'],
              'TEXTAREA': ['TEXT', 'TEXTAREA'],
              'NUMBER': ['NUMBER'],
              'DATE': ['DATE'],
              'BOOLEAN': ['BOOLEAN']
            };
            
            const compatibleTypes = FIELD_TYPE_COMPATIBILITY[mapping.lead_field_type];
            const isCompatible = compatibleTypes && compatibleTypes.includes(mapping.account_field_type);
            
            if (!isCompatible) {
              continue;
            }
            
            if (mapping.mapping_type === 'DIRECT') {
              let transferValue = leadField.value;
              
              if (mapping.account_field_type === 'BOOLEAN') {
                if (typeof transferValue === 'boolean') {
                  transferValue = transferValue ? '1' : '0';
                } else if (transferValue === 'true' || transferValue === '1') {
                  transferValue = '1';
                } else if (transferValue === 'false' || transferValue === '0') {
                  transferValue = '0';
                }
              }
              
              customFieldTransfers.push({
                definition_id: mapping.account_field_def_id,
                record_id: accountId,
                module: 'accounts', 
                value: transferValue,
                source_field: leadField.field_name
              });
              
              transferredFieldsCount++;
            }
          }
        }

        if (customFieldTransfers.length > 0) {
          for (const cf of customFieldTransfers) {
            try {
              await db.execute(`
                INSERT INTO custom_field_values (definition_id, record_id, module, value)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = CURRENT_TIMESTAMP
              `, [cf.definition_id, cf.record_id, cf.module, cf.value]);
            } catch (insertError) {
              console.error(`Error inserting custom field (def_id: ${cf.definition_id}):`, insertError);
            }
          }
        }
      }

      await db.execute(`
        UPDATE relationships
        SET entity_type = 'account', entity_id = ?
        WHERE entity_type = 'lead' AND entity_id = ?
      `, [accountId, id]);

      await db.execute(`
        UPDATE relationships
        SET related_type = 'account', related_id = ?
        WHERE related_type = 'lead' AND related_id = ?
      `, [accountId, id]);
      
      await db.execute(
        'UPDATE leads SET lead_status = ?, converted_account_id = ? WHERE id = ?', 
        ['converted', accountId, id]
      );

      const userName = `${req.user.first_name} ${req.user.last_name}`;
      const description = `${userName} converted the lead to an account (ID: ${accountId})`;
      
      await logLeadHistory(id, req.user.id, userName, 'converted', null, null, null, description);

      // Add converted lead to relevant conversion campaigns
      const [relevantConversionCampaigns] = await db.execute(`
        SELECT id FROM campaigns
        WHERE status = 'active'
          AND campaign_type = 'lead' 
          AND goal_type = 'conversion'
          AND auto_join = TRUE
          AND (
            is_open_campaign = TRUE
            OR (start_date IS NOT NULL AND end_date IS NOT NULL AND CURDATE() BETWEEN DATE(start_date) AND DATE(end_date))
          )
          AND NOT EXISTS (
            SELECT 1 FROM campaign_participants cp
            WHERE cp.campaign_id = campaigns.id
              AND cp.entity_type = 'lead'
              AND cp.entity_id = ?
          )
      `, [id]);

      if (relevantConversionCampaigns.length > 0) {
        console.log(`Adding converted lead ${id} to ${relevantConversionCampaigns.length} conversion campaigns.`);
        for (const campaign of relevantConversionCampaigns) {
          await db.execute(`
            INSERT INTO campaign_participants (campaign_id, entity_type, entity_id)
            VALUES (?, 'lead', ?)
          `, [campaign.id, id]);

await db.execute(`
  INSERT INTO campaign_activities
  (campaign_id, entity_type, entity_id, activity_type, activity_description, created_by, value_contributed)
  VALUES (?, 'lead', ?, 'converted', 'Lead converted to account', ?, 1)
`, [campaign.id, id, req.user.id]);

          await db.execute(`
            UPDATE leads
            SET campaign_ids = JSON_ARRAY_APPEND(
              COALESCE(campaign_ids, JSON_ARRAY()),
              '$',
              ?
            )
            WHERE id = ? AND NOT JSON_CONTAINS(COALESCE(campaign_ids, JSON_ARRAY()), CAST(? AS CHAR), '$')
          `, [campaign.id, id, campaign.id]);

          await CampaignGoalCalculator.calculateCampaignProgress(campaign.id);
        }
      }

      await db.execute('COMMIT');

      try {
        await CampaignGoalCalculator.triggerGoalCalculation(
          'lead', 
          id, 
          'status_changed',
          { new_status: 'converted' }
        );
      } catch (calcError) {
        console.error(`Error triggering goal calculation for lead ${id} after conversion:`, calcError);
      }

      res.json({ 
        account_id: accountId, 
        message: 'Lead converted to account successfully',
        original_custom_fields: leadCustomFields.length,
        transferred_fields: customFieldTransfers.length,
        added_to_conversion_campaigns: relevantConversionCampaigns.length,
      });
      
    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Error converting lead:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE lead
router.delete('/:id', authenticateToken, requireRole('manager'), async (req, res) => {
  const { id } = req.params;
  const db = await getDb();

  // Start a transaction to ensure atomicity
  await db.execute('START TRANSACTION');

  try {
    // Check if lead exists
    const [leadRows] = await db.execute('SELECT * FROM leads WHERE id = ?', [id]);
    
    if (leadRows.length === 0) {
      await db.execute('ROLLBACK');
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    // 1. Find associated documents
    const [docsToDelete] = await db.execute(
      `SELECT id, file_path FROM docs WHERE related_to_entity = 'lead' AND related_to_id = ?`,
      [id]
    );

    if (docsToDelete.length > 0) {
      for (const doc of docsToDelete) {
        try {
          await fs.unlink(doc.file_path);
        } catch (fileError) {
          console.error(`Could not delete file ${doc.file_path}:`, fileError.message);
        }
      }

      // 3. Delete document records from the database
      const docIds = docsToDelete.map(d => d.id);
      await db.execute(`DELETE FROM docs WHERE id IN (${docIds.map(() => '?').join(',')})`, docIds);
    }

    // Log deletion BEFORE actually deleting
    const userName = `${req.user.first_name} ${req.user.last_name}`;
    const description = `${userName} deleted the lead`;
    await logLeadHistory(id, req.user.id, userName, 'deleted', null, null, null, description);

    // 4. Delete all relationships associated with this lead
    await db.execute(
      `DELETE FROM relationships 
       WHERE (entity_type = 'lead' AND entity_id = ?) 
          OR (related_type = 'lead' AND related_id = ?)`,
      [id, id]
    );

    // 5. Delete the lead itself
    const [deleteResult] = await db.execute('DELETE FROM leads WHERE id = ?', [id]);

    if (deleteResult.affectedRows === 0) {
      await db.execute('ROLLBACK');
      return res.status(404).json({ error: 'Lead could not be deleted' });
    }

    await db.execute('COMMIT');

    res.json({ 
      success: true, 
      deletedId: id,
      message: 'Lead, associated relationships, and documents deleted successfully'
    });

  } catch (error) {
    await db.execute('ROLLBACK');
    console.error('Error deleting lead:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// BATCH DELETE leads
router.delete('/batch', authenticateToken, requireRole('manager'), async (req, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Invalid or empty IDs array' });
  }

  const results = {
    deleted: [],
    failed: []
  };

  try {
    const db = await getDb();
    for (const id of ids) {
      try {
        // Check if lead exists
        const [leadRows] = await db.execute('SELECT * FROM leads WHERE id = ?', [id]);
        
        if (leadRows.length === 0) {
          results.failed.push({ id, error: 'Lead not found' });
          continue;
        }

        // Log deletion before actually deleting
        const userName = `${req.user.first_name} ${req.user.last_name}`;
        const description = `${userName} deleted the lead`;
        
        await logLeadHistory(id, req.user.id, userName, 'deleted', null, null, null, description);

        // Delete from database (cascade will handle call_logs deletion)
        const [deleteResult] = await db.execute('DELETE FROM leads WHERE id = ?', [id]);

        if (deleteResult.affectedRows === 0) {
          results.failed.push({ id, error: 'Lead not found' });
          continue;
        }

        results.deleted.push({ id });

      } catch (error) {
        console.error(`Error deleting lead ${id}:`, error);
        results.failed.push({ id, error: error.message });
      }
    }

    res.json({
      success: true,
      results,
      message: `Deleted ${results.deleted.length} leads, ${results.failed.length} failed`
    });

  } catch (error) {
    console.error('Error in batch delete:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get lead history
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const leadId = req.params.id;
    const db = await getDb();
    
    // First verify the lead exists
    const [leadRows] = await db.execute('SELECT id FROM leads WHERE id = ?', [leadId]);
    
    if (leadRows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    // Get history
    const [history] = await db.execute(`
      SELECT * FROM lead_history 
      WHERE lead_id = ? 
      ORDER BY created_at DESC
    `, [leadId]);
    
    res.json(history);
  } catch (error) {
    console.error('Error fetching lead history:', error);
    res.status(500).json({ error: 'Failed to fetch lead history' });
  }
});

// Get tasks related to a specific lead (kept for backward compatibility)
router.get('/:id/tasks', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const db = await getDb();
    const [tasks] = await db.execute(`
      SELECT 
        t.*,
        CONCAT(u1.first_name, ' ', u1.last_name) as assigned_to_name,
        CONCAT(u2.first_name, ' ', u2.last_name) as created_by_name
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      WHERE t.lead_id = ?
      ORDER BY t.created_at DESC
    `, [id]);
    
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching lead tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get call logs for a specific lead (convenience endpoint)
router.get('/:id/calls', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const db = await getDb();
    
    // Verify lead exists
    const [leadRows] = await db.execute('SELECT id FROM leads WHERE id = ?', [id]);
    if (leadRows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    // Get call logs
    const [callLogs] = await db.execute(`
      SELECT 
        cl.*,
        CONCAT(u.first_name, ' ', u.last_name) as logged_by_name
      FROM call_logs cl
      LEFT JOIN users u ON cl.user_id = u.id
      WHERE cl.lead_id = ?
      ORDER BY cl.call_date DESC
    `, [id]);
    
    res.json(callLogs);
  } catch (error) {
    console.error('Error fetching lead call logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search leads with their tasks and call logs (DEPRECATED - use GET / with search param instead)
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Redirect to main endpoint with search parameter
    req.query.search = q;
    delete req.query.q;
    
    // Call the main GET handler
    return router.stack.find(layer => 
      layer.route?.path === '/' && layer.route?.methods.get
    ).route.stack[0].handle(req, res);
    
  } catch (error) {
    console.error('Error searching leads:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get recipient count estimate for leads
router.get('/count', async (req, res) => {
  try {
    const db = await getDb();
    const { filters } = req.query;

    let parsedFilters = [];
    if (filters) {
      try {
        // The filter comes in as a JSON string, so we parse it
        parsedFilters = JSON.parse(filters);
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'Invalid filter format. Must be a valid JSON string.'
        });
      }
    }

    // Use your existing filter-building logic
    const { whereClause, params } = buildFilterWhereClause(parsedFilters, 'leads');

    // Base query for valid emails
    const baseQuery = `
      SELECT COUNT(*) as count 
      FROM leads 
      WHERE email_address IS NOT NULL 
      AND email_address != ''
      AND email_address REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}'
    `;

    // Combine the base query with the dynamic filter clause
    // Note: buildFilterWhereClause already adds the initial "AND"
    const finalQuery = `${baseQuery} ${whereClause}`;

    const [result] = await db.execute(finalQuery, params);

    res.json({ success: true, count: result[0].count });
  } catch (error) {
    console.error('Error getting leads count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get leads count',
      details: error.message
    });
  }
});

  return router;
};