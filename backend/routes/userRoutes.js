// routes/userRoutes.js
const express = require('express');
module.exports = (dependencies) => {
  const { getDb, authenticateToken } = dependencies;
  const router = express.Router();

// Get all users (for task assignment dropdown and other purposes)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const [users] = await db.execute(
      'SELECT id, username, first_name, last_name, role, profile_picture FROM users WHERE is_active = 1 ORDER BY first_name, last_name'
    );
    
    res.json(users);
  } catch (error)
{
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/language', authenticateToken, async (req, res) => {
  try {
    const { language } = req.body;
    const userId = req.user.id;

    if (!language) {
      return res.status(400).json({ error: 'Language code is required.' });
    }

    const db = await getDb();

    await db.execute(
      'UPDATE users SET language = ? WHERE id = ?',
      [language, userId]
    );

    res.json({
      success: true,
      message: `Language updated successfully to ${language}`
    });

  } catch (error) {
    console.error('Error updating user language:', error);
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

// Get user preferences
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const [preferences] = await db.execute(
      'SELECT * FROM user_preferences WHERE user_id = ?',
      [req.user.id]
    );
    
    if (preferences.length === 0) {
      // Return default preferences if none exist
      const defaultPreferences = {
        notes_grid_width: 1200,
        notes_grid_height: 800,
        shared_notes_grid_width: 1200,
        shared_notes_grid_height: 800,
        notes_view_mode: 'grid',
        theme: 'light'
      };
      res.json(defaultPreferences);
    } else {
      res.json(preferences[0]);
    }
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user preferences
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const {
      notes_grid_width,
      notes_grid_height,
      shared_notes_grid_width,
      shared_notes_grid_height,
      notes_view_mode,
      theme
    } = req.body;
    
    const db = await getDb();
    
    // Check if preferences exist
    const [existing] = await db.execute(
      'SELECT id FROM user_preferences WHERE user_id = ?',
      [req.user.id]
    );
    
    if (existing.length === 0) {
      // Insert new preferences
      await db.execute(
        `INSERT INTO user_preferences 
         (user_id, notes_grid_width, notes_grid_height, shared_notes_grid_width, 
          shared_notes_grid_height, notes_view_mode, theme, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          req.user.id,
          notes_grid_width || 1200,
          notes_grid_height || 800,
          shared_notes_grid_width || 1200,
          shared_notes_grid_height || 800,
          notes_view_mode || 'grid',
          theme || 'light'
        ]
      );
    } else {
      // Update existing preferences
      const updateFields = [];
      const updateValues = [];
      
      if (notes_grid_width !== undefined) {
        updateFields.push('notes_grid_width = ?');
        updateValues.push(notes_grid_width);
      }
      if (notes_grid_height !== undefined) {
        updateFields.push('notes_grid_height = ?');
        updateValues.push(notes_grid_height);
      }
      if (shared_notes_grid_width !== undefined) {
        updateFields.push('shared_notes_grid_width = ?');
        updateValues.push(shared_notes_grid_width);
      }
      if (shared_notes_grid_height !== undefined) {
        updateFields.push('shared_notes_grid_height = ?');
        updateValues.push(shared_notes_grid_height);
      }
      if (notes_view_mode !== undefined) {
        updateFields.push('notes_view_mode = ?');
        updateValues.push(notes_view_mode);
      }
      if (theme !== undefined) {
        updateFields.push('theme = ?');
        updateValues.push(theme);
      }
      
      if (updateFields.length > 0) {
        updateFields.push('updated_at = NOW()');
        updateValues.push(req.user.id);
        
        await db.execute(
          `UPDATE user_preferences SET ${updateFields.join(', ')} WHERE user_id = ?`,
          updateValues
        );
      }
    }
    
    // Get updated preferences
    const [updatedPreferences] = await db.execute(
      'SELECT * FROM user_preferences WHERE user_id = ?',
      [req.user.id]
    );
    
    res.json({
      success: true,
      preferences: updatedPreferences[0]
    });
    
  } catch (error) {
    console.error('Error updating user preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update specific grid preferences (for real-time updates during resize)
router.put('/preferences/grid', authenticateToken, async (req, res) => {
  try {
    const { tab, width, height } = req.body;
    
    if (!tab || !width || !height) {
      return res.status(400).json({ error: 'Tab, width, and height are required' });
    }
    
    const db = await getDb();
    
    // Determine which fields to update based on tab
    const widthField = tab === 'my-notes' ? 'notes_grid_width' : 'shared_notes_grid_width';
    const heightField = tab === 'my-notes' ? 'notes_grid_height' : 'shared_notes_grid_height';
    
    // Check if preferences exist
    const [existing] = await db.execute(
      'SELECT id FROM user_preferences WHERE user_id = ?',
      [req.user.id]
    );
    
    if (existing.length === 0) {
      // Insert new preferences with default values
      const insertData = {
        user_id: req.user.id,
        notes_grid_width: tab === 'my-notes' ? width : 1200,
        notes_grid_height: tab === 'my-notes' ? height : 800,
        shared_notes_grid_width: tab === 'shared-notes' ? width : 1200,
        shared_notes_grid_height: tab === 'shared-notes' ? height : 800,
        notes_view_mode: 'grid',
        theme: 'light'
      };
      
      await db.execute(
        `INSERT INTO user_preferences 
         (user_id, notes_grid_width, notes_grid_height, shared_notes_grid_width, 
          shared_notes_grid_height, notes_view_mode, theme, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          insertData.user_id,
          insertData.notes_grid_width,
          insertData.notes_grid_height,
          insertData.shared_notes_grid_width,
          insertData.shared_notes_grid_height,
          insertData.notes_view_mode,
          insertData.theme
        ]
      );
    } else {
      // Update existing preferences
      await db.execute(
        `UPDATE user_preferences SET ${widthField} = ?, ${heightField} = ?, updated_at = NOW() WHERE user_id = ?`,
        [width, height, req.user.id]
      );
    }
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error updating grid preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/preferences/lead-layout', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const [layout] = await db.execute(
      'SELECT selected_fields FROM user_lead_layout_preferences WHERE user_id = ?',
      [req.user.id]
    );
    
    if (layout.length > 0) {
      res.json({ selected_fields: JSON.parse(layout[0].selected_fields) });
    } else {
      res.status(404).json({ message: 'No layout preferences found for user.' });
    }
  } catch (error) {
    console.error('Error fetching lead layout preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/preferences/lead-layout', authenticateToken, async (req, res) => {
  try {
    const { selected_fields } = req.body;
    if (!selected_fields || !Array.isArray(selected_fields)) {
      return res.status(400).json({ error: 'selected_fields must be an array.' });
    }

    const db = await getDb();
    
    await db.execute(
      `INSERT INTO user_lead_layout_preferences (user_id, selected_fields, created_at, updated_at)
       VALUES (?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE selected_fields = ?, updated_at = NOW()`,
      [req.user.id, JSON.stringify(selected_fields), JSON.stringify(selected_fields)]
    );
    
    res.json({ success: true, message: 'Lead layout preferences updated.' });
  } catch (error) {
    console.error('Error updating lead layout preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/preferences/account-layout', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const [layout] = await db.execute(
      'SELECT selected_fields FROM user_account_layout_preferences WHERE user_id = ?',
      [req.user.id]
    );
    
    if (layout.length > 0) {
      res.json({ selected_fields: JSON.parse(layout[0].selected_fields) });
    } else {
      res.status(404).json({ message: 'No layout preferences found for user.' });
    }
  } catch (error) {
    console.error('Error fetching account layout preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/preferences/account-layout', authenticateToken, async (req, res) => {
  try {
    const { selected_fields } = req.body;
    if (!selected_fields || !Array.isArray(selected_fields)) {
      return res.status(400).json({ error: 'selected_fields must be an array.' });
    }

    const db = await getDb();
    
    await db.execute(
      `INSERT INTO user_account_layout_preferences (user_id, selected_fields, created_at, updated_at)
       VALUES (?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE selected_fields = ?, updated_at = NOW()`,
      [req.user.id, JSON.stringify(selected_fields), JSON.stringify(selected_fields)]
    );
    
    res.json({ success: true, message: 'Account layout preferences updated.' });
  } catch (error) {
    console.error('Error updating account layout preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

  return router;
};