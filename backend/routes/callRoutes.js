// routes/callRoutes.js
const express = require('express');

module.exports = (dependencies) => {
const { getDb, authenticateToken, requireRole, buildFilterWhereClause } = dependencies;
const router = express.Router();
// Get all call logs for a specific lead
router.get('/lead/:leadId', authenticateToken, async (req, res) => {
  try {
    const { leadId } = req.params;
    const db = await getDb();
    
    // Verify lead exists
    const [leadRows] = await db.execute('SELECT id FROM leads WHERE id = ?', [leadId]);
    if (leadRows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    // Get call logs for this lead
    const [callLogs] = await db.execute(`
      SELECT 
        cl.*,
        CONCAT(u.first_name, ' ', u.last_name) as logged_by_name
      FROM call_logs cl
      LEFT JOIN users u ON cl.user_id = u.id
      WHERE cl.lead_id = ?
      ORDER BY cl.call_date DESC, cl.created_at DESC
    `, [leadId]);
    
    res.json(callLogs);
  } catch (error) {
    console.error('Error fetching call logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all call logs (for reporting/overview)
// Get all call logs (for reporting/overview)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const { limit, offset, leadId, category, userId } = req.query;
    
    // Determine if pagination should be used
    const usePagination = limit !== undefined || offset !== undefined;
    const limitNum = parseInt(limit) || 50;
    const offsetNum = parseInt(offset) || 0;
    
    let whereConditions = [];
    let queryParams = [];
    
    // Add filters
    if (leadId) {
      whereConditions.push('cl.lead_id = ?');
      queryParams.push(leadId);
    }
    
    if (category) {
      whereConditions.push('cl.category = ?');
      queryParams.push(category);
    }
    
    if (userId) {
      whereConditions.push('cl.user_id = ?');
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
        cl.*,
        CONCAT(u.first_name, ' ', u.last_name) as logged_by_name,
        CONCAT(l.fname, ' ', l.lname) as lead_name,
        l.company_name as lead_company
      FROM call_logs cl
      LEFT JOIN users u ON cl.user_id = u.id
      LEFT JOIN leads l ON cl.lead_id = l.id
      ${whereClause}
      ORDER BY cl.call_date DESC, cl.created_at DESC
      ${paginationClause}
    `, finalParams);
    
    // Get total count for pagination
    const [countResult] = await db.execute(`
      SELECT COUNT(*) as total
      FROM call_logs cl
      LEFT JOIN leads l ON cl.lead_id = l.id
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
    console.error('Error fetching call logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new call log
router.post('/', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const {
      lead_id,
      category,
      notes,
      call_duration,
      call_outcome,
      call_date
    } = req.body;

    // Validation
    if (!lead_id || !category || !call_date) {
      return res.status(400).json({ 
        error: 'lead_id, category, and call_date are required' 
      });
    }

    const validCategories = ['Informational', 'Reminder', 'Sale', 'Follow-up', 'Support'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ 
        error: `Invalid category. Must be one of: ${validCategories.join(', ')}` 
      });
    }

    const validOutcomes = ['Successful', 'No Answer', 'Voicemail', 'Busy', 'Disconnected'];
    if (call_outcome && !validOutcomes.includes(call_outcome)) {
      return res.status(400).json({ 
        error: `Invalid call outcome. Must be one of: ${validOutcomes.join(', ')}` 
      });
    }

    const db = await getDb();
    
    // Verify lead exists
    const [leadRows] = await db.execute('SELECT id FROM leads WHERE id = ?', [lead_id]);
    if (leadRows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const userName = `${req.user.first_name} ${req.user.last_name}`;

    // Insert call log
    const [result] = await db.execute(`
      INSERT INTO call_logs (
        lead_id, user_id, user_name, category, notes, 
        call_duration, call_outcome, call_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      lead_id,
      req.user.id,
      userName,
      category,
      notes || null,
      call_duration || null,
      call_outcome || 'Successful',
      call_date
    ]);

    const callLogId = result.insertId;

    // Get the created call log with user details
    const [newCallLog] = await db.execute(`
      SELECT 
        cl.*,
        CONCAT(u.first_name, ' ', u.last_name) as logged_by_name
      FROM call_logs cl
      LEFT JOIN users u ON cl.user_id = u.id
      WHERE cl.id = ?
    `, [callLogId]);

    res.status(201).json({
      id: callLogId,
      call: newCallLog[0],
      message: 'Call logged successfully'
    });

  } catch (error) {
    console.error('Error creating call log:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a call log
router.put('/:id', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      category,
      notes,
      call_duration,
      call_outcome,
      call_date
    } = req.body;

    const db = await getDb();
    
    // Check if call log exists and user owns it (or is manager)
    const [callLogRows] = await db.execute(`
      SELECT * FROM call_logs WHERE id = ?
    `, [id]);
    
    if (callLogRows.length === 0) {
      return res.status(404).json({ error: 'Call log not found' });
    }
    
    const callLog = callLogRows[0];
    
    // Only allow the user who created the call or managers to edit
    if (callLog.user_id !== req.user.id && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Insufficient permissions to edit this call log' });
    }

    // Validate category if provided
    if (category) {
      const validCategories = ['Informational', 'Reminder', 'Sale', 'Follow-up', 'Support'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({ 
          error: `Invalid category. Must be one of: ${validCategories.join(', ')}` 
        });
      }
    }

    // Validate call outcome if provided
    if (call_outcome) {
      const validOutcomes = ['Successful', 'No Answer', 'Voicemail', 'Busy', 'Disconnected'];
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

    if (updateFields.length === 0) {
      return res.json({ message: 'No changes to update' });
    }

    // Add updated_at
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);

    await db.execute(
      `UPDATE call_logs SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Get updated call log
    const [updatedCallLog] = await db.execute(`
      SELECT 
        cl.*,
        CONCAT(u.first_name, ' ', u.last_name) as logged_by_name
      FROM call_logs cl
      LEFT JOIN users u ON cl.user_id = u.id
      WHERE cl.id = ?
    `, [id]);

    res.json({
      call: updatedCallLog[0],
      message: 'Call log updated successfully'
    });

  } catch (error) {
    console.error('Error updating call log:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a call log
router.delete('/:id', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    
    // Check if call log exists and user owns it (or is manager)
    const [callLogRows] = await db.execute(`
      SELECT * FROM call_logs WHERE id = ?
    `, [id]);
    
    if (callLogRows.length === 0) {
      return res.status(404).json({ error: 'Call log not found' });
    }
    
    const callLog = callLogRows[0];
    
    // Only allow the user who created the call or managers to delete
    if (callLog.user_id !== req.user.id && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Insufficient permissions to delete this call log' });
    }

    // Delete the call log
    const [deleteResult] = await db.execute('DELETE FROM call_logs WHERE id = ?', [id]);

    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({ error: 'Call log not found' });
    }

    res.json({ 
      success: true,
      deletedId: parseInt(id),
      message: 'Call log deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting call log:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get call statistics for a lead
router.get('/lead/:leadId/stats', authenticateToken, async (req, res) => {
  try {
    const { leadId } = req.params;
    const db = await getDb();
    
    // Verify lead exists
    const [leadRows] = await db.execute('SELECT id FROM leads WHERE id = ?', [leadId]);
    if (leadRows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    // Get call statistics
    const [stats] = await db.execute(`
      SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN category = 'Sale' THEN 1 END) as sales_calls,
        COUNT(CASE WHEN category = 'Follow-up' THEN 1 END) as followup_calls,
        COUNT(CASE WHEN category = 'Informational' THEN 1 END) as info_calls,
        COUNT(CASE WHEN call_outcome = 'Successful' THEN 1 END) as successful_calls,
        AVG(call_duration) as avg_duration,
        MAX(call_date) as last_call_date,
        MIN(call_date) as first_call_date
      FROM call_logs 
      WHERE lead_id = ?
    `, [leadId]);
    
    // Get call history by category
    const [categoryBreakdown] = await db.execute(`
      SELECT 
        category,
        COUNT(*) as count,
        AVG(call_duration) as avg_duration
      FROM call_logs 
      WHERE lead_id = ?
      GROUP BY category
      ORDER BY count DESC
    `, [leadId]);
    
    res.json({
      stats: stats[0],
      category_breakdown: categoryBreakdown
    });
    
  } catch (error) {
    console.error('Error fetching call statistics:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/reports', authenticateToken, async (req, res) => {
  try {
    const { 
      page, 
      limit, 
      filters,
      leadId, 
      category, 
      userId,
      call_outcome,
      start_date,
      end_date
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
          const filterResult = buildFilterWhereClause(parsedFilters, 'calls');
          
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
    if (leadId) {
      whereConditions.push('cl.lead_id = ?');
      queryParams.push(leadId);
    }
    
    if (category) {
      whereConditions.push('cl.category = ?');
      queryParams.push(category);
    }
    
    if (userId) {
      whereConditions.push('cl.user_id = ?');
      queryParams.push(userId);
    }

    if (call_outcome) {
      whereConditions.push('cl.call_outcome = ?');
      queryParams.push(call_outcome);
    }

    if (start_date) {
      whereConditions.push('DATE(cl.call_date) >= ?');
      queryParams.push(start_date);
    }

    if (end_date) {
      whereConditions.push('DATE(cl.call_date) <= ?');
      queryParams.push(end_date);
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
    
    // Main query for call reports
    const [callReports] = await db.execute(`
      SELECT 
        cl.id,
        cl.lead_id,
        cl.user_id,
        cl.user_name,
        cl.category,
        cl.notes,
        cl.call_duration,
        cl.call_outcome,
        cl.call_date,
        cl.created_at,
        cl.updated_at,
        CONCAT(u.first_name, ' ', u.last_name) as logged_by_name,
        CONCAT(l.fname, ' ', l.lname) as lead_name,
        l.company_name as lead_company,
        l.email_address as lead_email,
        l.phone_number as lead_phone
      FROM call_logs cl
      LEFT JOIN users u ON cl.user_id = u.id
      LEFT JOIN leads l ON cl.lead_id = l.id
      ${whereClause}
      ORDER BY cl.call_date DESC, cl.created_at DESC
      ${paginationClause}
    `, finalParams);
    
    // Get total count
    const [countResult] = await db.execute(`
      SELECT COUNT(*) as total
      FROM call_logs cl
      LEFT JOIN leads l ON cl.lead_id = l.id
      LEFT JOIN users u ON cl.user_id = u.id
      ${whereClause}
    `, queryParams);
    
    const total = countResult[0].total;

    // Format the response
    const formattedData = callReports.map(call => ({
      id: call.id,
      lead_id: call.lead_id,
      user_id: call.user_id,
      user_name: call.user_name,
      logged_by_name: call.logged_by_name,
      lead_name: call.lead_name,
      lead_company: call.lead_company,
      lead_email: call.lead_email,
      lead_phone: call.lead_phone,
      category: call.category,
      call_outcome: call.call_outcome,
      call_date: call.call_date,
      call_duration: call.call_duration,
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
    console.error('Error fetching call reports:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get call reports statistics/summary
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
          const filterResult = buildFilterWhereClause(parsedFilters, 'calls');
          
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
        COUNT(CASE WHEN call_outcome = 'Successful' THEN 1 END) as successful_calls,
        COUNT(CASE WHEN call_outcome = 'No Answer' THEN 1 END) as no_answer_calls,
        COUNT(CASE WHEN call_outcome = 'Voicemail' THEN 1 END) as voicemail_calls,
        COUNT(CASE WHEN call_outcome = 'Busy' THEN 1 END) as busy_calls,
        COUNT(CASE WHEN call_outcome = 'Disconnected' THEN 1 END) as disconnected_calls,
        AVG(call_duration) as avg_duration,
        SUM(call_duration) as total_duration,
        MAX(call_date) as last_call_date,
        MIN(call_date) as first_call_date
      FROM call_logs cl
      LEFT JOIN leads l ON cl.lead_id = l.id
      ${whereClause}
    `, queryParams);
    
    // Get top callers
    const [topCallers] = await db.execute(`
      SELECT 
        cl.user_name,
        CONCAT(u.first_name, ' ', u.last_name) as logged_by_name,
        COUNT(*) as call_count,
        AVG(cl.call_duration) as avg_duration,
        COUNT(CASE WHEN cl.call_outcome = 'Successful' THEN 1 END) as successful_calls
      FROM call_logs cl
      LEFT JOIN users u ON cl.user_id = u.id
      LEFT JOIN leads l ON cl.lead_id = l.id
      ${whereClause}
      GROUP BY cl.user_id, cl.user_name, u.first_name, u.last_name
      ORDER BY call_count DESC
      LIMIT 10
    `, queryParams);
    
    // Get calls by category breakdown
    const [categoryBreakdown] = await db.execute(`
      SELECT 
        category,
        COUNT(*) as count,
        AVG(call_duration) as avg_duration,
        COUNT(CASE WHEN call_outcome = 'Successful' THEN 1 END) as successful_count
      FROM call_logs cl
      LEFT JOIN leads l ON cl.lead_id = l.id
      ${whereClause}
      GROUP BY category
      ORDER BY count DESC
    `, queryParams);

    // Get daily call volume (last 30 days or filtered range)
    const [dailyVolume] = await db.execute(`
      SELECT 
        DATE(call_date) as call_date,
        COUNT(*) as call_count,
        COUNT(CASE WHEN call_outcome = 'Successful' THEN 1 END) as successful_count
      FROM call_logs cl
      LEFT JOIN leads l ON cl.lead_id = l.id
      ${whereClause}
      GROUP BY DATE(call_date)
      ORDER BY call_date DESC
      LIMIT 30
    `, queryParams);
    
    res.json({
      overview: stats[0],
      top_callers: topCallers,
      category_breakdown: categoryBreakdown,
      daily_volume: dailyVolume
    });
    
  } catch (error) {
    console.error('Error fetching call statistics:', error);
    res.status(500).json({ error: error.message });
  }
});

  return router;
};