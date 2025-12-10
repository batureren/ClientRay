// utils/campaignGoalCalculator.js

/**
 * Calculate goal progress for different campaign types and goal types
 */
class CampaignGoalCalculator {
  constructor(getDb) {
    this.getDb = getDb;
  }
  
  /**
   * Calculate progress for all campaigns or a specific campaign
   */
  async calculateCampaignProgress(campaignId = null) {
    const db = await this.getDb();
    
    try {
      let campaignQuery = `
        SELECT id, campaign_type, goal_type, goal_value, start_date, end_date, is_open_campaign
        FROM campaigns 
        WHERE status = 'active'
      `;
      
      const params = [];
      if (campaignId) {
        campaignQuery += ' AND id = ?';
        params.push(campaignId);
      }
      
      const [campaigns] = await db.execute(campaignQuery, params);
      
      for (const campaign of campaigns) {
        const progress = await this.calculateSingleCampaignProgress(campaign);
        
        // Update campaign's current_value
        await db.execute(
          'UPDATE campaigns SET current_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [progress.current_value, campaign.id]
        );
        
        console.log(`Updated campaign ${campaign.id}: ${progress.current_value}/${campaign.goal_value}`);
      }
      
      return { success: true, updated: campaigns.length };
    } catch (error) {
      console.error('Error calculating campaign progress:', error);
      throw error;
    }
  }
  
  /**
   * Calculate progress for a single campaign
   */
  async calculateSingleCampaignProgress(campaign) {
    const db = await this.getDb();
    
    const { id, campaign_type, goal_type, start_date, end_date, is_open_campaign } = campaign;
    
    // Get date range for calculation
    const dateRange = this.getCampaignDateRange(start_date, end_date, is_open_campaign);
    
    let current_value = 0;
    
    if (campaign_type === 'account') {
      current_value = await this.calculateAccountCampaignProgress(
        id, goal_type, dateRange.start, dateRange.end
      );
    } else if (campaign_type === 'lead') {
      current_value = await this.calculateLeadCampaignProgress(
        id, goal_type, dateRange.start, dateRange.end
      );
    }
    
    return {
      campaign_id: id,
      current_value,
      calculation_date: new Date().toISOString()
    };
  }
  
  /**
   * Calculate progress for account campaigns
   */
  async calculateAccountCampaignProgress(campaignId, goalType, startDate, endDate) {
    const db = await this.getDb();
    let current_value = 0;
    
    try {
      switch (goalType) {
        case 'sales':
          // Sum total_amount of products purchased within date range
          const [salesResult] = await db.execute(`
            SELECT COALESCE(SUM(ap.total_amount), 0) as total_sales
            FROM account_products ap
            JOIN campaign_participants cp ON ap.account_id = cp.entity_id 
              AND cp.entity_type = 'account' 
              AND cp.campaign_id = ?
            WHERE ap.status IN ('delivered', 'completed', 'active')
              AND ap.purchase_date IS NOT NULL
              AND DATE(ap.purchase_date) BETWEEN ? AND ?
              AND cp.status = 'active'
          `, [campaignId, startDate, endDate]);
          
          current_value = parseFloat(salesResult[0].total_sales) || 0;
          break;
          
        case 'revenue':
          // Similar to sales but might include different statuses or calculations
          const [revenueResult] = await db.execute(`
            SELECT COALESCE(SUM(ap.total_amount), 0) as total_revenue
            FROM account_products ap
            JOIN campaign_participants cp ON ap.account_id = cp.entity_id 
              AND cp.entity_type = 'account' 
              AND cp.campaign_id = ?
            WHERE ap.status IN ('delivered', 'completed')
              AND ap.purchase_date IS NOT NULL
              AND DATE(ap.purchase_date) BETWEEN ? AND ?
              AND cp.status = 'active'
          `, [campaignId, startDate, endDate]);
          
          current_value = parseFloat(revenueResult[0].total_revenue) || 0;
          break;
          
        case 'meetings':
          // Count meetings/calls with campaign accounts within date range
          const [meetingsResult] = await db.execute(`
            SELECT COUNT(*) as total_meetings
            FROM account_calls ac
            JOIN campaign_participants cp ON ac.account_id = cp.entity_id 
              AND cp.entity_type = 'account' 
              AND cp.campaign_id = ?
            WHERE DATE(ac.call_date) BETWEEN ? AND ?
              AND ac.category IN ('meeting', 'demo', 'presentation')
              AND cp.status = 'active'
          `, [campaignId, startDate, endDate]);
          
          current_value = parseInt(meetingsResult[0].total_meetings) || 0;
          break;
          
        default:
          console.warn(`Unknown goal type for account campaign: ${goalType}`);
      }
    } catch (error) {
      console.error(`Error calculating account campaign progress for ${goalType}:`, error);
    }
    
    return current_value;
  }
  
