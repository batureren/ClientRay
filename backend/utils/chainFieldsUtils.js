// chainFieldsUtils.js

const { getDb } = require('../server');

/**
 * Evaluate a condition based on operator and values
 */
const evaluateCondition = (fieldValue, operator, triggerValue) => {
  const isEmpty = fieldValue === null || fieldValue === undefined || fieldValue === '';
  
  switch (operator) {
    case 'equals':
      return fieldValue === triggerValue;
    case 'not_equals':
      return fieldValue !== triggerValue;
    case 'contains':
      return fieldValue && fieldValue.toString().toLowerCase().includes(triggerValue.toLowerCase());
    case 'greater_than':
      return parseFloat(fieldValue) > parseFloat(triggerValue);
    case 'less_than':
      return parseFloat(fieldValue) < parseFloat(triggerValue);
    case 'is_empty':
      return isEmpty;
    case 'is_not_empty':
      return !isEmpty;
    default:
      return false;
  }
};

/**
 * Evaluate bulk mapping conditions
 */
const evaluateBulkMapping = (fieldValue, mappings) => {
  if (!mappings || !Array.isArray(mappings)) return null;
  
  
  // Find exact match first
  const exactMatch = mappings.find(mapping => {
    const match = mapping.trigger_value === fieldValue;
    return match;
  });
  
  if (exactMatch) {
    return exactMatch.target_value;
  }
  
  // For contains operations, check if any trigger value is contained in field value
  const containsMatch = mappings.find(mapping => {
    if (mapping.comparison_operator === 'contains') {
      const match = fieldValue && fieldValue.toString().toLowerCase().includes(mapping.trigger_value.toLowerCase());
      return match;
    }
    return false;
  });
  
  if (containsMatch) {
    return containsMatch.target_value;
  }
  
  return null;
};

/**
 * Apply chain rules to a record and return the updates
 */
const applyChainRules = async (module, recordData, recordId = null) => {
  try {
    const db = await getDb();
    
    // Get all active chain rules for this module with bulk mappings
    const [chainRules] = await db.execute(`
      SELECT 
        cr.*, 
        sf.field_name as source_field_name,
        tf.field_name as target_field_name,
        (SELECT JSON_ARRAYAGG(
          JSON_OBJECT('trigger_value', crm.trigger_value, 'target_value', crm.target_value)
        ) 
        FROM chain_rule_value_maps crm WHERE crm.rule_id = cr.id) as mappings
      FROM chain_rules cr
      JOIN custom_field_definitions sf ON cr.source_field_id = sf.id
      JOIN custom_field_definitions tf ON cr.target_field_id = tf.id
      WHERE cr.module = ? AND cr.is_active = 1
    `, [module]);

    const updates = {};
    const appliedRules = [];

    let currentCustomFields = {};
    if (recordId) {
      const [customFieldValues] = await db.execute(`
        SELECT cd.field_name, cfv.value
        FROM custom_field_values cfv
        JOIN custom_field_definitions cd ON cfv.definition_id = cd.id
        WHERE cfv.record_id = ? AND cfv.module = ?
      `, [recordId, module]);
      
      currentCustomFields = Object.fromEntries(
        customFieldValues.map(cf => [cf.field_name, cf.value])
      );
    }

    // Merge current custom fields with incoming data
    const allFieldData = { ...currentCustomFields, ...recordData };

    for (const rule of chainRules) {
      const sourceFieldValue = allFieldData[rule.source_field_name];
      let targetValue = null;
      let ruleApplied = false;
      
      
      // Better condition checking for bulk mapping
      if (rule.rule_type === 'bulk_mapping') {
        
        let mappings = [];
        if (rule.mappings) {
          try {
            // Handle both JSON string and already parsed array
            if (typeof rule.mappings === 'string') {
              mappings = JSON.parse(rule.mappings);
            } else if (Array.isArray(rule.mappings)) {
              mappings = rule.mappings;
            }
          } catch (parseError) {
            mappings = [];
          }
        }
        
        if (mappings.length > 0) {
          targetValue = evaluateBulkMapping(sourceFieldValue, mappings);
          
          if (targetValue !== null) {
            ruleApplied = true;
            updates[rule.target_field_name] = targetValue;
            appliedRules.push({
              rule_id: rule.id,
              rule_name: rule.rule_name,
              rule_type: rule.rule_type,
              source_field: rule.source_field_name,
              target_field: rule.target_field_name,
              target_value: targetValue
            });
          }
        } else {
        }
      } else {
        // Handle simple rules (backward compatibility)
        if (evaluateCondition(sourceFieldValue, rule.comparison_operator, rule.trigger_value)) {
          ruleApplied = true;
          updates[rule.target_field_name] = rule.target_value;
          appliedRules.push({
            rule_id: rule.id,
            rule_name: rule.rule_name,
            rule_type: rule.rule_type || 'simple',
            source_field: rule.source_field_name,
            target_field: rule.target_field_name,
            target_value: rule.target_value
          });
        }
      }
    }
    return { updates, appliedRules };
  } catch (error) {
    console.error('Error applying chain rules:', error);
    return { updates: {}, appliedRules: [] };
  }
};

/**
 * Enhanced middleware to apply chain rules before saving/updating records
 */
