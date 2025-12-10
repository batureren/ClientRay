// scheduledTasks/recurringTaskScheduler.js
const cron = require('node-cron');
// Import the centralized date calculation utility
const { calculateNextOccurrence } = require('../utils/dateCalculator');

class RecurringTaskScheduler {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
    this.getDb = null;
  }

  // Initialize with dependencies
  initialize(dependencies) {
    this.getDb = dependencies.getDb;
  }

  startScheduler() {
    if (!this.getDb) {
      throw new Error('RecurringTaskScheduler not initialized with dependencies');
    }

    if (this.isRunning) {
      console.log('Recurring task scheduler is already running');
      return;
    }

    // Run every 15 minutes
    this.cronJob = cron.schedule('*/15 * * * *', async () => {
      console.log('Checking for recurring tasks to generate...');
      await this.generateRecurringTasks();
    }, {
      scheduled: false
    });

    this.cronJob.start();
    this.isRunning = true;
    console.log('Recurring task scheduler started - checking every 15 minutes');

    // Run once immediately after startup to catch any missed tasks
    setTimeout(() => {
      this.generateRecurringTasks();
    }, 10000);
  }

  stopScheduler() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.isRunning = false;
      console.log('Recurring task scheduler stopped');
    }
  }

  async createMentions(taskId, mentions, mentionedById, mentionType = 'recurring_assignment') {
    if (!mentions || mentions.length === 0) return;
    
    const db = await this.getDb();
    for (const userId of mentions) {
      try {
        await db.execute(
          `INSERT INTO task_mentions (task_id, mentioned_user_id, mentioned_by_user_id, mention_type)
           VALUES (?, ?, ?, ?)`,
          [taskId, userId, mentionedById, mentionType]
        );
      } catch (error) {
        console.error('Error creating mention:', error);
      }
    }
  }

  async generateRecurringTasks() {
    try {
      const db = await this.getDb();
      
      // Find recurring tasks that need new instances
      // Use COALESCE to handle NULL next_occurrence by comparing with deadline_date

      const [recurringTasks] = await db.execute(`
        SELECT t.*, 
               COALESCE(t.next_occurrence, t.deadline_date) as effective_next_occurrence
        FROM tasks t
        WHERE t.is_recurring = TRUE 
          AND t.task_status != 'cancelled'
          AND t.next_occurrence IS NOT NULL
          AND (t.recurrence_end_date IS NULL OR t.recurrence_end_date > NOW())
          AND t.next_occurrence <= NOW()
      `);
      
      let generatedCount = 0;
      
      for (const task of recurringTasks) {
        try {
          await db.execute('START TRANSACTION');

          const newInstanceDeadline = task.next_occurrence || task.deadline_date;

          const followingOccurrence = calculateNextOccurrence(
            newInstanceDeadline, 
            task.recurrence_pattern, 
            task.recurrence_interval || 1
          );
          
          // Check if the recurrence period should end.
          if (task.recurrence_end_date && newInstanceDeadline > new Date(task.recurrence_end_date)) {
            await db.execute(
              'UPDATE tasks SET next_occurrence = NULL WHERE id = ?',
              [task.id]
            );
            await db.execute('COMMIT');
            console.log(`Recurring task ${task.id} reached end date, stopping recurrence.`);
            continue;
          }
          
          // Get additional assignees
          const [assignees] = await db.execute('SELECT user_id FROM task_assignees WHERE task_id = ?', [task.id]);
          const allAssigneeIds = assignees.map(a => a.user_id);
          
          // Create new task instance using the deadline that was actually due.
          const [newTaskResult] = await db.execute(`
            INSERT INTO tasks (
              task_name, task_description, task_priority, 
              assigned_to, created_by, deadline_date, lead_id, account_id,
              project_id, has_multiple_assignees,
              is_recurring, recurrence_pattern, recurrence_interval,
              recurrence_end_date, 
              parent_recurring_task_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            task.task_name,
            task.task_description,
            task.task_priority,
            task.assigned_to,
            task.created_by,
            newInstanceDeadline, // Use the correct deadline for the new task
            task.lead_id,
            task.account_id,
            task.project_id,
            task.has_multiple_assignees,
            false, 
            null, null, null,
            task.id
          ]);
          
          const newTaskId = newTaskResult.insertId;
          
          // Re-create all assignee links for the new task
          for (const userId of allAssigneeIds) {
            await db.execute('INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (?, ?, ?)', [newTaskId, userId, task.created_by]);
          }
          
          // Create mentions for all assignees except the creator
          const assigneesToMention = allAssigneeIds.filter(id => id && id !== task.created_by);
          if (assigneesToMention.length > 0) {
            await this.createMentions(newTaskId, assigneesToMention, task.created_by, 'recurring_assignment');
          }
          
          // Update parent task's next_occurrence to the date we calculated earlier.
          let nextOccurrenceToSet = followingOccurrence;
          if (task.recurrence_end_date && followingOccurrence > new Date(task.recurrence_end_date)) {
            nextOccurrenceToSet = null; // Stop future recurrences 
          }
          
          await db.execute(
            'UPDATE tasks SET next_occurrence = ? WHERE id = ?',
            [nextOccurrenceToSet, task.id]
          );
          
          await db.execute('COMMIT');
          generatedCount++;
          
          console.log(`Generated recurring task instance ${newTaskId} for parent ${task.id}. Next occurrence set to: ${nextOccurrenceToSet}`);
          
        } catch (taskError) {
          await db.execute('ROLLBACK');
          console.error(`Error processing recurring task ${task.id}:`, taskError);
          continue;
        }
      }
      
      if (generatedCount > 0) {
        console.log(`Generated ${generatedCount} new recurring task instances.`);
      }
      
    } catch (error) {
      console.error('Error during recurring task generation cycle:', error);
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      nextRun: this.cronJob ? this.cronJob.nextDate() : null
    };
  }

  // Manual trigger for testing or admin purposes
  async triggerManualCheck() {
    console.log('Manual recurring task check triggered by admin.');
    await this.generateRecurringTasks();
  }
}

module.exports = new RecurringTaskScheduler();