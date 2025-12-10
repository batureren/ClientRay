// routes/taskRoutes.js
const express = require('express');
module.exports = (dependencies) => {
  const { getDb, authenticateToken, requireRole, calculateNextOccurrence } = dependencies;
  const router = express.Router();

// Helper function to log task history to lead/account
const logTaskHistoryToParent = async (taskData, userId, userName, actionType, oldStatus = null, newStatus = null) => {
  try {
    const db = await getDb();
    
    if (taskData.lead_id) {
      let description = `${userName} ${actionType} task: ${taskData.task_name}`;
      if (oldStatus && newStatus && oldStatus !== newStatus) {
        description += ` (status changed from ${oldStatus} to ${newStatus})`;
      }
      
      await db.execute(
        `INSERT INTO lead_history (lead_id, user_id, user_name, action_type, description, field_name, old_value, new_value)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [taskData.lead_id, userId, userName, 'task_action', description, 
         oldStatus && newStatus ? 'task_status' : null, oldStatus, newStatus]
      );
    }
    
    if (taskData.account_id) {
      let description = `${userName} ${actionType} task: ${taskData.task_name}`;
      if (oldStatus && newStatus && oldStatus !== newStatus) {
        description += ` (status changed from ${oldStatus} to ${newStatus})`;
      }
      
      await db.execute(
        `INSERT INTO account_history (account_id, user_id, action_type, description, field_name, old_value, new_value)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [taskData.account_id, userId, 'task_action', description,
         oldStatus && newStatus ? 'task_status' : null, oldStatus, newStatus]
      );
    }
  } catch (error) {
    console.error('Error logging task history to parent:', error);
  }
};

// Helper function to create mentions
const createMentions = async (taskId, commentId, mentions, mentionedById, mentionType = 'comment') => {
  if (!mentions || mentions.length === 0) return;
  
  const db = await getDb();
  for (const userId of mentions) {
    try {
      await db.execute(
        `INSERT INTO task_mentions (task_id, comment_id, mentioned_user_id, mentioned_by_user_id, mention_type)
         VALUES (?, ?, ?, ?, ?)`,
        [taskId, commentId, userId, mentionedById, mentionType]
      );
    } catch (error) {
      console.error('Error creating mention:', error);
    }
  }
};

// Get all tasks with related lead/account names and assignee info
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      search, 
      dateFilter, 
      startDate, 
      endDate, 
      projectId, 
      assigneeId, 
      status,
      page,
      limit
    } = req.query;
    
    const db = await getDb();
    
    const usePagination = page !== undefined || limit !== undefined;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;

    let query = `
      SELECT
        t.*,
        CONCAT(u1.first_name, ' ', u1.last_name) AS assigned_to_name,
        CONCAT(u2.first_name, ' ', u2.last_name) AS created_by_name,
        CONCAT(l.fname, ' ', l.lname) as lead_name,
        a.name AS account_name,
        p.project_name AS project_name,
        GROUP_CONCAT(
          DISTINCT CONCAT(ua.first_name, ' ', ua.last_name)
          ORDER BY
            CASE WHEN ta.user_id = t.assigned_to THEN 0 ELSE 1 END,
            ta.assigned_at
          SEPARATOR ', '
        ) as all_assignees_names,
        GROUP_CONCAT(DISTINCT ta.user_id SEPARATOR ',') AS all_assignees_ids,
        COUNT(DISTINCT ts.id) AS total_subtasks,
        SUM(CASE WHEN ts.is_completed = 1 THEN 1 ELSE 0 END) AS completed_subtasks
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      LEFT JOIN leads l ON t.lead_id = l.id
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN task_assignees ta ON t.id = ta.task_id
      LEFT JOIN users ua ON ta.user_id = ua.id
      LEFT JOIN task_subtasks ts ON t.id = ts.task_id
    `;

    const whereClauses = [];
    const params = [];

    if (search) {
      whereClauses.push(`(t.task_name LIKE ? OR t.task_description LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`);
    }

    if (startDate && endDate) {
      whereClauses.push(`DATE(t.deadline_date) BETWEEN ? AND ?`);
      params.push(startDate, endDate);
    } else if (dateFilter) {
      switch (dateFilter) {
        case 'today': whereClauses.push(`DATE(t.deadline_date) = CURDATE()`); break;
        case 'weekly': whereClauses.push(`t.deadline_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)`); break;
        case 'monthly': whereClauses.push(`t.deadline_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 1 MONTH)`); break;
      }
    }
    
    if (projectId) {
      whereClauses.push(`t.project_id = ?`);
      params.push(projectId);
    }

    if (assigneeId) {
      whereClauses.push(`EXISTS (SELECT 1 FROM task_assignees ta_filter WHERE ta_filter.task_id = t.id AND ta_filter.user_id = ?)`);
      params.push(assigneeId);
    }

    if (status) {
      whereClauses.push(`t.task_status = ?`);
      params.push(status);
    }
    
    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    query += ` GROUP BY t.id ORDER BY t.deadline_date ASC`;
    
    let paginationClause = '';
    let finalParams = [...params];
    
    if (usePagination) {
      const offset = (pageNum - 1) * limitNum;
      paginationClause = ' LIMIT ? OFFSET ?';
      finalParams.push(limitNum, offset);
    }

    const [tasks] = await db.execute(query + paginationClause, finalParams);
    
    let countQuery = `
      SELECT COUNT(DISTINCT t.id) as total
      FROM tasks t
      LEFT JOIN task_assignees ta ON t.id = ta.task_id
    `;
    
    if (whereClauses.length > 0) {
      countQuery += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    
    const [countResult] = await db.execute(countQuery, params);
    const total = countResult[0].total;
    
    if (usePagination) {
      const totalPages = Math.ceil(total / limitNum);
      res.json({
        data: tasks,
        pagination: {
          currentPage: pageNum,
          totalPages,
          total,
          limit: limitNum,
          offset: (pageNum - 1) * limitNum
        }
      });
    } else {
      res.json(tasks);
    }
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get task assignees
router.get('/:id/assignees', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    
    const [assignees] = await db.execute(`
      SELECT 
        ta.user_id,
        ta.assigned_at,
        u.first_name,
        u.last_name,
        u.username,
        CONCAT(ab.first_name, ' ', ab.last_name) as assigned_by_name
      FROM task_assignees ta
      JOIN users u ON ta.user_id = u.id
      LEFT JOIN users ab ON ta.assigned_by = ab.id
      WHERE ta.task_id = ?
      ORDER BY ta.assigned_at ASC
    `, [id]);
    
    res.json(assignees);
  } catch (error) {
    console.error('Error fetching task assignees:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get task details with assignees
router.get('/:id/details', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    const [taskDetails] = await db.execute(`
      SELECT 
        t.*,
        CONCAT(u1.first_name, ' ', u1.last_name) as assigned_to_name,
        CONCAT(u2.first_name, ' ', u2.last_name) as created_by_name,
        CONCAT(l.fname, ' ', l.lname) as lead_name,
        a.name as account_name,
        p.project_name as project_name
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      LEFT JOIN leads l ON t.lead_id = l.id
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.id = ?
    `, [id]);

    if (taskDetails.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskDetails[0];
    
    const [assignees] = await db.execute(`
      SELECT 
        ta.user_id, ta.assigned_at,
        CONCAT(u.first_name, ' ', u.last_name) AS name,
        u.first_name, u.last_name,
        CASE WHEN ta.user_id = ? THEN 1 ELSE 0 END as is_primary
      FROM task_assignees ta
      JOIN users u ON ta.user_id = u.id
      WHERE ta.task_id = ?
      ORDER BY is_primary DESC, ta.assigned_at ASC
    `, [task.assigned_to, id]);

    task.all_assignees = assignees.map(a => ({
      user_id: a.user_id, name: a.name, first_name: a.first_name,
      last_name: a.last_name, assigned_at: a.assigned_at, is_primary: a.is_primary === 1
    }));
    
    task.additional_assignees = assignees.filter(a => a.is_primary === 0).map(a => a.user_id);
    task.additional_assignees_names = assignees.filter(a => a.is_primary === 0).map(a => a.name);

    res.json(task);
  } catch (error) {
    console.error('Error fetching task details with assignees:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get task comments
router.get('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    
    const [comments] = await db.execute(`
      SELECT tc.*, u.first_name as user_first_name, u.last_name as user_last_name, u.username
      FROM task_comments tc
      JOIN users u ON tc.user_id = u.id
      WHERE tc.task_id = ?
      ORDER BY tc.created_at ASC
    `, [id]);
    
    res.json(comments);
  } catch (error) {
    console.error('Error fetching task comments:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add comment to task
router.post('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, mentions } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }
    
    const db = await getDb();
    
    const [result] = await db.execute(
      `INSERT INTO task_comments (task_id, user_id, content, mentions) VALUES (?, ?, ?, ?)`,
      [id, req.user.id, content.trim(), JSON.stringify(mentions || [])]
    );
    
    if (mentions && mentions.length > 0) {
      await createMentions(id, result.insertId, mentions, req.user.id, 'comment');
    }
    
    res.status(201).json({ id: result.insertId, message: 'Comment added successfully' });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get tasks assigned to the current user
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const { start_date, end_date } = req.query;
    
    let query = `
      SELECT DISTINCT t.*,
        CONCAT(u1.first_name, ' ', u1.last_name) as assigned_to_name,
        CONCAT(u2.first_name, ' ', u2.last_name) as created_by_name,
        CONCAT(l.fname, ' ', l.lname) as lead_name,
        a.name as account_name,
        CASE WHEN t.assigned_to = ? THEN 'primary' ELSE 'additional' END as assignment_type
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      LEFT JOIN leads l ON t.lead_id = l.id
      LEFT JOIN accounts a ON t.account_id = a.id
      INNER JOIN task_assignees ta ON t.id = ta.task_id
      WHERE ta.user_id = ?`;
    
    let params = [req.user.id, req.user.id];
    
    if (start_date && end_date) {
      query += ` AND t.deadline_date BETWEEN ? AND ?`;
      params.push(start_date, end_date);
    }
    
    query += ` ORDER BY CASE WHEN t.assigned_to = ? THEN 0 ELSE 1 END, t.deadline_date ASC`;
    params.push(req.user.id);
    
    const [tasks] = await db.execute(query, params);
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching my tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Enhanced notifications endpoint
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const userId = req.user.id;

    const [countResult] = await db.execute(`SELECT COUNT(DISTINCT t.id) as pending_count FROM tasks t INNER JOIN task_assignees ta ON t.id = ta.task_id WHERE ta.user_id = ? AND t.task_status IN ('pending', 'in_progress')`, [userId]);
    const [overdueTasks] = await db.execute(`SELECT DISTINCT t.*, CONCAT(l.fname, ' ', l.lname) as lead_name, a.name as account_name FROM tasks t LEFT JOIN leads l ON t.lead_id = l.id LEFT JOIN accounts a ON t.account_id = a.id INNER JOIN task_assignees ta ON t.id = ta.task_id WHERE ta.user_id = ? AND t.task_status IN ('pending', 'in_progress') AND t.deadline_date < NOW() ORDER BY t.deadline_date ASC LIMIT 5`, [userId]);
    const [upcomingTasks] = await db.execute(`SELECT DISTINCT t.*, CONCAT(l.fname, ' ', l.lname) as lead_name, a.name as account_name FROM tasks t LEFT JOIN leads l ON t.lead_id = l.id LEFT JOIN accounts a ON t.account_id = a.id INNER JOIN task_assignees ta ON t.id = ta.task_id WHERE ta.user_id = ? AND t.task_status IN ('pending', 'in_progress') AND t.deadline_date >= NOW() ORDER BY t.deadline_date ASC LIMIT 3`, [userId]);
    const [mentionCount] = await db.execute(`SELECT COUNT(*) as mention_count FROM task_mentions WHERE mentioned_user_id = ? AND is_read = FALSE`, [userId]);
    const [mentionedTasks] = await db.execute(`SELECT tm.id as mention_id, tm.task_id, tm.mention_type, tm.created_at as mentioned_at, t.*, CONCAT(l.fname, ' ', l.lname) as lead_name, a.name as account_name, CONCAT(u.first_name, ' ', u.last_name) as mentioned_by_name FROM task_mentions tm JOIN tasks t ON tm.task_id = t.id LEFT JOIN leads l ON t.lead_id = l.id LEFT JOIN accounts a ON t.account_id = a.id JOIN users u ON tm.mentioned_by_user_id = u.id WHERE tm.mentioned_user_id = ? AND tm.is_read = FALSE ORDER BY tm.created_at DESC LIMIT 10`, [userId]);

    res.json({
      pending_count: countResult[0].pending_count,
      overdue_tasks: overdueTasks,
      upcoming_tasks: upcomingTasks,
      unread_mentions: mentionCount[0].mention_count,
      mentioned_tasks: mentionedTasks
    });
  } catch (error) {
    console.error('Error fetching task notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark mentions as read
router.put('/mentions/read', authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.body;
    const db = await getDb();
    
    let query = 'UPDATE task_mentions SET is_read = TRUE WHERE mentioned_user_id = ?';
    let params = [req.user.id];
    
    if (taskId) {
      query += ' AND task_id = ?';
      params.push(taskId);
    }
    
    await db.execute(query, params);
    res.json({ message: 'Mentions marked as read' });
  } catch (error) {
    console.error('Error marking mentions as read:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new task
router.post('/', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const {
      task_name, task_description, task_priority, assigned_to,
      additional_assignees, deadline_date, lead_id, account_id,
      project_id, is_recurring = false, recurrence_pattern,
      recurrence_interval = 1, recurrence_end_date
    } = req.body;

    if (!task_name || !assigned_to || !deadline_date) {
      return res.status(400).json({ error: 'Task Name, Assignee, and Deadline are required.' });
    }

    const db = await getDb();
    await db.execute('START TRANSACTION');
    
    try {
      const allAssigneeIds = [...new Set([parseInt(assigned_to), ...(additional_assignees || []).map(id => parseInt(id))])];
      
      let nextOccurrence = null;
      if (is_recurring && recurrence_pattern) {
        nextOccurrence = calculateNextOccurrence(deadline_date, recurrence_pattern, recurrence_interval);
      }
      
      const [result] = await db.execute(
        `INSERT INTO tasks (task_name, task_description, task_priority, assigned_to, created_by, deadline_date, lead_id, account_id, has_multiple_assignees, project_id, is_recurring, recurrence_pattern, recurrence_interval, recurrence_end_date, next_occurrence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [task_name, task_description, task_priority, assigned_to, req.user.id, deadline_date, lead_id || null, account_id || null, allAssigneeIds.length > 1, project_id || null, is_recurring, recurrence_pattern || null, recurrence_interval, recurrence_end_date || null, nextOccurrence]
      );
      
      const taskId = result.insertId;
      
      for (const userId of allAssigneeIds) {
        await db.execute(`INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (?, ?, ?)`, [taskId, userId, req.user.id]);
      }
      
      const assigneesToMention = allAssigneeIds.filter(id => id !== req.user.id);
      if (assigneesToMention.length > 0) {
        await createMentions(taskId, null, assigneesToMention, req.user.id, 'assignment');
      }
      
      await db.execute('COMMIT');
      
      const userName = `${req.user.first_name} ${req.user.last_name}`;
      await logTaskHistoryToParent({ task_name, lead_id, account_id }, req.user.id, userName, 'created');
      
      res.status(201).json({ id: taskId, message: 'Task created successfully', is_recurring, next_occurrence: nextOccurrence });
    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update task
router.put('/:id', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const db = await getDb();
    
    const [currentTask] = await db.execute('SELECT * FROM tasks WHERE id = ?', [id]);
    if (currentTask.length === 0) return res.status(404).json({ error: 'Task not found' });
    
    const oldTask = currentTask[0];
    const oldStatus = oldTask.task_status;
    const { additional_assignees, ...taskDetails } = updates;
    const hasAssigneeUpdate = updates.hasOwnProperty('assigned_to') || updates.hasOwnProperty('additional_assignees');

    await db.execute('START TRANSACTION');
    try {
      const allowedFields = [
        'task_name', 'task_description', 'task_priority', 'task_status', 'deadline_date', 
        'completed_at', 'is_recurring', 'recurrence_pattern', 'recurrence_interval', 
        'recurrence_end_date', 'project_id', 'lead_id', 'account_id'
      ];
      
      const updateFields = [];
      const updateValues = [];

      for (const [field, value] of Object.entries(taskDetails)) {
        if (allowedFields.includes(field)) {
          updateFields.push(`${field} = ?`);
          updateValues.push(value);
        }
      }

      const newSettings = { ...oldTask, ...updates };
      let nextOccurrence = oldTask.next_occurrence;

      if (updates.hasOwnProperty('is_recurring') || updates.hasOwnProperty('deadline_date') || updates.hasOwnProperty('recurrence_pattern') || updates.hasOwnProperty('recurrence_interval')) {
        if (newSettings.is_recurring && newSettings.recurrence_pattern) {
          nextOccurrence = calculateNextOccurrence(newSettings.deadline_date, newSettings.recurrence_pattern, newSettings.recurrence_interval);
        } else {
          nextOccurrence = null;
        }
        updateFields.push('next_occurrence = ?');
        updateValues.push(nextOccurrence);
      }
      
      if (updateFields.length > 0) {
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(id);
        await db.execute(`UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
      }

      if (hasAssigneeUpdate) {
        const primaryAssignee = parseInt(updates.assigned_to);
        const additionalAssigneesArr = (updates.additional_assignees || []).map(id => parseInt(id));
        const newAssigneeIds = [...new Set([primaryAssignee, ...additionalAssigneesArr])];
        
        const [currentAssignees] = await db.execute('SELECT user_id FROM task_assignees WHERE task_id = ?', [id]);
        const currentIds = currentAssignees.map(a => a.user_id);
        
        const toRemove = currentIds.filter(userId => !newAssigneeIds.includes(userId));

        if (toRemove.length > 0) {
          const placeholders = toRemove.map(() => '?').join(',');
          const params = [id, ...toRemove];
          await db.execute(`DELETE FROM task_assignees WHERE task_id = ? AND user_id IN (${placeholders})`, params);
        }

        const toAdd = newAssigneeIds.filter(userId => !currentIds.includes(userId));
        for (const userId of toAdd) {
          await db.execute('INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (?, ?, ?)', [id, userId, req.user.id]);
          await createMentions(id, null, [userId], req.user.id, 'assignment');
        }

        await db.execute('UPDATE tasks SET assigned_to = ?, has_multiple_assignees = ? WHERE id = ?', [primaryAssignee, newAssigneeIds.length > 1, id]);
      }
      
      const newStatus = updates.task_status;
      if (newStatus && newStatus !== oldStatus) {
          const userName = `${req.user.first_name} ${req.user.last_name}`;
          await logTaskHistoryToParent({ task_name: oldTask.task_name, lead_id: oldTask.lead_id, account_id: oldTask.account_id }, req.user.id, userName, 'updated', oldStatus, newStatus);
          
          const [assignees] = await db.execute('SELECT user_id FROM task_assignees WHERE task_id = ? AND user_id != ?', [id, req.user.id]);
          if (assignees.length > 0) {
            await createMentions(id, null, assignees.map(a => a.user_id), req.user.id, 'status_change');
          }
      }
      
      await db.execute('COMMIT');
      res.json({ message: 'Task updated successfully' });
    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete task
router.delete('/:id', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    
    const [currentTask] = await db.execute('SELECT * FROM tasks WHERE id = ?', [id]);
    if (currentTask.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const taskToDelete = currentTask[0];
    
    await db.execute('START TRANSACTION');
    try {
      await db.execute('DELETE FROM task_mentions WHERE task_id = ?', [id]);
      await db.execute('DELETE FROM task_comments WHERE task_id = ?', [id]);
      await db.execute('DELETE FROM task_assignees WHERE task_id = ?', [id]);
      await db.execute('DELETE FROM tasks WHERE id = ?', [id]);
      await db.execute('COMMIT');
      
      const userName = `${req.user.first_name} ${req.user.last_name}`;
      await logTaskHistoryToParent({ task_name: taskToDelete.task_name, lead_id: taskToDelete.lead_id, account_id: taskToDelete.account_id }, req.user.id, userName, 'deleted');

      res.json({ success: true, message: 'Task deleted successfully' });
    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get recurring task details
router.get('/:id/recurring-info', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    
    const [taskInfo] = await db.execute(`SELECT id, task_name, is_recurring, recurrence_pattern, recurrence_interval, recurrence_end_date, next_occurrence, parent_recurring_task_id FROM tasks WHERE id = ?`, [id]);
    
    if (taskInfo.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const task = taskInfo[0];
    
    if (task.is_recurring) {
      const [instances] = await db.execute(`SELECT id, task_name, deadline_date, task_status, created_at FROM tasks WHERE parent_recurring_task_id = ? OR id = ? ORDER BY deadline_date ASC`, [id, id]);
      task.instances = instances;
    }
    
    if (task.parent_recurring_task_id) {
      const [parentInfo] = await db.execute(`SELECT id, task_name, recurrence_pattern, recurrence_interval, recurrence_end_date, next_occurrence FROM tasks WHERE id = ?`, [task.parent_recurring_task_id]);
      if (parentInfo.length > 0) {
        task.parent_info = parentInfo[0];
      }
    }
    
    res.json(task);
  } catch (error) {
    console.error('Error fetching recurring task info:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stop a recurring task
router.put('/:id/stop-recurring', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    
    await db.execute(`UPDATE tasks SET next_occurrence = NULL, recurrence_end_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_recurring = TRUE`, [id]);
    
    res.json({ message: 'Recurring task has been stopped.' });
  } catch (error) {
    console.error('Error stopping recurring task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get subtasks for a task
router.get('/:id/subtasks', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    
    const [subtasks] = await db.execute(`
      SELECT 
        ts.*,
        CONCAT(u1.first_name, ' ', u1.last_name) as created_by_name,
        CONCAT(u2.first_name, ' ', u2.last_name) as completed_by_name
      FROM task_subtasks ts
      LEFT JOIN users u1 ON ts.created_by = u1.id
      LEFT JOIN users u2 ON ts.completed_by = u2.id
      WHERE ts.task_id = ?
      ORDER BY ts.position ASC, ts.created_at ASC
    `, [id]);
    
    res.json(subtasks);
  } catch (error) {
    console.error('Error fetching subtasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new subtask
router.post('/:id/subtasks', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, position } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Subtask title is required' });
    }
    
    const db = await getDb();
    
    // Verify task exists
    const [task] = await db.execute('SELECT id FROM tasks WHERE id = ?', [id]);
    if (task.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Get the next position if not provided
    let subtaskPosition = position;
    if (subtaskPosition === undefined || subtaskPosition === null) {
      const [maxPos] = await db.execute(
        'SELECT COALESCE(MAX(position), -1) + 1 as next_position FROM task_subtasks WHERE task_id = ?',
        [id]
      );
      subtaskPosition = maxPos[0].next_position;
    }
    
    const [result] = await db.execute(
      `INSERT INTO task_subtasks (task_id, title, position, created_by) VALUES (?, ?, ?, ?)`,
      [id, title.trim(), subtaskPosition, req.user.id]
    );
    
    res.status(201).json({ 
      id: result.insertId, 
      message: 'Subtask created successfully' 
    });
  } catch (error) {
    console.error('Error creating subtask:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a subtask (toggle completion or edit title)
router.put('/:taskId/subtasks/:subtaskId', authenticateToken, async (req, res) => {
  try {
    const { taskId, subtaskId } = req.params;
    const { is_completed, title, position } = req.body;
    const db = await getDb();
    
    const updateFields = [];
    const updateValues = [];
    
    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({ error: 'Subtask title cannot be empty' });
      }
      updateFields.push('title = ?');
      updateValues.push(title.trim());
    }
    
    if (is_completed !== undefined) {
      updateFields.push('is_completed = ?');
      updateValues.push(is_completed);
      
      if (is_completed) {
        updateFields.push('completed_by = ?', 'completed_at = CURRENT_TIMESTAMP');
        updateValues.push(req.user.id);
      } else {
        updateFields.push('completed_by = NULL', 'completed_at = NULL');
      }
    }
    
    if (position !== undefined && position !== null) {
      updateFields.push('position = ?');
      updateValues.push(position);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(subtaskId, taskId);
    
    await db.execute(
      `UPDATE task_subtasks SET ${updateFields.join(', ')} WHERE id = ? AND task_id = ?`,
      updateValues
    );
    
    res.json({ message: 'Subtask updated successfully' });
  } catch (error) {
    console.error('Error updating subtask:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a subtask
router.delete('/:taskId/subtasks/:subtaskId', authenticateToken, async (req, res) => {
  try {
    const { taskId, subtaskId } = req.params;
    const db = await getDb();
    
    const [result] = await db.execute(
      'DELETE FROM task_subtasks WHERE id = ? AND task_id = ?',
      [subtaskId, taskId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Subtask not found' });
    }
    
    res.json({ message: 'Subtask deleted successfully' });
  } catch (error) {
    console.error('Error deleting subtask:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reorder subtasks
router.put('/:id/subtasks/reorder', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { subtasks } = req.body; // Array of { id, position }
    
    if (!Array.isArray(subtasks)) {
      return res.status(400).json({ error: 'Subtasks must be an array' });
    }
    
    const db = await getDb();
    await db.execute('START TRANSACTION');
    
    try {
      for (const subtask of subtasks) {
        await db.execute(
          'UPDATE task_subtasks SET position = ? WHERE id = ? AND task_id = ?',
          [subtask.position, subtask.id, id]
        );
      }
      
      await db.execute('COMMIT');
      res.json({ message: 'Subtasks reordered successfully' });
    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error reordering subtasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get recurring tasks for current user
router.get('/recurring', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    
    const [recurringTasks] = await db.execute(`
      SELECT DISTINCT t.*,
        CONCAT(u1.first_name, ' ', u1.last_name) as assigned_to_name,
        CONCAT(u2.first_name, ' ', u2.last_name) as created_by_name,
        GROUP_CONCAT(DISTINCT ta.user_id SEPARATOR ',') AS all_assignees_ids
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      INNER JOIN task_assignees ta ON t.id = ta.task_id
      WHERE t.is_recurring = TRUE
        AND t.next_occurrence IS NOT NULL
        AND ta.user_id = ?
      GROUP BY t.id
      ORDER BY t.next_occurrence ASC
    `, [req.user.id]);
    
    res.json(recurringTasks);
  } catch (error) {
    console.error('Error fetching recurring tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

  return router;
};