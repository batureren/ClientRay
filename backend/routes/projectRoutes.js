// routes/projectRoutes.js
const express = require('express');

module.exports = (dependencies) => {
  const { getDb, authenticateToken } = dependencies;
  const router = express.Router();

// Middleware to check if the user is a member of the project
const isProjectMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    const [member] = await db.execute(
      'SELECT user_id FROM project_members WHERE project_id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (member.length === 0) {
      return res.status(403).json({ error: 'Forbidden: You are not a member of this project' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// *** THIS IS THE MISSING MIDDLEWARE ***
// Middleware to check if the user is the project owner
const isProjectOwner = async (req, res, next) => {
  try {
    const { id } = req.params; // project ID
    const db = await getDb();
    const [project] = await db.execute('SELECT owner_id FROM projects WHERE id = ?', [id]);
    
    if (project.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (project[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: Only the project owner can perform this action.' });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// GET all projects the current user is a member of
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const [projects] = await db.execute(`
      SELECT DISTINCT
        p.id,
        p.project_name,
        p.parent_project_id,
        CONCAT(u.first_name, ' ', u.last_name) as owner_name,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as total_tasks,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.task_status = 'completed') as completed_tasks
      FROM projects p
      JOIN users u ON p.owner_id = u.id
      JOIN project_members pm ON p.id = pm.project_id
      WHERE pm.user_id = ?
      ORDER BY p.created_at DESC
    `, [req.user.id]);
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST a new project
router.post('/', authenticateToken, async (req, res) => {
  const db = await getDb();
  await db.execute('START TRANSACTION');
  try {
    const { project_name, project_description, members, parent_project_id } = req.body;
    const owner_id = req.user.id;

    if (!project_name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const [result] = await db.execute(
      'INSERT INTO projects (project_name, project_description, owner_id, parent_project_id) VALUES (?, ?, ?, ?)',
      [project_name, project_description, owner_id, parent_project_id || null]
    );
    const projectId = result.insertId;

    await db.execute( 'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)', [projectId, owner_id, 'editor'] );

    if (members && Array.isArray(members)) {
      for (const member of members) {
        if (member.user_id.toString() !== owner_id.toString()) {
          await db.execute('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)', [projectId, member.user_id, member.role]);
        }
      }
    }

    await db.execute('COMMIT');
    res.status(201).json({ id: projectId, message: 'Project created successfully' });
  } catch (error) {
    await db.execute('ROLLBACK');
    console.error('Error creating project:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET full details for a single project
router.get('/:id/details', authenticateToken, isProjectMember, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    
    // Core project details
    const [pRes] = await db.execute('SELECT p.*, CONCAT(u.first_name, " ", u.last_name) as owner_name FROM projects p JOIN users u ON p.owner_id = u.id WHERE p.id = ?', [id]);
    if (pRes.length === 0) return res.status(404).json({ error: 'Project not found' });
    const project = pRes[0];
    
    // Members
    const [members] = await db.execute('SELECT u.id, u.username, u.first_name, u.last_name, pm.role FROM project_members pm JOIN users u ON pm.user_id = u.id WHERE pm.project_id = ?', [id]);
    project.members = members;

    // Child Projects
    const [childProjects] = await db.execute('SELECT id, project_name FROM projects WHERE parent_project_id = ? ORDER BY project_name', [id]);
    project.child_projects = childProjects;
    
    // Tasks
    const [tasks] = await db.execute('SELECT t.id, t.task_name, t.task_status, t.deadline_date, u.first_name as assignee_fname, u.last_name as assignee_lname FROM tasks t JOIN users u ON t.assigned_to = u.id WHERE t.project_id = ? ORDER BY t.deadline_date ASC', [id]);
    project.tasks = tasks;

    res.json(project);
  } catch (error) {
    console.error('Error fetching project details:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /:id - Update project details
router.put('/:id', authenticateToken, isProjectOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const { project_name, project_description, project_status } = req.body;
    const db = await getDb();
    await db.execute(
      'UPDATE projects SET project_name = ?, project_description = ?, project_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [project_name, project_description, project_status, id]
    );
    res.json({ message: 'Project updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /:id - Delete a project
router.delete('/:id', authenticateToken, isProjectOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    await db.execute('DELETE FROM projects WHERE id = ?', [id]);
    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /:id/members - Add a member
router.post('/:id/members', authenticateToken, isProjectOwner, async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { user_id, role } = req.body;
    const db = await getDb();
    await db.execute(
      'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
      [projectId, user_id, role || 'viewer'] // Default to viewer if role isn't provided
    );
    res.status(201).json({ message: 'Member added successfully' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'User is already a member of this project.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /:id/members/:userId - Remove a member
router.delete('/:id/members/:userId', authenticateToken, isProjectOwner, async (req, res) => {
  try {
    const { id: projectId, userId } = req.params;
    const db = await getDb();
    const [project] = await db.execute('SELECT owner_id FROM projects WHERE id = ?', [projectId]);
    if (project[0].owner_id.toString() === userId) {
      return res.status(400).json({ error: 'Cannot remove the project owner.' });
    }
    await db.execute('DELETE FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, userId]);
    res.json({ success: true, message: 'Member removed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

  return router;
};