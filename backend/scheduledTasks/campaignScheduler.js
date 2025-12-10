// scheduledTasks/campaignScheduler.js
const cron = require('node-cron');

class CampaignScheduler {
  static isScheduled = false;
  static scheduledTasks = new Map();
  static getDb = null;
  static campaignGoalCalculator = null;

  /**
   * Initialize the scheduler with dependencies
   */
  static initialize(dependencies) {
    this.getDb = dependencies.getDb;
    this.campaignGoalCalculator = dependencies.CampaignGoalCalculator;
  }

  static startScheduler() {
    if (!this.getDb) {
      throw new Error('CampaignScheduler not initialized with dependencies');
    }

    if (this.isScheduled) {
      console.log('Campaign scheduler is already running');
      return;
    }

    // Schedule daily calculation at 6 AM
    const dailyTask = cron.schedule('0 6 * * *', async () => {
      console.log('Running daily campaign goal calculation...');
      try {
        const result = await this.campaignGoalCalculator.calculateCampaignProgress();
        console.log(`Daily calculation completed: ${result.updated} campaigns updated`);
      } catch (error) {
        console.error('Error in daily campaign calculation:', error);
      }
    }, {
      scheduled: false,
      timezone: "America/New_York" // Adjust timezone as needed
    });

    // Schedule hourly calculation for active campaigns with recent activity
    const hourlyTask = cron.schedule('0 * * * *', async () => {
      console.log('Running hourly campaign goal calculation for active campaigns...');
      try {
        await this.calculateRecentlyActiveCampaigns();
      } catch (error) {
        console.error('Error in hourly campaign calculation:', error);
      }
    }, {
      scheduled: false
    });

    // Schedule calculation for campaigns ending soon (runs at 9 AM daily)
    const endingSoonTask = cron.schedule('0 9 * * *', async () => {
      console.log('Running calculation for campaigns ending soon...');
      try {
        await this.calculateEndingSoonCampaigns();
      } catch (error) {
        console.error('Error in ending soon calculation:', error);
      }
    }, {
      scheduled: false
    });

    this.scheduledTasks.set('daily', dailyTask);
    this.scheduledTasks.set('hourly', hourlyTask);
    this.scheduledTasks.set('endingSoon', endingSoonTask);

    // Start the tasks
    dailyTask.start();
    hourlyTask.start();
    endingSoonTask.start();

    this.isScheduled = true;
    console.log('Campaign goal calculation scheduler started');
  }

  /**
   * Stop the campaign scheduler
   */
  static stopScheduler() {
    if (!this.isScheduled) {
      console.log('Campaign scheduler is not running');
      return;
    }

    this.scheduledTasks.forEach((task, name) => {
      task.stop();
      console.log(`Stopped ${name} campaign calculation task`);
    });

    this.scheduledTasks.clear();
    this.isScheduled = false;
    console.log('Campaign goal calculation scheduler stopped');
  }

  /**
   * Calculate goals for campaigns with recent activity
   */
  static async calculateRecentlyActiveCampaigns() {
    const db = await this.getDb();

    try {
      // Find campaigns that had activities in the last 2 hours
      const [recentCampaigns] = await db.execute(`
        SELECT DISTINCT c.id, c.name
        FROM campaigns c
        JOIN campaign_activities ca ON c.id = ca.campaign_id
        WHERE c.status = 'active' 
          AND ca.created_at >= DATE_SUB(NOW(), INTERVAL 2 HOUR)
        ORDER BY ca.created_at DESC
      `);

      console.log(`Found ${recentCampaigns.length} campaigns with recent activity`);

      for (const campaign of recentCampaigns) {
        try {
          await this.campaignGoalCalculator.calculateCampaignProgress(campaign.id);
          console.log(`Updated campaign: ${campaign.name} (${campaign.id})`);
        } catch (error) {
          console.error(`Error updating campaign ${campaign.id}:`, error);
        }
      }

      return { updated: recentCampaigns.length };
    } catch (error) {
      console.error('Error in calculateRecentlyActiveCampaigns:', error);
      throw error;
    }
  }

  /**
   * Schedule a one-time calculation for a specific campaign
   */
  static scheduleOneTimeCalculation(campaignId, delayInMinutes = 5) {
    const taskName = `campaign-${campaignId}-${Date.now()}`;
    
    // Calculate the cron expression for the delay
    const now = new Date();
    const targetTime = new Date(now.getTime() + (delayInMinutes * 60 * 1000));
    const cronExpression = `${targetTime.getMinutes()} ${targetTime.getHours()} ${targetTime.getDate()} ${targetTime.getMonth() + 1} *`;

    const task = cron.schedule(cronExpression, async () => {
      console.log(`Running scheduled calculation for campaign ${campaignId}`);
      try {
        await this.campaignGoalCalculator.calculateCampaignProgress(campaignId);
        console.log(`Scheduled calculation completed for campaign ${campaignId}`);
      } catch (error) {
        console.error(`Error in scheduled calculation for campaign ${campaignId}:`, error);
      }
      
      // Clean up the task
      task.stop();
      this.scheduledTasks.delete(taskName);
    }, {
      scheduled: true
    });

    this.scheduledTasks.set(taskName, task);
    console.log(`Scheduled calculation for campaign ${campaignId} in ${delayInMinutes} minutes`);
  }

  /**
   * Get status of the scheduler
   */
  static getSchedulerStatus() {
    return {
      isRunning: this.isScheduled,
      activeTasks: Array.from(this.scheduledTasks.keys()),
      taskCount: this.scheduledTasks.size,
      uptime: this.isScheduled ? process.uptime() : 0
    };
  }