  /**
   * Calculate progress for lead campaigns
   */
  async calculateLeadCampaignProgress(campaignId, goalType, startDate, endDate) {
    const db = await this.getDb();
    let current_value = 0;
    
    try {
      switch (goalType) {
        case 'conversion':
          // Count leads that changed status to 'converted' within date range
          const [conversionResult] = await db.execute(`
            SELECT COUNT(*) as total_conversions
            FROM leads l
            JOIN campaign_participants cp ON l.id = cp.entity_id 
              AND cp.entity_type = 'lead' 
              AND cp.campaign_id = ?
            WHERE l.lead_status = 'converted'
              AND DATE(l.updated_at) BETWEEN ? AND ?
              AND cp.status = 'active'
          `, [campaignId, startDate, endDate]);
          
          current_value = parseInt(conversionResult[0].total_conversions) || 0;
          break;
          
        case 'new_added':
          // Count new leads added to campaign within date range
          const [newLeadsResult] = await db.execute(`
            SELECT COUNT(*) as total_new_leads
            FROM campaign_participants cp
            WHERE cp.campaign_id = ?
              AND cp.entity_type = 'lead'
              AND DATE(cp.joined_at) BETWEEN ? AND ?
              AND cp.status = 'active'
          `, [campaignId, startDate, endDate]);
          
          current_value = parseInt(newLeadsResult[0].total_new_leads) || 0;
          break;
          
        case 'status_change':
          // Count leads that had any status change within date range
          const [statusChangeResult] = await db.execute(`
            SELECT COUNT(DISTINCT l.id) as total_status_changes
            FROM leads l
            JOIN campaign_participants cp ON l.id = cp.entity_id 
              AND cp.entity_type = 'lead' 
              AND cp.campaign_id = ?
            WHERE DATE(l.updated_at) BETWEEN ? AND ?
              AND cp.status = 'active'
          `, [campaignId, startDate, endDate]);
          
          current_value = parseInt(statusChangeResult[0].total_status_changes) || 0;
          break;
          
        default:
          console.warn(`Unknown goal type for lead campaign: ${goalType}`);
      }
    } catch (error) {
      console.error(`Error calculating lead campaign progress for ${goalType}:`, error);
    }
    
    return current_value;
  }
  
  /**
   * Get date range for campaign calculation
   */
  getCampaignDateRange(startDate, endDate, isOpenCampaign) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    if (isOpenCampaign) {
      // For open campaigns, calculate from campaign start to today
      return {
        start: startDate || '2020-01-01', // Default start if no start date
        end: today
      };
    } else {
      // For time-bound campaigns, use the campaign date range
      return {
        start: startDate,
        end: endDate
      };
    }
  }
  
  /**
   * Update participant contribution when a qualifying action occurs
   */
  async updateParticipantContribution(campaignId, entityType, entityId, contributionValue, activity = null) {
    const db = await this.getDb();
    
    try {
      // Update participant contribution
      await db.execute(`
        UPDATE campaign_participants 
        SET contribution = COALESCE(contribution, 0) + ?
        WHERE campaign_id = ? AND entity_type = ? AND entity_id = ?
      `, [contributionValue, campaignId, entityType, entityId]);
      
      // Log activity if provided
      if (activity) {
        await db.execute(`
          INSERT INTO campaign_activities 
          (campaign_id, entity_type, entity_id, activity_type, activity_description, value_contributed, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          campaignId, 
          entityType, 
          entityId, 
          activity.type, 
          activity.description, 
          contributionValue, 
          activity.created_by || null
        ]);
      }
      
      // Recalculate campaign progress
      await this.calculateCampaignProgress(campaignId);
      
    } catch (error) {
      console.error('Error updating participant contribution:', error);
      throw error;
    }
  }
  
  /**
   * Trigger goal calculation when relevant data changes
   */
  async triggerGoalCalculation(entityType, entityId, changeType, additionalData = {}) {
    const db = await this.getDb();
    
    try {
      // Find campaigns that this entity participates in
      const [campaigns] = await db.execute(`
        SELECT DISTINCT cp.campaign_id, c.campaign_type, c.goal_type
        FROM campaign_participants cp
        JOIN campaigns c ON cp.campaign_id = c.id
        WHERE cp.entity_type = ? AND cp.entity_id = ? AND cp.status = 'active'
          AND c.status = 'active'
      `, [entityType, entityId]);
      
      for (const campaign of campaigns) {
        // Check if this change type is relevant for this campaign's goal
        if (this.isRelevantChange(campaign.campaign_type, campaign.goal_type, changeType)) {
          await this.calculateCampaignProgress(campaign.campaign_id);
          
          // Log the trigger
          console.log(`Triggered goal calculation for campaign ${campaign.campaign_id} due to ${changeType} on ${entityType} ${entityId}`);
        }
      }
      
    } catch (error) {
      console.error('Error triggering goal calculation:', error);
    }
  }
  
  /**
   * Check if a change type is relevant for a specific campaign goal
   */
  isRelevantChange(campaignType, goalType, changeType) {
    const relevantChanges = {
      account: {
        sales: ['product_assigned', 'product_updated', 'product_status_changed'],
        revenue: ['product_assigned', 'product_updated', 'product_status_changed'],
        meetings: ['call_logged', 'meeting_scheduled']
      },
      lead: {
        conversion: ['status_changed', 'lead_updated'],
        new_added: ['participant_added'],
        status_change: ['status_changed', 'lead_updated']
      }
    };
    
    return relevantChanges[campaignType]?.[goalType]?.includes(changeType) || false;
  }
}

module.exports = CampaignGoalCalculator;