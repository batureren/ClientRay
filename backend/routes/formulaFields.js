// routes/formulaFields.js
const express = require('express');

module.exports = (dependencies) => {
  const { getDb, authenticateToken, requireRole, formulaScheduler } = dependencies;
  const router = express.Router();

  // 1. DEFINE THE EVALUATOR CLASS INTERNALLY
  class FormulaEvaluator {
    constructor() {
      this.functions = {
        IF: (condition, trueValue, falseValue) => condition ? trueValue : falseValue,
        AND: (...conditions) => conditions.every(c => c),
        OR: (...conditions) => conditions.some(c => c),
        NOT: (condition) => !condition,
        CONCATENATE: (...values) => values.join(''),
        UPPER: (text) => text?.toString().toUpperCase() || '',
        LOWER: (text) => text?.toString().toLowerCase() || '',
        LEN: (text) => text?.toString().length || 0,
        ROUND: (number, decimals = 0) => Math.round(number * Math.pow(10, decimals)) / Math.pow(10, decimals),
        ABS: (number) => Math.abs(number),
        MAX: (...numbers) => Math.max(...numbers),
        MIN: (...numbers) => Math.min(...numbers),
        TODAY: () => new Date().toISOString().split('T')[0],
        DATEDIFF: (date1, date2) => {
          const d1 = new Date(date1);
          const d2 = new Date(date2);
          return Math.floor((d1 - d2) / (1000 * 60 * 60 * 24));
        },
        ISNULL: (value) => value == null || value === '',
        ISBLANK: (value) => value == null || value === '' || (typeof value === 'string' && value.trim() === ''),
      };
    }

    evaluate(formula, fieldData) {
      try {
        let processedFormula = this.replaceFieldReferences(formula, fieldData);
        processedFormula = this.replaceFunctionCalls(processedFormula);
        return this.safeEvaluate(processedFormula);
      } catch (error) {
        throw new Error(`Formula evaluation failed: ${error.message}`);
      }
    }

    replaceFieldReferences(formula, fieldData) {
      return formula.replace(/\{([^}]+)\}/g, (match, fieldName) => {
        const value = fieldData[fieldName];
        if (typeof value === 'string') {
          return `"${value.replace(/"/g, '\\"')}"`;
        }
        return value != null ? value : 'null';
      });
    }

    replaceFunctionCalls(formula) {
      let result = formula;
      Object.keys(this.functions).forEach(funcName => {
        const regex = new RegExp(`${funcName}\\(([^)]*)\\)`, 'gi');
        result = result.replace(regex, (match, args) => {
          try {
            const argValues = this.parseArguments(args);
            const funcResult = this.functions[funcName](...argValues);
            return typeof funcResult === 'string' ? `"${funcResult}"` : funcResult;
          } catch (e) {
            throw new Error(`Error in function ${funcName}: ${e.message}`);
          }
        });
      });
      return result;
    }

    parseArguments(argsString) {
      if (!argsString.trim()) return [];
      const args = [];
      let current = '';
      let inQuotes = false;
      let parenCount = 0;
      for (let i = 0; i < argsString.length; i++) {
        const char = argsString[i];
        if (char === '"' && (i === 0 || argsString[i-1] !== '\\')) {
          inQuotes = !inQuotes;
        } else if (char === '(' && !inQuotes) {
          parenCount++;
        } else if (char === ')' && !inQuotes) {
          parenCount--;
        } else if (char === ',' && !inQuotes && parenCount === 0) {
          args.push(this.parseValue(current.trim()));
          current = '';
          continue;
        }
        current += char;
      }
      if (current.trim()) {
        args.push(this.parseValue(current.trim()));
      }
      return args;
    }

    parseValue(value) {
      if (value === 'null') return null;
      if (value === 'true') return true;
      if (value === 'false') return false;
      if (value.startsWith('"') && value.endsWith('"')) {
        return value.slice(1, -1).replace(/\\"/g, '"');
      }
      if (!isNaN(value) && !isNaN(parseFloat(value))) {
        return parseFloat(value);
      }
      return value;
    }

    safeEvaluate(expression) {
      try {
        const sanitized = expression.replace(/[^a-zA-Z0-9\s+\-*/%().,'"<>=!&|]/g, '');
        return new Function(`return ${sanitized}`)();
      } catch (error) {
        throw new Error(`Invalid expression: ${error.message}`);
      }
    }

    validateFormula(formula, availableFields) {
      try {
        const fieldReferences = formula.match(/\{([^}]+)\}/g) || [];
        const referencedFields = fieldReferences.map(ref => ref.slice(1, -1));
        const invalidFields = referencedFields.filter(field => !availableFields.some(f => f.field_name === field));
        if (invalidFields.length > 0) {
          throw new Error(`Referenced fields not found: ${invalidFields.join(', ')}`);
        }
        const testData = {};
        availableFields.forEach(field => {
          switch (field.field_type) {
            case 'TEXT':
            case 'TEXTAREA': testData[field.field_name] = 'test'; break;
            case 'NUMBER': testData[field.field_name] = 100; break;
            case 'DATE': testData[field.field_name] = '2024-01-01'; break;
            case 'BOOLEAN': testData[field.field_name] = true; break;
          }
        });
        this.evaluate(formula, testData);
        return { valid: true };
      } catch (error) {
        return { valid: false, error: error.message };
      }
    }
  }

  // 2. CONNECT EVALUATOR TO SCHEDULER
  // Use a safety check so it doesn't crash if scheduler is missing
  const localEvaluator = new FormulaEvaluator();
  
  if (formulaScheduler && typeof formulaScheduler.setFormulaEvaluator === 'function') {
    formulaScheduler.setFormulaEvaluator(localEvaluator);
  } else {
    console.warn('⚠️ FormulaScheduler not available in routes. Scheduled updates will not calculate.');
  }

  // 3. DEFINE HELPERS
  const setCustomFieldReadOnly = async (fieldName, module, is_read_only = true) => {
    try {
      const db = await getDb();
      await db.execute(`
        UPDATE custom_field_definitions 
        SET is_read_only = ? 
        WHERE field_name = ? AND module = ?
      `, [is_read_only ? 1 : 0, fieldName, module]);
      console.log(`Set ${fieldName} in ${module} as ${is_read_only ? 'readonly' : 'editable'}`);
    } catch (error) {
      console.error('Error updating custom field readonly status:', error);
    }
  };

  // 4. DEFINE ROUTES
  router.get('/', authenticateToken, async (req, res) => {
    try {
      const db = await getDb();
      const [rows] = await db.execute(`
        SELECT * FROM formula_field_definitions 
        ORDER BY module, field_label
      `);
      res.json(rows);
    } catch (error) {
      console.error('Error fetching formula fields:', error);
      res.status(500).json({ error: 'Failed to retrieve formula fields.' });
    }
  });

  router.get('/available-fields/:module', authenticateToken, async (req, res) => {
    try {
        const { module } = req.params;
        const db = await getDb();
        
        const [customFields] = await db.execute(`
          SELECT field_name, field_label, field_type
          FROM custom_field_definitions 
          WHERE module = ?
          ORDER BY field_label
        `, [module]);
        
        const [formulaFields] = await db.execute(`
          SELECT field_name, field_label, return_type as field_type
          FROM formula_field_definitions 
          WHERE module = ? AND is_active = true
          ORDER BY field_label
        `, [module]);
        
        const standardFields = module === 'leads' ? [
          { field_name: 'fname', field_label: 'First Name', field_type: 'TEXT' },
          { field_name: 'lname', field_label: 'Last Name', field_type: 'TEXT' },
          { field_name: 'email_address', field_label: 'Email', field_type: 'TEXT' },
          { field_name: 'phone_number', field_label: 'Phone Number', field_type: 'TEXT' },
          { field_name: 'company_name', field_label: 'Company Name', field_type: 'TEXT' },
          { field_name: 'address', field_label: 'Address', field_type: 'TEXT' },
          { field_name: 'city', field_label: 'City', field_type: 'TEXT' },
          { field_name: 'state', field_label: 'State', field_type: 'TEXT' },
          { field_name: 'zip_code', field_label: 'Zip Code', field_type: 'TEXT' },
          { field_name: 'country', field_label: 'Country', field_type: 'TEXT' },
          { field_name: 'website_url', field_label: 'Website', field_type: 'TEXT' },
          { field_name: 'source', field_label: 'Lead Source', field_type: 'TEXT' },
          { field_name: 'lead_status', field_label: 'Lead Status', field_type: 'TEXT' },
          { field_name: 'lead_score', field_label: 'Lead Score', field_type: 'NUMBER' },
          { field_name: 'comments', field_label: 'Comments/Notes', field_type: 'TEXTAREA' },
          { field_name: 'created_at', field_label: 'Created Date', field_type: 'DATE' },
          { field_name: 'updated_at', field_label: 'Updated Date', field_type: 'DATE' },
          { field_name: 'task_count_total', field_label: 'Total Tasks', field_type: 'NUMBER' },
          { field_name: 'task_count_pending', field_label: 'Pending Tasks', field_type: 'NUMBER' },
          { field_name: 'task_count_completed', field_label: 'Completed Tasks', field_type: 'NUMBER' },
          { field_name: 'task_count_overdue', field_label: 'Overdue Tasks', field_type: 'NUMBER' },
          { field_name: 'call_count_total', field_label: 'Total Calls', field_type: 'NUMBER' },
          { field_name: 'call_count_recent', field_label: 'Recent Calls (30 days)', field_type: 'NUMBER' },
          { field_name: 'call_count_sales', field_label: 'Sales Calls', field_type: 'NUMBER' },
          { field_name: 'last_call_date', field_label: 'Last Call Date', field_type: 'DATE' },
        ] : [
          { field_name: 'name', field_label: 'Account Name', field_type: 'TEXT' },
          { field_name: 'type', field_label: 'Account Type', field_type: 'TEXT' },
          { field_name: 'industry', field_label: 'Industry', field_type: 'TEXT' },
          { field_name: 'revenue', field_label: 'Annual Revenue', field_type: 'NUMBER' },
          { field_name: 'employees', field_label: 'Employee Count', field_type: 'NUMBER' },
          { field_name: 'contact_fname', field_label: 'Contact First Name', field_type: 'TEXT' },
          { field_name: 'contact_lname', field_label: 'Contact Last Name', field_type: 'TEXT' },
          { field_name: 'contact_email', field_label: 'Contact Email', field_type: 'TEXT' },
          { field_name: 'contact_phone', field_label: 'Contact Phone', field_type: 'TEXT' },
          { field_name: 'billing_address', field_label: 'Billing Address', field_type: 'TEXT' },
          { field_name: 'billing_city', field_label: 'Billing City', field_type: 'TEXT' },
          { field_name: 'billing_state', field_label: 'Billing State', field_type: 'TEXT' },
          { field_name: 'billing_zip', field_label: 'Billing Postal Code', field_type: 'TEXT' },
          { field_name: 'billing_country', field_label: 'Billing Country', field_type: 'TEXT' },
          { field_name: 'website_url', field_label: 'Website', field_type: 'TEXT' },
          { field_name: 'description', field_label: 'Description', field_type: 'TEXTAREA' },
          { field_name: 'created_at', field_label: 'Created Date', field_type: 'DATE' },
          { field_name: 'updated_at', field_label: 'Updated Date', field_type: 'DATE' },
          { field_name: 'has_products', field_label: 'Has Products', field_type: 'BOOLEAN' },
          { field_name: 'product_count', field_label: 'Product Count', field_type: 'NUMBER' },
          { field_name: 'total_products_value', field_label: 'Total Products Value', field_type: 'NUMBER' },
          { field_name: 'task_count_total', field_label: 'Total Tasks', field_type: 'NUMBER' },
          { field_name: 'task_count_pending', field_label: 'Pending Tasks', field_type: 'NUMBER' },
          { field_name: 'task_count_completed', field_label: 'Completed Tasks', field_type: 'NUMBER' },
          { field_name: 'task_count_overdue', field_label: 'Overdue Tasks', field_type: 'NUMBER' },
          { field_name: 'call_count_total', field_label: 'Total Calls', field_type: 'NUMBER' },
          { field_name: 'call_count_recent', field_label: 'Recent Calls (30 days)', field_type: 'NUMBER' },
        ];
        
        const allFields = [...standardFields, ...customFields, ...formulaFields];
        
        res.json({
          fields: allFields,
          functions: Object.keys(localEvaluator.functions)
        });
    } catch (error) {
      console.error('Error fetching available fields:', error);
      res.status(500).json({ error: 'Failed to retrieve available fields.' });
    }
  });

  router.post('/validate', authenticateToken, async (req, res) => {
    try {
      const { formula, module } = req.body;
      if (!formula || !module) {
        return res.status(400).json({ error: 'Formula and module are required.' });
      }
      const db = await getDb();
      const [customFields] = await db.execute(`
        SELECT field_name, field_label, field_type
        FROM custom_field_definitions 
        WHERE module = ?
      `, [module]);
      const [formulaFields] = await db.execute(`
        SELECT field_name, field_label, return_type as field_type
        FROM formula_field_definitions 
        WHERE module = ? AND is_active = true
      `, [module]);
      const standardFields = module === 'leads' ? [
        { field_name: 'fname', field_type: 'TEXT' }, { field_name: 'lname', field_type: 'TEXT' },
        { field_name: 'email_address', field_type: 'TEXT' }, { field_name: 'phone_number', field_type: 'TEXT' },
        { field_name: 'company_name', field_type: 'TEXT' }, { field_name: 'lead_score', field_type: 'NUMBER' },
        { field_name: 'lead_status', field_type: 'TEXT' }, { field_name: 'source', field_type: 'TEXT' },
        { field_name: 'created_at', field_type: 'DATE' }, { field_name: 'updated_at', field_type: 'DATE' },
      ] : [
        { field_name: 'name', field_type: 'TEXT' }, { field_name: 'type', field_type: 'TEXT' },
        { field_name: 'industry', field_type: 'TEXT' }, { field_name: 'revenue', field_type: 'NUMBER' },
        { field_name: 'employees', field_type: 'NUMBER' }, { field_name: 'contact_email', field_type: 'TEXT' },
        { field_name: 'created_at', field_type: 'DATE' }, { field_name: 'updated_at', field_type: 'DATE' },
      ];
      const availableFields = [...standardFields, ...customFields, ...formulaFields];
      const validation = localEvaluator.validateFormula(formula, availableFields);
      res.json(validation);
    } catch (error) {
      console.error('Error validating formula:', error);
      res.status(500).json({ error: 'Failed to validate formula.' });
    }
  });

  router.post('/', authenticateToken, requireRole('manager'), async (req, res) => {
    try {
      const { module, field_label, return_type, formula_expression, description, update_schedule, target_field_name } = req.body;
      if (!module || !field_label || !return_type || !formula_expression) {
        return res.status(400).json({ error: 'Module, field label, return type, and formula expression are required.' });
      }
      const field_name = `formula_${field_label.toLowerCase().replace(/\s+/g, '_').replace(/[^\w-]+/g, '').replace(/--+/g, '_')}`;
      const db = await getDb();
      const [customFields] = await db.execute(`
        SELECT field_name, field_label, field_type, is_read_only
        FROM custom_field_definitions 
        WHERE module = ?
      `, [module]);
      const targetField = customFields.find(f => f.field_name === target_field_name);
      if (!targetField) {
        return res.status(400).json({ error: 'Target field not found.' });
      }
      if (targetField.is_read_only) {
        return res.status(400).json({ error: 'Target field is already in use by another formula or system process.' });
      }
      const standardFields = module === 'leads' ? [
        { field_name: 'fname', field_type: 'TEXT' }, { field_name: 'lname', field_type: 'TEXT' },
        { field_name: 'email_address', field_type: 'TEXT' }, { field_name: 'phone_number', field_type: 'TEXT' },
        { field_name: 'company_name', field_type: 'TEXT' }, { field_name: 'lead_score', field_type: 'NUMBER' },
        { field_name: 'lead_status', field_type: 'TEXT' }, { field_name: 'source', field_type: 'TEXT' },
        { field_name: 'created_at', field_type: 'DATE' }, { field_name: 'updated_at', field_type: 'DATE' },
      ] : [
        { field_name: 'name', field_type: 'TEXT' }, { field_name: 'type', field_type: 'TEXT' },
        { field_name: 'industry', field_type: 'TEXT' }, { field_name: 'revenue', field_type: 'NUMBER' },
        { field_name: 'employees', field_type: 'NUMBER' }, { field_name: 'contact_email', field_type: 'TEXT' },
        { field_name: 'created_at', field_type: 'DATE' }, { field_name: 'updated_at', field_type: 'DATE' },
      ];
      const availableFields = [...standardFields, ...customFields];
      const validation = localEvaluator.validateFormula(formula_expression, availableFields);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
      await db.execute('START TRANSACTION');
      const [result] = await db.execute(`
        INSERT INTO formula_field_definitions (module, field_name, field_label, return_type, formula_expression, description, update_schedule, target_field_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [module, field_name, field_label, return_type, formula_expression, description, update_schedule, target_field_name || null]);
      await setCustomFieldReadOnly(target_field_name, module, true);
      await db.execute('COMMIT');
      if (update_schedule && update_schedule !== 'manual') {
        const newField = { id: result.insertId, module, field_name, formula_expression, update_schedule, target_field_name };
        formulaScheduler.scheduleFormulaUpdate(newField);
      }
      res.status(201).json({ id: result.insertId, message: 'Formula field created successfully.' });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'A formula field with this name already exists.' });
      }
      console.error('Error creating formula field:', error);
      res.status(500).json({ error: 'Failed to create formula field.' });
    }
  });

  router.put('/:id', authenticateToken, requireRole('manager'), async (req, res) => {
    try {
      const { id } = req.params;
      const { field_label, formula_expression, description, is_active } = req.body;
      if (!field_label || !formula_expression) {
        return res.status(400).json({ error: 'Field label and formula expression are required.' });
      }
      const db = await getDb();
      const [current] = await db.execute(`SELECT module FROM formula_field_definitions WHERE id = ?`, [id]);
      if (current.length === 0) {
        return res.status(404).json({ error: 'Formula field not found.' });
      }
      const [customFields] = await db.execute(`
        SELECT field_name, field_label, field_type FROM custom_field_definitions WHERE module = ?
      `, [current[0].module]);
      const validation = localEvaluator.validateFormula(formula_expression, customFields);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
      const [result] = await db.execute(`
        UPDATE formula_field_definitions
        SET field_label = ?, formula_expression = ?, description = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [field_label, formula_expression, description, is_active ?? true, id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Formula field not found.' });
      }
      res.json({ message: 'Formula field updated successfully.' });
    } catch (error) {
      console.error('Error updating formula field:', error);
      res.status(500).json({ error: 'Failed to update formula field.' });
    }
  });

  router.delete('/:id', authenticateToken, requireRole('manager'), async (req, res) => {
    try {
      const { id } = req.params;
      const db = await getDb();
      const [formulaField] = await db.execute(`SELECT module, target_field_name FROM formula_field_definitions WHERE id = ?`, [id]);
      if (formulaField.length === 0) {
        return res.status(404).json({ error: 'Formula field not found.' });
      }
      const { module, target_field_name } = formulaField[0];
      await db.execute('START TRANSACTION');
      try {
        const [result] = await db.execute(`DELETE FROM formula_field_definitions WHERE id = ?`, [id]);
        if (result.affectedRows === 0) {
          await db.execute('ROLLBACK');
          return res.status(404).json({ error: 'Formula field not found.' });
        }
        const [otherFormulas] = await db.execute(`
          SELECT id FROM formula_field_definitions WHERE target_field_name = ? AND module = ? AND id != ?
        `, [target_field_name, module, id]);
        if (otherFormulas.length === 0) {
          await setCustomFieldReadOnly(target_field_name, module, false);
        }
        formulaScheduler.removeScheduledUpdate(parseInt(id));
        await db.execute('COMMIT');
        res.json({ message: 'Formula field deleted successfully.' });
      } catch (error) {
        await db.execute('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error deleting formula field:', error);
      res.status(500).json({ error: 'Failed to delete formula field.' });
    }
  });

  router.post('/calculate/:module/:recordId', authenticateToken, async (req, res) => {
    try {
      const { module, recordId } = req.params;
      const db = await getDb();
      const [formulaFields] = await db.execute(`
        SELECT id, field_name, field_label, formula_expression, return_type
        FROM formula_field_definitions WHERE module = ? AND is_active = true
      `, [module]);
      if (formulaFields.length === 0) {
        return res.json({});
      }
      let recordData = {};
      if (module === 'leads') {
        const [leadData] = await db.execute(`
          SELECT l.*, cfv.field_name, cfv.value as field_value
          FROM leads l
          LEFT JOIN (
            SELECT cv.*, cd.field_name
            FROM custom_field_values cv JOIN custom_field_definitions cd ON cv.definition_id = cd.id
            WHERE cv.module = 'leads'
          ) cfv ON cfv.record_id = l.id
          WHERE l.id = ?
        `, [recordId]);
        if (leadData.length === 0) return res.status(404).json({ error: 'Lead not found' });
        recordData = leadData[0];
        leadData.forEach(row => {
          if (row.field_name && row.field_value !== null) recordData[row.field_name] = row.field_value;
        });
        const [taskData] = await db.execute(`
          SELECT COUNT(*) as total_tasks,
                 COUNT(CASE WHEN task_status = 'pending' THEN 1 END) as pending_tasks,
                 COUNT(CASE WHEN task_status = 'completed' THEN 1 END) as completed_tasks,
                 COUNT(CASE WHEN task_status != 'completed' AND task_status != 'cancelled' AND deadline_date < NOW() THEN 1 END) as overdue_tasks
          FROM tasks WHERE lead_id = ?
        `, [recordId]);
        const [callData] = await db.execute(`
          SELECT COUNT(*) as total_calls,
                 COUNT(CASE WHEN call_date >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as recent_calls,
                 COUNT(CASE WHEN category = 'Sale' THEN 1 END) as sales_calls,
                 MAX(call_date) as last_call_date
          FROM call_logs WHERE lead_id = ?
        `, [recordId]);
        if (taskData.length > 0) Object.assign(recordData, { task_count_total: taskData[0].total_tasks, task_count_pending: taskData[0].pending_tasks, task_count_completed: taskData[0].completed_tasks, task_count_overdue: taskData[0].overdue_tasks });
        if (callData.length > 0) Object.assign(recordData, { call_count_total: callData[0].total_calls, call_count_recent: callData[0].recent_calls, call_count_sales: callData[0].sales_calls, last_call_date: callData[0].last_call_date });
      } else if (module === 'accounts') {
        const [accountData] = await db.execute(`
          SELECT a.*, cfv.field_name, cfv.value as field_value
          FROM accounts a
          LEFT JOIN (
            SELECT cv.*, cd.field_name
            FROM custom_field_values cv JOIN custom_field_definitions cd ON cv.definition_id = cd.id
            WHERE cv.module = 'accounts'
          ) cfv ON cfv.record_id = a.id
          WHERE a.id = ?
        `, [recordId]);
        if (accountData.length === 0) return res.status(404).json({ error: 'Account not found' });
        recordData = accountData[0];
        accountData.forEach(row => {
          if (row.field_name && row.field_value !== null) recordData[row.field_name] = row.field_value;
        });
        const [productData] = await db.execute(`
          SELECT COUNT(*) as product_count, COALESCE(SUM(quantity * unit_price), 0) as total_products_value,
                 CASE WHEN COUNT(*) > 0 THEN 'yes' ELSE 'no' END as has_products
          FROM account_products WHERE account_id = ?
        `, [recordId]);
        const [taskData] = await db.execute(`
          SELECT COUNT(*) as total_tasks, COUNT(CASE WHEN task_status = 'pending' THEN 1 END) as pending_tasks,
                 COUNT(CASE WHEN task_status = 'completed' THEN 1 END) as completed_tasks,
                 COUNT(CASE WHEN task_status != 'completed' AND task_status != 'cancelled' AND deadline_date < NOW() THEN 1 END) as overdue_tasks
          FROM tasks WHERE account_id = ?
        `, [recordId]);
        const [callData] = await db.execute(`
          SELECT COUNT(*) as total_calls, COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as recent_calls
          FROM account_calls WHERE account_id = ?
        `, [recordId]);
        if (productData.length > 0) Object.assign(recordData, { product_count: productData[0].product_count, total_products_value: productData[0].total_products_value, has_products: productData[0].has_products === 'yes' });
        if (taskData.length > 0) Object.assign(recordData, { task_count_total: taskData[0].total_tasks, task_count_pending: taskData[0].pending_tasks, task_count_completed: taskData[0].completed_tasks, task_count_overdue: taskData[0].overdue_tasks });
        if (callData.length > 0) Object.assign(recordData, { call_count_total: callData[0].total_calls, call_count_recent: callData[0].recent_calls });
      }
      const calculatedValues = {};
      for (const formula of formulaFields) {
        try {
          const value = localEvaluator.evaluate(formula.formula_expression, recordData);
          calculatedValues[formula.field_name] = { id: formula.id, label: formula.field_label, value: value, type: formula.return_type };
        } catch (error) {
          console.error(`Error calculating formula ${formula.field_name}:`, error);
          calculatedValues[formula.field_name] = { id: formula.id, label: formula.field_label, value: null, error: error.message, type: formula.return_type };
        }
      }
      res.json(calculatedValues);
    } catch (error) {
      console.error('Error calculating formula values:', error);
      res.status(500).json({ error: 'Failed to calculate formula values.' });
    }
  });

  router.post('/trigger/:id', authenticateToken, requireRole('manager'), async (req, res) => {
    try {
      const { id } = req.params;
      const result = await formulaScheduler.triggerManualUpdate(parseInt(id));
      if (result.success) {
        res.json({ message: result.message });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      console.error('Error triggering manual update:', error);
      res.status(500).json({ error: 'Failed to trigger manual update.' });
    }
  });

  router.get('/schedule-status', authenticateToken, async (req, res) => {
    try {
      const status = formulaScheduler.getScheduleStatus();
      res.json(status);
    } catch (error) {
      console.error('Error getting schedule status:', error);
      res.status(500).json({ error: 'Failed to get schedule status.' });
    }
  });

  router.put('/:id/schedule', authenticateToken, requireRole('manager'), async (req, res) => {
    try {
      const { id } = req.params;
      const { update_schedule } = req.body;
      const db = await getDb();
      const [result] = await db.execute(`
        UPDATE formula_field_definitions
        SET update_schedule = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [update_schedule, id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Formula field not found.' });
      }
      formulaScheduler.removeScheduledUpdate(parseInt(id));
      if (update_schedule && update_schedule !== 'manual') {
        const [fields] = await db.execute(`
          SELECT id, module, field_name, formula_expression, update_schedule, target_field_name
          FROM formula_field_definitions 
          WHERE id = ?
        `, [id]);
        if (fields.length > 0) {
          formulaScheduler.scheduleFormulaUpdate(fields[0]);
        }
      }
      res.json({ message: 'Formula field schedule updated successfully.' });
    } catch (error) {
      console.error('Error updating formula field schedule:', error);
      res.status(500).json({ error: 'Failed to update formula field schedule.' });
    }
  });

  return router;
};