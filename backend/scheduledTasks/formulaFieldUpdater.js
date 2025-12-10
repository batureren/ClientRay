// scheduledTasks/formulaFieldUpdater.js
const cron = require('node-cron');

class FormulaFieldScheduler {
  constructor(getDbFunction) {
    this.scheduledJobs = new Map();
    this.customFieldDefMap = new Map();
    this.formulaEvaluator = null;
    this.getDb = getDbFunction; 
  }

  // Set the formula evaluator instance
  setFormulaEvaluator(evaluator) {
    this.formulaEvaluator = evaluator;
    console.log('✅ Formula evaluator set successfully');
  }

  async initializeScheduledUpdates() {
    try {
      if (!this.getDb) {
        throw new Error('getDb function not available');
      }

      const db = await this.getDb();
      
      // Cache custom field definitions
      const [defs] = await db.execute(`SELECT id, module, field_name FROM custom_field_definitions`);
      defs.forEach(def => {
        const key = `${def.module}:${def.field_name}`;
        this.customFieldDefMap.set(key, def.id);
      });
      console.log(`✅ Cached ${this.customFieldDefMap.size} custom field definitions.`);

      // Load and schedule formula fields
      const [formulaFields] = await db.execute(`
        SELECT id, module, field_name, formula_expression, update_schedule, last_updated, target_field_name
        FROM formula_field_definitions 
        WHERE is_active = true AND update_schedule IS NOT NULL AND update_schedule != 'manual'
      `);

      console.log(`📅 Initializing ${formulaFields.length} scheduled formula field updates...`);
      
      let scheduledCount = 0;
      for (const field of formulaFields) {
        const success = this.scheduleFormulaUpdate(field);
        if (success) scheduledCount++;
      }
      
      console.log(`✅ Formula field scheduler initialized: ${scheduledCount}/${formulaFields.length} fields scheduled`);
    } catch (error) {
      console.error('❌ Error initializing formula field scheduler:', error);
      throw error; // Re-throw to see the error in server startup
    }
  }

  scheduleFormulaUpdate(field) {
    if (!this.formulaEvaluator) {
      console.warn(`⚠️  Cannot schedule ${field.field_name}: Formula evaluator not set yet`);
      return false;
    }

    const cronExpression = this.getCronExpression(field.update_schedule);
    if (!cronExpression) {
      console.warn(`⚠️  Invalid schedule for ${field.field_name}: ${field.update_schedule}`);
      return false;
    }

    // Stop existing job if any
    if (this.scheduledJobs.has(field.id)) {
      this.scheduledJobs.get(field.id).stop();
    }

    try {
      const job = cron.schedule(cronExpression, async () => {
        console.log(`🔄 Running scheduled update for: ${field.field_name}`);
        await this.updateFormulaFieldValues(field);
      }, {
        scheduled: true,
        timezone: process.env.TZ || 'UTC'
      });

      this.scheduledJobs.set(field.id, job);
      console.log(`✅ Scheduled "${field.field_name}" (${field.update_schedule}) - Next run based on: ${cronExpression}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to schedule ${field.field_name}:`, error);
      return false;
    }
  }

  getCronExpression(schedule) {
    const scheduleMap = {
      'hourly': '0 * * * *',
      'daily': '0 2 * * *',
      'weekly': '0 2 * * 0',
      'monthly': '0 2 1 * *',
      'every_6_hours': '0 */6 * * *',
      'every_12_hours': '0 */12 * * *'
    };
    return scheduleMap[schedule] || null;
  }

