// routes/noteRoutes.js

const express = require('express');

module.exports = (dependencies) => {
  const { getDb, authenticateToken } = dependencies;
  const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET /api/notes - Get user's notes
router.get('/', async (req, res) => {
  const db = await getDb();

  try {
    const query = `
      SELECT 
        n.id, n.title, n.content, n.z_index, n.x, n.y, n.width, n.height, n.color, n.created_at, n.updated_at,
        (
          SELECT JSON_ARRAYAGG(
            JSON_OBJECT('id', u.id, 'username', u.username, 'email', u.email)
          )
          FROM note_shares ns
          JOIN users u ON ns.user_id = u.id
          WHERE ns.note_id = n.id
        ) as shares
      FROM notes n
      WHERE n.owner_id = ?
      ORDER BY n.updated_at DESC
    `;
    
    const [notesFromDb] = await db.execute(query, [req.user.id]);
    
    const notes = notesFromDb.map(note => ({
      ...note,
      shares: note.shares ? JSON.parse(note.shares) : []
    }));

    res.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// GET /api/notes/shared - Get notes shared with user
router.get('/shared', async (req, res) => {
  const db = await getDb();
  try {
    const query = `
      SELECT 
        n.id, n.title, n.content, n.created_at, n.updated_at,
        u.username as owner_name, u.email as owner_email,
        COALESCE(nsp.x, n.x) as x,
        COALESCE(nsp.y, n.y) as y,
        COALESCE(nsp.width, n.width) as width,
        COALESCE(nsp.height, n.height) as height,
        COALESCE(nsp.z_index, n.z_index) as z_index,
        n.color
      FROM notes n
      JOIN note_shares ns ON n.id = ns.note_id
      JOIN users u ON n.owner_id = u.id
      LEFT JOIN note_share_properties nsp ON ns.note_id = nsp.note_id AND ns.user_id = nsp.user_id
      WHERE ns.user_id = ?
      ORDER BY n.updated_at DESC
    `;
    
    const [sharedNotes] = await db.execute(query, [req.user.id]);
    res.json(sharedNotes);
  } catch (error) {
    console.error('Error fetching shared notes:', error);
    res.status(500).json({ error: 'Failed to fetch shared notes' });
  }
});

router.put('/shared-properties/:noteId', async (req, res) => {
  const db = await getDb();
  try {
    const noteId = req.params.noteId;
    const userId = req.user.id;
    const { x, y, width, height, z_index } = req.body;

    const [shares] = await db.execute(
      'SELECT * FROM note_shares WHERE note_id = ? AND user_id = ?',
      [noteId, userId]
    );
    if (shares.length === 0) {
      return res.status(403).json({ error: 'You do not have permission to modify this shared note.' });
    }

    const upsertQuery = `
      INSERT INTO note_share_properties (user_id, note_id, x, y, width, height, z_index)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        x = VALUES(x), y = VALUES(y), width = VALUES(width), height = VALUES(height), z_index = VALUES(z_index)
    `;
    
    await db.execute(upsertQuery, [userId, noteId, x, y, width, height, z_index]);

    res.json({ message: 'Shared note properties updated successfully.' });
  } catch (error) {
    console.error('Error updating shared note properties:', error);
    res.status(500).json({ error: 'Failed to update shared note properties.' });
  }
});

router.delete('/shared/:noteId', async (req, res) => {
  const db = await getDb();
  try {
    const noteId = req.params.noteId;
    const userId = req.user.id;

    await db.execute('DELETE FROM note_shares WHERE note_id = ? AND user_id = ?', [noteId, userId]);
    await db.execute('DELETE FROM note_share_properties WHERE note_id = ? AND user_id = ?', [noteId, userId]);

    res.json({ message: 'Shared note removed from your view.' });
  } catch (error) {
    console.error('Error removing shared note:', error);
    res.status(500).json({ error: 'Failed to remove shared note.' });
  }
});

// POST /api/notes - Create a new note
router.post('/', async (req, res) => {
  const db = await getDb();
  try {
    const { title, content, z_index = 0, x = 0, y = 0, width = 280,
      height = 200, color = 'bg-yellow-200 border-yellow-300' } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const query = `
      INSERT INTO notes (owner_id, title, content, z_index, x, y, width, height, color, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    
    const [result] = await db.execute(query, [req.user.id, title, content, z_index, x, y, width, height, color]);
    
    // Fetch the created note
    const [createdNotes] = await db.execute(
      'SELECT * FROM notes WHERE id = ?',
      [result.insertId]
    );
    
    res.status(201).json(createdNotes[0]);
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// GET /api/notes/:id - Get a specific note
router.get('/:id', async (req, res) => {
  const db = await getDb();
  try {
    const noteId = req.params.id;
    
    // Check if user owns the note or has access to it
    const query = `
      SELECT n.*, u.username as owner_name
      FROM notes n
      JOIN users u ON n.owner_id = u.id
      WHERE n.id = ? AND (n.owner_id = ? OR EXISTS (
        SELECT 1 FROM note_shares ns WHERE ns.note_id = n.id AND ns.user_id = ?
      ))
    `;
    
    const [notes] = await db.execute(query, [noteId, req.user.id, req.user.id]);
    
    if (notes.length === 0) {
      return res.status(404).json({ error: 'Note not found or access denied' });
    }
    
    res.json(notes[0]);
  } catch (error) {
    console.error('Error fetching note:', error);
    res.status(500).json({ error: 'Failed to fetch note' });
  }
});

// PUT /api/notes/:id - Update a note
router.put('/:id', async (req, res) => {
  const db = await getDb();
  try {
    const noteId = req.params.id;
    const { title, content, x, y, z_index, width, height, color } = req.body;
    
    // Verify ownership
    const [existingNotes] = await db.execute(
      'SELECT * FROM notes WHERE id = ? AND owner_id = ?',
      [noteId, req.user.id]
    );
    
    if (existingNotes.length === 0) {
      return res.status(404).json({ error: 'Note not found or you do not have permission to edit it' });
    }
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    
    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (content !== undefined) {
      updates.push('content = ?');
      values.push(content);
    }
    if (z_index !== undefined) {
      updates.push('z_index = ?');
      values.push(z_index);
    }
    if (x !== undefined) {
      updates.push('x = ?');
      values.push(x);
    }
    if (y !== undefined) {
      updates.push('y = ?');
      values.push(y);
    }
    if (width !== undefined) {
      updates.push('width = ?');
      values.push(width);
    }
    if (height !== undefined) {
      updates.push('height = ?');
      values.push(height);
    }
    if (color !== undefined) {
      updates.push('color = ?');
      values.push(color);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    updates.push('updated_at = NOW()');
    values.push(noteId);
    
    const query = `UPDATE notes SET ${updates.join(', ')} WHERE id = ?`;
    await db.execute(query, values);
    
    // Fetch and return updated note
    const [updatedNotes] = await db.execute('SELECT * FROM notes WHERE id = ?', [noteId]);
    res.json(updatedNotes[0]);
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// DELETE /api/notes/:id - Delete a note
router.delete('/:id', async (req, res) => {
  const db = await getDb();
  try {
    const noteId = req.params.id;
    
    // Verify ownership
    const [existingNotes] = await db.execute(
      'SELECT * FROM notes WHERE id = ? AND owner_id = ?',
      [noteId, req.user.id]
    );
    
    if (existingNotes.length === 0) {
      return res.status(404).json({ error: 'Note not found or you do not have permission to delete it' });
    }
    
    await db.execute('DELETE FROM note_shares WHERE note_id = ?', [noteId]);
    
    // Delete the note
    await db.execute('DELETE FROM notes WHERE id = ?', [noteId]);
    
    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// POST /api/notes/:id/share - Share a note with users
router.post('/:id/share', async (req, res) => {
  const db = await getDb();

  try {
    const noteId = req.params.id;
    const { userIds } = req.body;
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'User IDs array is required' });
    }
    
    // Verify ownership
    const [existingNotes] = await db.execute(
      'SELECT * FROM notes WHERE id = ? AND owner_id = ?',
      [noteId, req.user.id]
    );
    
    if (existingNotes.length === 0) {
      return res.status(404).json({ error: 'Note not found or you do not have permission to share it' });
    }
    
    // Verify all users exist
    const placeholders = userIds.map(() => '?').join(',');
    const [users] = await db.execute(
      `SELECT id FROM users WHERE id IN (${placeholders})`,
      userIds
    );
    
    if (users.length !== userIds.length) {
      return res.status(400).json({ error: 'One or more user IDs are invalid' });
    }
    
    // Remove existing shares for this note
    await db.execute('DELETE FROM note_shares WHERE note_id = ?', [noteId]);
    
    // Add new shares
    for (const userId of userIds) {
      await db.execute(
        'INSERT IGNORE INTO note_shares (note_id, user_id, shared_at) VALUES (?, ?, NOW())',
        [noteId, userId]
      );
    }
    
    res.json({ message: `Note shared with ${userIds.length} user(s)` });
  } catch (error) {
    console.error('Error sharing note:', error);
    res.status(500).json({ error: 'Failed to share note' });
  }
});

// DELETE /api/notes/:id/share/:userId - Remove share access
router.delete('/:id/share/:userId', async (req, res) => {
  const db = await getDb();
  try {
    const noteId = req.params.id;
    const userId = req.params.userId;
    
    // Verify ownership
    const [existingNotes] = await db.execute(
      'SELECT * FROM notes WHERE id = ? AND owner_id = ?',
      [noteId, req.user.id]
    );
    
    if (existingNotes.length === 0) {
      return res.status(404).json({ error: 'Note not found or you do not have permission to manage shares' });
    }
    
    await db.execute('DELETE FROM note_shares WHERE note_id = ? AND user_id = ?', [noteId, userId]);
    
    res.json({ message: 'Share access removed' });
  } catch (error) {
    console.error('Error removing share access:', error);
    res.status(500).json({ error: 'Failed to remove share access' });
  }
});

// GET /api/notes/:id/shares - Get users who have access to a note
router.get('/:id/shares', async (req, res) => {
  const db = await getDb();
  try {
    const noteId = req.params.id;
    
    // Verify ownership
    const [existingNotes] = await db.execute(
      'SELECT * FROM notes WHERE id = ? AND owner_id = ?',
      [noteId, req.user.id]
    );
    
    if (existingNotes.length === 0) {
      return res.status(404).json({ error: 'Note not found or you do not have permission to view shares' });
    }
    
    const query = `
      SELECT u.id, u.username, u.email, ns.shared_at
      FROM note_shares ns
      JOIN users u ON ns.user_id = u.id
      WHERE ns.note_id = ?
      ORDER BY ns.shared_at DESC
    `;
    
    const [shares] = await db.execute(query, [noteId]);
    res.json(shares);
  } catch (error) {
    console.error('Error fetching note shares:', error);
    res.status(500).json({ error: 'Failed to fetch note shares' });
  }
});

router.put('/batch-update/layers', async (req, res) => {
  const db = await getDb();
  try {
    const updates = req.body.updates; // Expecting an array [{ id, z_index }]

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'Invalid update payload' });
    }

    // Use a transaction to ensure all updates succeed or none do.
    await db.beginTransaction();

    for (const update of updates) {
      const { id, z_index } = update;
      if (id === undefined || z_index === undefined) {
        throw new Error('Each update must include an id and a z_index.');
      }
      
      await db.execute(
        'UPDATE notes SET z_index = ? WHERE id = ? AND owner_id = ?',
        [z_index, id, req.user.id]
      );
    }

    await db.commit();
    res.json({ message: 'Layers updated successfully' });

  } catch (error) {
    await db.rollback(); // Roll back all changes if any single update fails
    console.error('Error batch updating note layers:', error);
    res.status(500).json({ error: 'Failed to update note layers' });
  }
});

  return router;
};