const applyChainRulesMiddleware = async (req, res, next) => {
  try {
    // Extract module from the route path
    const module = req.baseUrl.includes('/leads') ? 'leads' : 'accounts';
    const recordId = req.method === 'PUT' ? req.params.id : null;
    
    if (req.method === 'POST' || req.method === 'PUT') {

      // Prepare the field data for chain rule evaluation
      const fieldData = {};
      
      // Map standard fields to custom field names if needed
      const standardFieldMapping = {
        leads: {
          'first_name': 'fname',
          'last_name': 'lname', 
          'email': 'email_address',
          'phone': 'phone_number',
          'company': 'company_name'
        },
        accounts: {
          'account_name': 'name'
        }
      };
      
      // Add standard fields to fieldData
      Object.entries(req.body).forEach(([key, value]) => {
        if (key !== 'custom_fields') {
          const mappedField = standardFieldMapping[module]?.[key] || key;
          fieldData[mappedField] = value;
        }
      });
      
      // Add custom fields
      if (req.body.custom_fields) {
        Object.assign(fieldData, req.body.custom_fields);
      }

      const { updates, appliedRules } = await applyChainRules(module, fieldData, recordId);

      // Merge chain rule updates into custom_fields
      if (Object.keys(updates).length > 0) {
        if (!req.body.custom_fields) {
          req.body.custom_fields = {};
        }
        Object.assign(req.body.custom_fields, updates);
      }
      
      // Store applied rules info for logging/response
      req.appliedChainRules = appliedRules;
    }
    
    next();
  } catch (error) {
    console.error('Chain rules middleware error:', error);
    next(); 
  }
};

const getReadOnlyFields = async (module, currentData = {}) => {
  try {
    const db = await getDb();
    
    // Get all active chain rules for this module with bulk mappings
    const [chainRules] = await db.execute(`
      SELECT cr.*, 
             sf.field_name as source_field_name,
             tf.field_name as target_field_name,
             tf.id as target_field_id,
             cbm.mappings_json
      FROM chain_rules cr
      JOIN custom_field_definitions sf ON cr.source_field_id = sf.id
      JOIN custom_field_definitions tf ON cr.target_field_id = tf.id
      LEFT JOIN chain_bulk_mappings cbm ON cr.id = cbm.rule_id
      WHERE cr.module = ? AND cr.is_active = 1
    `, [module]);

    const readOnlyFields = new Set();
    const fieldValues = {};

    for (const rule of chainRules) {
      const sourceFieldValue = currentData[rule.source_field_name];
      let targetValue = null;
      
      if (rule.rule_type === 'bulk_mapping' && rule.mappings_json) {
        // Handle bulk mapping rules
        const mappings = JSON.parse(rule.mappings_json);
        targetValue = evaluateBulkMapping(sourceFieldValue, mappings);
      } else {
        // Handle simple rules
        if (evaluateCondition(sourceFieldValue, rule.comparison_operator, rule.trigger_value)) {
          targetValue = rule.target_value;
        }
      }
      
      if (targetValue !== null) {
        readOnlyFields.add(rule.target_field_name);
        fieldValues[rule.target_field_name] = targetValue;
      }
    }

    return {
      readOnlyFields: Array.from(readOnlyFields),
      computedValues: fieldValues
    };
  } catch (error) {
    console.error('Error getting read-only fields:', error);
    return { readOnlyFields: [], computedValues: {} };
  }
};

// API endpoint to manually trigger chain rules for existing records
const triggerChainRulesForRecord = async (module, recordId) => {
  try {
    const db = await getDb();
    const tableName = module === 'leads' ? 'leads' : 'accounts';
    
    // Get current record data
    const [recordData] = await db.execute(`SELECT * FROM ${tableName} WHERE id = ?`, [recordId]);
    if (recordData.length === 0) {
      throw new Error('Record not found');
    }
    
    // Get current custom field values
    const [customFields] = await db.execute(`
      SELECT cd.field_name, cfv.value
      FROM custom_field_values cfv
      JOIN custom_field_definitions cd ON cfv.definition_id = cd.id
      WHERE cfv.record_id = ? AND cfv.module = ?
    `, [recordId, module]);
    
    const currentCustomFields = Object.fromEntries(
      customFields.map(cf => [cf.field_name, cf.value])
    );
    
    // Merge standard fields with custom fields
    const allData = { ...recordData[0], ...currentCustomFields };
    
    const { updates, appliedRules } = await applyChainRules(module, allData, recordId);
    
    // Apply updates to custom fields
    if (Object.keys(updates).length > 0) {
      const [definitions] = await db.execute(
        "SELECT id, field_name FROM custom_field_definitions WHERE module = ?",
        [module]
      );
      const definitionMap = new Map(definitions.map(def => [def.field_name, def.id]));
      
      for (const [fieldName, value] of Object.entries(updates)) {
        const definitionId = definitionMap.get(fieldName);
        if (definitionId) {
          const storedValue = typeof value === 'boolean' ? (value ? '1' : '0') : value;
          await db.execute(`
            INSERT INTO custom_field_values (definition_id, record_id, module, value)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE value = VALUES(value)
          `, [definitionId, recordId, module, storedValue]);
        }
      }
    }
    
    return { updates, appliedRules };
  } catch (error) {
    console.error('Error triggering chain rules:', error);
    throw error;
  }
};

module.exports = {
  applyChainRules,
  applyChainRulesMiddleware,
  getReadOnlyFields,
  evaluateCondition,
  evaluateBulkMapping,
  triggerChainRulesForRecord
};