  /**
   * Force run calculation for all active campaigns
   */
  static async forceCalculateAll() {
    console.log('Force running campaign goal calculation for all active campaigns...');
    try {
      const result = await this.campaignGoalCalculator.calculateCampaignProgress();
      console.log(`Force calculation completed: ${result.updated} campaigns updated`);
      return result;
    } catch (error) {
      console.error('Error in force calculation:', error);
      throw error;
    }
  }

  /**
   * Calculate goals for campaigns ending soon (within 7 days)
   */
  static async calculateEndingSoonCampaigns() {
    const db = await this.getDb();

    try {
      const [endingSoon] = await db.execute(`
        SELECT id, name, end_date
        FROM campaigns 
        WHERE status = 'active' 
          AND is_open_campaign = 0
          AND end_date IS NOT NULL
          AND end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        ORDER BY end_date ASC
      `);

      console.log(`Found ${endingSoon.length} campaigns ending soon`);

      for (const campaign of endingSoon) {
        try {
          await this.campaignGoalCalculator.calculateCampaignProgress(campaign.id);
          console.log(`Updated ending soon campaign: ${campaign.name} (ends: ${campaign.end_date})`);
        } catch (error) {
          console.error(`Error updating ending campaign ${campaign.id}:`, error);
        }
      }

      return { updated: endingSoon.length };
    } catch (error) {
      console.error('Error in calculateEndingSoonCampaigns:', error);
      throw error;
    }
  }

  /**
   * Calculate goals for campaigns with specific criteria
   */
  static async calculateCampaignsByCriteria(criteria = {}) {
    const db = await this.getDb();

    try {
      let query = `
        SELECT DISTINCT c.id, c.name, c.goal_type, c.campaign_type
        FROM campaigns c
        WHERE c.status = 'active'
      `;
      
      const params = [];

      if (criteria.campaignType) {
        query += ' AND c.campaign_type = ?';
        params.push(criteria.campaignType);
      }

      if (criteria.goalType) {
        query += ' AND c.goal_type = ?';
        params.push(criteria.goalType);
      }

      if (criteria.hasRecentActivity) {
        query += ` 
          AND EXISTS (
            SELECT 1 FROM campaign_activities ca 
            WHERE ca.campaign_id = c.id 
              AND ca.created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
          )
        `;
        params.push(criteria.hasRecentActivity);
      }

      const [campaigns] = await db.execute(query, params);
      console.log(`Found ${campaigns.length} campaigns matching criteria`);

      let updated = 0;
      for (const campaign of campaigns) {
        try {
          await this.campaignGoalCalculator.calculateCampaignProgress(campaign.id);
          updated++;
          console.log(`Updated campaign: ${campaign.name} (${campaign.goal_type})`);
        } catch (error) {
          console.error(`Error updating campaign ${campaign.id}:`, error);
        }
      }

      return { total: campaigns.length, updated };
    } catch (error) {
      console.error('Error in calculateCampaignsByCriteria:', error);
      throw error;
    }
  }

  /**
   * Schedule periodic calculation for high-priority campaigns
   */
  static scheduleHighPriorityCampaigns() {
    if (this.scheduledTasks.has('highPriority')) {
      console.log('High priority task already scheduled');
      return;
    }

    // Run every 30 minutes for campaigns ending within 3 days
    const highPriorityTask = cron.schedule('*/30 * * * *', async () => {
      console.log('Running high priority campaign calculations...');
      try {
        const db = await this.getDb();

        const [priorityCampaigns] = await db.execute(`
          SELECT id, name, end_date
          FROM campaigns 
          WHERE status = 'active' 
            AND is_open_campaign = 0
            AND end_date IS NOT NULL
            AND end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 3 DAY)
            AND goal_value > 0
          ORDER BY end_date ASC
        `);

        for (const campaign of priorityCampaigns) {
          try {
            await this.campaignGoalCalculator.calculateCampaignProgress(campaign.id);
            console.log(`High priority update: ${campaign.name}`);
          } catch (error) {
            console.error(`Error in high priority update for ${campaign.id}:`, error);
          }
        }

      } catch (error) {
        console.error('Error in high priority campaign calculations:', error);
      }
    }, {
      scheduled: false
    });

    this.scheduledTasks.set('highPriority', highPriorityTask);
    highPriorityTask.start();
    console.log('High priority campaign calculation scheduled (every 30 minutes)');
  }

  /**
   * Get detailed statistics about scheduler performance
   */
  static async getSchedulerStats() {
    const db = await this.getDb();

    try {
      // Get campaign statistics
      const [campaignStats] = await db.execute(`
        SELECT 
          COUNT(*) as total_campaigns,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_campaigns,
          COUNT(CASE WHEN status = 'active' AND goal_value > 0 THEN 1 END) as active_with_goals,
          COUNT(CASE WHEN status = 'active' AND current_value >= goal_value AND goal_value > 0 THEN 1 END) as achieved_goals
        FROM campaigns
      `);

      // Get recent activity statistics
      const [activityStats] = await db.execute(`
        SELECT 
          COUNT(*) as total_activities_24h,
          COUNT(DISTINCT campaign_id) as active_campaigns_24h
        FROM campaign_activities 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `);

      return {
        scheduler: this.getSchedulerStatus(),
        campaigns: campaignStats[0],
        recent_activity: activityStats[0],
        last_updated: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting scheduler stats:', error);
      return {
        scheduler: this.getSchedulerStatus(),
        error: error.message
      };
    }
  }
}

module.exports = CampaignScheduler;