  async updateFormulaFieldValues(field) {
    const startTime = Date.now();
    console.log(`\n📊 Starting update for formula field: ${field.field_name}`);
    
    try {
      if (!this.formulaEvaluator) {
        throw new Error('Formula evaluator not initialized');
      }

      const db = await this.getDb();
      const moduleTable = field.module === 'leads' ? 'leads' : 'accounts';
      const [records] = await db.execute(`SELECT id FROM ${moduleTable}`);

      console.log(`   Processing ${records.length} ${field.module} records...`);

      const allowedStandardFields = {
        leads: ['fname', 'lname', 'email_address', 'phone_number', 'company_name', 'address', 'city', 'state', 'zip_code', 'country', 'website_url', 'source', 'comments', 'lead_status', 'lead_score'],
        accounts: ['name', 'type', 'industry', 'revenue', 'employees', 'contact_fname', 'contact_lname', 'contact_email', 'contact_phone', 'billing_address', 'billing_city', 'billing_state', 'billing_zip', 'billing_country', 'website_url', 'description']
      };

      let successCount = 0;
      let errorCount = 0;

      for (const record of records) {
        try {
          const recordData = field.module === 'leads' 
            ? await this.getLeadData(db, record.id)
            : await this.getAccountData(db, record.id);
            
          const calculatedValue = this.formulaEvaluator.evaluate(field.formula_expression, recordData);

          if (field.target_field_name) {
            const isStandardField = allowedStandardFields[field.module]?.includes(field.target_field_name);
            
            if (isStandardField) {
              await this.updateStandardFieldValue(db, field.module, record.id, field.target_field_name, calculatedValue);
            } else {
              await this.updateCustomFieldValue(db, field.module, record.id, field.target_field_name, calculatedValue);
            }
          } else {
            await this.storeFormulaValue(db, field.module, record.id, field.id, calculatedValue);
          }
          successCount++;
        } catch (error) {
          errorCount++;
          console.error(`   ❌ Error for ${field.module} ${record.id}:`, error.message);
        }
      }

      await db.execute(
        `UPDATE formula_field_definitions SET last_updated = CURRENT_TIMESTAMP WHERE id = ?`, 
        [field.id]
      );

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Completed "${field.field_name}" in ${duration}s - Success: ${successCount}, Errors: ${errorCount}\n`);
    } catch (error) {
      console.error(`❌ Fatal error updating formula field "${field.field_name}":`, error);
    }
  }

  async getLeadData(db, leadId) {
    const [leadData] = await db.execute(`
      SELECT l.*, cfv.field_name, cfv.value as field_value
      FROM leads l
      LEFT JOIN (
        SELECT cv.*, cd.field_name
        FROM custom_field_values cv
        JOIN custom_field_definitions cd ON cv.definition_id = cd.id
        WHERE cv.module = 'leads'
      ) cfv ON cfv.record_id = l.id
      WHERE l.id = ?
    `, [leadId]);

    if (leadData.length === 0) return {};

    const recordData = leadData[0];
    
    leadData.forEach(row => {
      if (row.field_name && row.field_value !== null) {
        recordData[row.field_name] = row.field_value;
      }
    });

    const [taskData] = await db.execute(`
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN task_status = 'pending' THEN 1 END) as pending_tasks,
        COUNT(CASE WHEN task_status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN task_status != 'completed' AND task_status != 'cancelled' AND deadline_date < NOW() THEN 1 END) as overdue_tasks
      FROM tasks WHERE lead_id = ?
    `, [leadId]);

    const [callData] = await db.execute(`
      SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN call_date >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as recent_calls,
        COUNT(CASE WHEN category = 'Sale' THEN 1 END) as sales_calls,
        MAX(call_date) as last_call_date
      FROM call_logs WHERE lead_id = ?
    `, [leadId]);

    if (taskData.length > 0) {
      Object.assign(recordData, {
        task_count_total: taskData[0].total_tasks,
        task_count_pending: taskData[0].pending_tasks,
        task_count_completed: taskData[0].completed_tasks,
        task_count_overdue: taskData[0].overdue_tasks
      });
    }

    if (callData.length > 0) {
      Object.assign(recordData, {
        call_count_total: callData[0].total_calls,
        call_count_recent: callData[0].recent_calls,
        call_count_sales: callData[0].sales_calls,
        last_call_date: callData[0].last_call_date
      });
    }

    return recordData;
  }

  async getAccountData(db, accountId) {
    const [accountData] = await db.execute(`
      SELECT a.*, cfv.field_name, cfv.value as field_value
      FROM accounts a
      LEFT JOIN (
        SELECT cv.*, cd.field_name
        FROM custom_field_values cv
        JOIN custom_field_definitions cd ON cv.definition_id = cd.id
        WHERE cv.module = 'accounts'
      ) cfv ON cfv.record_id = a.id
      WHERE a.id = ?
    `, [accountId]);

    if (accountData.length === 0) return {};

    const recordData = accountData[0];
    
    accountData.forEach(row => {
      if (row.field_name && row.field_value !== null) {
        recordData[row.field_name] = row.field_value;
      }
    });

    const [productData] = await db.execute(`
      SELECT 
        COUNT(*) as product_count,
        COALESCE(SUM(quantity * unit_price), 0) as total_products_value,
        CASE WHEN COUNT(*) > 0 THEN 'yes' ELSE 'no' END as has_products
      FROM account_products WHERE account_id = ?
    `, [accountId]);

    const [taskData] = await db.execute(`
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN task_status = 'pending' THEN 1 END) as pending_tasks,
        COUNT(CASE WHEN task_status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN task_status != 'completed' AND task_status != 'cancelled' AND deadline_date < NOW() THEN 1 END) as overdue_tasks
      FROM tasks WHERE account_id = ?
    `, [accountId]);

    const [callData] = await db.execute(`
      SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as recent_calls
      FROM account_calls WHERE account_id = ?
    `, [accountId]);

    if (productData.length > 0) {
      Object.assign(recordData, {
        product_count: productData[0].product_count,
        total_products_value: productData[0].total_products_value,
        has_products: productData[0].has_products === 'yes'
      });
    }

    if (taskData.length > 0) {
      Object.assign(recordData, {
        task_count_total: taskData[0].total_tasks,
        task_count_pending: taskData[0].pending_tasks,
        task_count_completed: taskData[0].completed_tasks,
        task_count_overdue: taskData[0].overdue_tasks
      });
    }

    if (callData.length > 0) {
      Object.assign(recordData, {
        call_count_total: callData[0].total_calls,
        call_count_recent: callData[0].recent_calls
      });
    }

    return recordData;
  }

  async updateCustomFieldValue(db, module, recordId, targetFieldName, value) {
    const definitionId = this.customFieldDefMap.get(`${module}:${targetFieldName}`);
    if (!definitionId) {
      console.warn(`⚠️  Custom field definition not found: ${module}:${targetFieldName}`);
      return;
    }

    const storedValue = typeof value === 'boolean' ? (value ? '1' : '0') : value;
    
    await db.execute(`
      INSERT INTO custom_field_values (definition_id, record_id, module, value)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE value = VALUES(value)
    `, [definitionId, recordId, module, storedValue]);
  }

  async updateStandardFieldValue(db, module, recordId, targetFieldName, value) {
    const allowedStandardFields = {
      leads: ['fname', 'lname', 'email_address', 'phone_number', 'company_name', 'address', 'city', 'state', 'zip_code', 'country', 'website_url', 'source', 'comments', 'lead_status', 'lead_score'],
      accounts: ['name', 'type', 'industry', 'revenue', 'employees', 'contact_fname', 'contact_lname', 'contact_email', 'contact_phone', 'billing_address', 'billing_city', 'billing_state', 'billing_zip', 'billing_country', 'website_url', 'description']
    };

    if (!allowedStandardFields[module]?.includes(targetFieldName)) {
      console.warn(`⚠️  Standard field not allowed: ${module}.${targetFieldName}`);
      return;
    }

    const table = module === 'leads' ? 'leads' : 'accounts';
    await db.execute(`
      UPDATE ${table}
      SET ${targetFieldName} = ?
      WHERE id = ?
    `, [value, recordId]);
  }

  async storeFormulaValue(db, module, recordId, formulaFieldId, value) {
    await db.execute(`
      INSERT INTO formula_field_values (formula_field_id, module, record_id, calculated_value, calculated_at)
      VALUES (?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE 
        calculated_value = VALUES(calculated_value),
        calculated_at = NOW()
    `, [formulaFieldId, module, recordId, JSON.stringify(value)]);
  }

  removeScheduledUpdate(fieldId) {
    if (this.scheduledJobs.has(fieldId)) {
      this.scheduledJobs.get(fieldId).stop();
      this.scheduledJobs.delete(fieldId);
      console.log(`🗑️  Removed scheduled update for formula field ID: ${fieldId}`);
      return true;
    }
    return false;
  }

  getScheduleStatus() {
    return Array.from(this.scheduledJobs.entries()).map(([fieldId, job]) => ({
      fieldId,
      isRunning: job ? true : false
    }));
  }

  async triggerManualUpdate(fieldId) {
    try {
      const db = await this.getDb();
      const [fields] = await db.execute(`
        SELECT id, module, field_name, formula_expression, target_field_name
        FROM formula_field_definitions 
        WHERE id = ? AND is_active = true
      `, [fieldId]);

      if (fields.length === 0) {
        return { success: false, error: 'Formula field not found or inactive' };
      }

      await this.updateFormulaFieldValues(fields[0]);
      return { success: true, message: 'Manual update completed successfully' };
    } catch (error) {
      console.error('❌ Manual update failed:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = {
  FormulaFieldScheduler
};