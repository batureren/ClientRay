// routes/savedReportsRoutes.js
const express = require('express');
module.exports = (dependencies) => {
  const { getDb, authenticateToken, requireRole } = dependencies;
  const router = express.Router();

// Get all public saved reports + user's own reports
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { type } = req.query; 
    const userId = req.user.id;
    const db = await getDb();
    
    let query = `
      SELECT 
        sr.*,
        CASE 
          WHEN sr.created_by = ? THEN TRUE 
          ELSE FALSE 
        END as can_edit
      FROM saved_reports sr
      WHERE (sr.is_public = TRUE OR sr.created_by = ?)
    `;
    
    const params = [userId, userId];
    
    if (type) {
      query += ' AND sr.report_type = ?';
      params.push(type);
    }
    
    query += ' ORDER BY sr.created_at DESC';
    
    const [rows] = await db.execute(query, params);
    
    // Parse JSON fields safely
    const reports = rows.map(report => ({
      ...report,
      filters: report.filters ? JSON.parse(report.filters) : [],
      selected_fields: report.selected_fields ? JSON.parse(report.selected_fields) : []
    }));
    
    res.json(reports);
  } catch (error) {
    console.error('Error fetching saved reports:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a specific saved report
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const db = await getDb();
    
    const [rows] = await db.execute(`
      SELECT 
        sr.*,
        CASE 
          WHEN sr.created_by = ? THEN TRUE 
          ELSE FALSE 
        END as can_edit
      FROM saved_reports sr
      WHERE sr.id = ? AND (sr.is_public = TRUE OR sr.created_by = ?)
    `, [userId, id, userId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Saved report not found or access denied' });
    }
    
    const report = {
      ...rows[0],
      filters: rows[0].filters ? JSON.parse(rows[0].filters) : [],
      selected_fields: rows[0].selected_fields ? JSON.parse(rows[0].selected_fields) : []
    };
    
    res.json(report);
  } catch (error) {
    console.error('Error fetching saved report:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new saved report
router.post('/', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const {
      report_name,
      report_type,
      filters,
      selected_fields,
      is_public = true,
      description
    } = req.body;

    if (!report_name || !report_type || !filters || !selected_fields) {
      return res.status(400).json({ 
        error: 'Missing required fields: report_name, report_type, filters, selected_fields' 
      });
    }

    const db = await getDb();
    const userId = req.user.id;
    
    // Safely construct user name, handling potential undefined values
    const firstName = req.user.first_name || '';
    const lastName = req.user.last_name || '';
    const userName = `${firstName} ${lastName}`.trim() || 'Unknown User';

    // Check if report name already exists for this user
    const [existingRows] = await db.execute(
      'SELECT id FROM saved_reports WHERE report_name = ? AND created_by = ?',
      [report_name, userId]
    );

    if (existingRows.length > 0) {
      return res.status(400).json({ 
        error: 'A report with this name already exists in your saved reports' 
      });
    }

    // Prepare parameters, ensuring none are undefined
    const insertParams = [
      report_name,
      report_type,
      userId,
      userName,
      JSON.stringify(filters || []),
      JSON.stringify(selected_fields || []),
      is_public !== undefined ? is_public : true,
      description || null  // Use null instead of undefined
    ];

    console.log('Insert params:', insertParams); // Debug log

    const [result] = await db.execute(`
      INSERT INTO saved_reports (
        report_name, report_type, created_by, created_by_name, 
        filters, selected_fields, is_public, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, insertParams);

    const reportId = result.insertId;

    res.json({ 
      id: reportId,
      message: 'Report saved successfully',
      report_name,
      is_public: is_public !== undefined ? is_public : true
    });
    
  } catch (error) {
    console.error('Error creating saved report:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a saved report (only by creator)
router.put('/:id', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      report_name,
      filters,
      selected_fields,
      is_public,
      description
    } = req.body;
    
    const userId = req.user.id;
    const db = await getDb();
    
    // Check if the report exists and user owns it
    const [reportRows] = await db.execute(
      'SELECT * FROM saved_reports WHERE id = ? AND created_by = ?',
      [id, userId]
    );
    
    if (reportRows.length === 0) {
      return res.status(404).json({ 
        error: 'Saved report not found or you do not have permission to edit it' 
      });
    }

    // Check for name conflicts (excluding current report)
    if (report_name) {
      const [existingRows] = await db.execute(
        'SELECT id FROM saved_reports WHERE report_name = ? AND created_by = ? AND id != ?',
        [report_name, userId, id]
      );

      if (existingRows.length > 0) {
        return res.status(400).json({ 
          error: 'A report with this name already exists in your saved reports' 
        });
      }
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];

    if (report_name !== undefined) {
      updateFields.push('report_name = ?');
      updateValues.push(report_name);
    }
    
    if (filters !== undefined) {
      updateFields.push('filters = ?');
      updateValues.push(JSON.stringify(filters));
    }
    
    if (selected_fields !== undefined) {
      updateFields.push('selected_fields = ?');
      updateValues.push(JSON.stringify(selected_fields));
    }
    
    if (is_public !== undefined) {
      updateFields.push('is_public = ?');
      updateValues.push(is_public);
    }
    
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description !== null ? description : null);
    }

    if (updateFields.length === 0) {
      return res.json({ message: 'No changes to update' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);

    console.log('Update values:', updateValues); // Debug log

    await db.execute(
      `UPDATE saved_reports SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({ 
      message: 'Report updated successfully',
      id: parseInt(id)
    });
    
  } catch (error) {
    console.error('Error updating saved report:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a saved report (only by creator or admin)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const db = await getDb();
    
    // Check if the report exists
    const [reportRows] = await db.execute('SELECT * FROM saved_reports WHERE id = ?', [id]);
    
    if (reportRows.length === 0) {
      return res.status(404).json({ error: 'Saved report not found' });
    }

    const report = reportRows[0];

    // Check permissions: only creator or admin can delete
    if (report.created_by !== userId && userRole !== 'admin') {
      return res.status(403).json({ 
        error: 'You do not have permission to delete this report' 
      });
    }

    const [deleteResult] = await db.execute('DELETE FROM saved_reports WHERE id = ?', [id]);

    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ 
      success: true, 
      deletedId: parseInt(id),
      message: 'Report deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting saved report:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get reports created by current user
router.get('/my/reports', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type } = req.query;
    const db = await getDb();
    
    let query = `
      SELECT 
        sr.*,
        TRUE as can_edit
      FROM saved_reports sr
      WHERE sr.created_by = ?
    `;
    
    const params = [userId];
    
    if (type) {
      query += ' AND sr.report_type = ?';
      params.push(type);
    }
    
    query += ' ORDER BY sr.created_at DESC';
    
    const [rows] = await db.execute(query, params);
    
    const reports = rows.map(report => ({
      ...report,
      filters: report.filters ? JSON.parse(report.filters) : [],
      selected_fields: report.selected_fields ? JSON.parse(report.selected_fields) : []
    }));
    
    res.json(reports);
  } catch (error) {
    console.error('Error fetching user reports:', error);
    res.status(500).json({ error: error.message });
  }
});

  return router;
};