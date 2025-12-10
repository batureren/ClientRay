// routes/dashboardRoutes.js
const express = require('express');
module.exports = (dependencies) => {
  const { getDb, authenticateToken, requireRole } = dependencies;
  const router = express.Router();

// Get all public dashboards + user's own dashboards
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const db = await getDb();
    
    const [rows] = await db.execute(`
      SELECT 
        d.*,
        CASE 
          WHEN d.created_by = ? THEN TRUE 
          ELSE FALSE 
        END as can_edit,
        (SELECT COUNT(*) FROM dashboard_widgets dw WHERE dw.dashboard_id = d.id) as widget_count
      FROM dashboards d
      WHERE (d.is_public = TRUE OR d.created_by = ?)
      ORDER BY d.updated_at DESC
    `, [userId, userId]);
    
    res.json(rows);
  } catch (error) {
    console.error('Error fetching dashboards:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a specific dashboard with its widgets
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const db = await getDb();
    
    // Get dashboard details
    const [dashboardRows] = await db.execute(`
      SELECT 
        d.*,
        CASE 
          WHEN d.created_by = ? THEN TRUE 
          ELSE FALSE 
        END as can_edit
      FROM dashboards d
      WHERE d.id = ? AND (d.is_public = TRUE OR d.created_by = ?)
    `, [userId, id, userId]);
    
    if (dashboardRows.length === 0) {
      return res.status(404).json({ error: 'Dashboard not found or access denied' });
    }
    
    // Get dashboard widgets with saved report details
    const [widgetRows] = await db.execute(`
      SELECT 
        dw.*,
        sr.report_name,
        sr.report_type,
        sr.filters,
        sr.selected_fields
      FROM dashboard_widgets dw
      JOIN saved_reports sr ON dw.saved_report_id = sr.id
      WHERE dw.dashboard_id = ?
      ORDER BY dw.position_y, dw.position_x
    `, [id]);
    
    // Parse JSON fields
    const widgets = widgetRows.map(widget => ({
      ...widget,
      chart_config: widget.chart_config ? JSON.parse(widget.chart_config) : {},
      display_options: widget.display_options ? JSON.parse(widget.display_options) : {},
      filters: widget.filters ? JSON.parse(widget.filters) : [],
      selected_fields: widget.selected_fields ? JSON.parse(widget.selected_fields) : []
    }));
    
    const dashboard = {
      ...dashboardRows[0],
      widgets
    };
    
    res.json(dashboard);
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new dashboard
router.post('/', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const {
      dashboard_name,
      description,
      is_public = true,
      grid_columns = 12
    } = req.body;

    if (!dashboard_name) {
      return res.status(400).json({ 
        error: 'Dashboard name is required' 
      });
    }

    const db = await getDb();
    const userId = req.user.id;
    
    const firstName = req.user.first_name || '';
    const lastName = req.user.last_name || '';
    const userName = `${firstName} ${lastName}`.trim() || 'Unknown User';

    // Check if dashboard name already exists for this user
    const [existingRows] = await db.execute(
      'SELECT id FROM dashboards WHERE dashboard_name = ? AND created_by = ?',
      [dashboard_name, userId]
    );

    if (existingRows.length > 0) {
      return res.status(400).json({ 
        error: 'A dashboard with this name already exists' 
      });
    }

    const [result] = await db.execute(`
      INSERT INTO dashboards (
        dashboard_name, description, created_by, created_by_name, 
        is_public, grid_columns
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [dashboard_name, description || null, userId, userName, is_public, grid_columns]);

    res.json({ 
      id: result.insertId,
      message: 'Dashboard created successfully',
      dashboard_name,
      is_public
    });
    
  } catch (error) {
    console.error('Error creating dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a dashboard
router.put('/:id', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      dashboard_name,
      description,
      is_public,
      grid_columns
    } = req.body;
    
    const userId = req.user.id;
    const db = await getDb();
    
    // Check if the dashboard exists and user owns it
    const [dashboardRows] = await db.execute(
      'SELECT * FROM dashboards WHERE id = ? AND created_by = ?',
      [id, userId]
    );
    
    if (dashboardRows.length === 0) {
      return res.status(404).json({ 
        error: 'Dashboard not found or you do not have permission to edit it' 
      });
    }

    // Check for name conflicts (excluding current dashboard)
    if (dashboard_name) {
      const [existingRows] = await db.execute(
        'SELECT id FROM dashboards WHERE dashboard_name = ? AND created_by = ? AND id != ?',
        [dashboard_name, userId, id]
      );

      if (existingRows.length > 0) {
        return res.status(400).json({ 
          error: 'A dashboard with this name already exists' 
        });
      }
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];

    if (dashboard_name !== undefined) {
      updateFields.push('dashboard_name = ?');
      updateValues.push(dashboard_name);
    }
    
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    
    if (is_public !== undefined) {
      updateFields.push('is_public = ?');
      updateValues.push(is_public);
    }

    if (grid_columns !== undefined) {
      updateFields.push('grid_columns = ?');
      updateValues.push(grid_columns);
    }

    if (updateFields.length === 0) {
      return res.json({ message: 'No changes to update' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);

    await db.execute(
      `UPDATE dashboards SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({ 
      message: 'Dashboard updated successfully',
      id: parseInt(id)
    });
    
  } catch (error) {
    console.error('Error updating dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a dashboard
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const db = await getDb();
    
    const [dashboardRows] = await db.execute('SELECT * FROM dashboards WHERE id = ?', [id]);
    
    if (dashboardRows.length === 0) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }

    const dashboard = dashboardRows[0];

    // Check permissions: only creator or admin can delete
    if (dashboard.created_by !== userId && userRole !== 'admin') {
      return res.status(403).json({ 
        error: 'You do not have permission to delete this dashboard' 
      });
    }

    const [deleteResult] = await db.execute('DELETE FROM dashboards WHERE id = ?', [id]);

    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }

    res.json({ 
      success: true, 
      deletedId: parseInt(id),
      message: 'Dashboard deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add widget to dashboard
router.post('/:id/widgets', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const { id: dashboardId } = req.params;
    const {
      saved_report_id,
      widget_title,
      widget_type = 'table',
      position_x = 0,
      position_y = 0,
      width = 6,
      height = 4,
      chart_config = {},
      display_options = {}
    } = req.body;

    if (!saved_report_id) {
      return res.status(400).json({ error: 'Saved report ID is required' });
    }

    const db = await getDb();
    const userId = req.user.id;

    // Verify dashboard ownership
    const [dashboardRows] = await db.execute(
      'SELECT * FROM dashboards WHERE id = ? AND created_by = ?',
      [dashboardId, userId]
    );

    if (dashboardRows.length === 0) {
      return res.status(404).json({ 
        error: 'Dashboard not found or you do not have permission to edit it' 
      });
    }

    // Verify saved report exists and user has access
    const [reportRows] = await db.execute(`
      SELECT * FROM saved_reports 
      WHERE id = ? AND (is_public = TRUE OR created_by = ?)
    `, [saved_report_id, userId]);

    if (reportRows.length === 0) {
      return res.status(404).json({ 
        error: 'Saved report not found or access denied' 
      });
    }

    const [result] = await db.execute(`
      INSERT INTO dashboard_widgets (
        dashboard_id, saved_report_id, widget_title, widget_type,
        position_x, position_y, width, height, chart_config, display_options
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      dashboardId, saved_report_id, widget_title || reportRows[0].report_name,
      widget_type, position_x, position_y, width, height,
      JSON.stringify(chart_config), JSON.stringify(display_options)
    ]);

    res.json({ 
      id: result.insertId,
      message: 'Widget added successfully'
    });

  } catch (error) {
    console.error('Error adding widget:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update widget
router.put('/:dashboardId/widgets/:widgetId', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const { dashboardId, widgetId } = req.params;
    const {
      widget_title,
      widget_type,
      position_x,
      position_y,
      width,
      height,
      chart_config,
      display_options
    } = req.body;

    const db = await getDb();
    const userId = req.user.id;

    // Verify dashboard ownership
    const [dashboardRows] = await db.execute(
      'SELECT * FROM dashboards WHERE id = ? AND created_by = ?',
      [dashboardId, userId]
    );

    if (dashboardRows.length === 0) {
      return res.status(404).json({ 
        error: 'Dashboard not found or you do not have permission to edit it' 
      });
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];

    if (widget_title !== undefined) {
      updateFields.push('widget_title = ?');
      updateValues.push(widget_title);
    }
    
    if (widget_type !== undefined) {
      updateFields.push('widget_type = ?');
      updateValues.push(widget_type);
    }

    if (position_x !== undefined) {
      updateFields.push('position_x = ?');
      updateValues.push(position_x);
    }

    if (position_y !== undefined) {
      updateFields.push('position_y = ?');
      updateValues.push(position_y);
    }

    if (width !== undefined) {
      updateFields.push('width = ?');
      updateValues.push(width);
    }

    if (height !== undefined) {
      updateFields.push('height = ?');
      updateValues.push(height);
    }

    if (chart_config !== undefined) {
      updateFields.push('chart_config = ?');
      updateValues.push(JSON.stringify(chart_config));
    }

    if (display_options !== undefined) {
      updateFields.push('display_options = ?');
      updateValues.push(JSON.stringify(display_options));
    }

    if (updateFields.length === 0) {
      return res.json({ message: 'No changes to update' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(widgetId, dashboardId);

    await db.execute(
      `UPDATE dashboard_widgets SET ${updateFields.join(', ')} 
       WHERE id = ? AND dashboard_id = ?`,
      updateValues
    );

    res.json({ 
      message: 'Widget updated successfully',
      id: parseInt(widgetId)
    });

  } catch (error) {
    console.error('Error updating widget:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete widget
router.delete('/:dashboardId/widgets/:widgetId', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const { dashboardId, widgetId } = req.params;
    const userId = req.user.id;
    const db = await getDb();

    // Verify dashboard ownership
    const [dashboardRows] = await db.execute(
      'SELECT * FROM dashboards WHERE id = ? AND created_by = ?',
      [dashboardId, userId]
    );

    if (dashboardRows.length === 0) {
      return res.status(404).json({ 
        error: 'Dashboard not found or you do not have permission to edit it' 
      });
    }

    const [deleteResult] = await db.execute(
      'DELETE FROM dashboard_widgets WHERE id = ? AND dashboard_id = ?',
      [widgetId, dashboardId]
    );

    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    res.json({ 
      success: true, 
      deletedId: parseInt(widgetId),
      message: 'Widget deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting widget:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's dashboards
router.get('/my/dashboards', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const db = await getDb();
    
    const [rows] = await db.execute(`
      SELECT 
        d.*,
        TRUE as can_edit,
        (SELECT COUNT(*) FROM dashboard_widgets dw WHERE dw.dashboard_id = d.id) as widget_count
      FROM dashboards d
      WHERE d.created_by = ?
      ORDER BY d.updated_at DESC
    `, [userId]);
    
    res.json(rows);
  } catch (error) {
    console.error('Error fetching user dashboards:', error);
    res.status(500).json({ error: error.message });
  }
});

  return router;
};