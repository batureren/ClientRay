// routes/customFieldMappings.js
const express = require('express');
module.exports = (dependencies) => {
  const { getDb, authenticateToken, requireRole } = dependencies;
  const router = express.Router();

// Field type compatibility matrix
const FIELD_TYPE_COMPATIBILITY = {
  'TEXT': ['TEXT', 'TEXTAREA'],
  'TEXTAREA': ['TEXT', 'TEXTAREA'], 
  'NUMBER': ['NUMBER'],
  'DATE': ['DATE'],
  'BOOLEAN': ['BOOLEAN'],
  'SELECT': ['SELECT', 'RADIO', 'MULTISELECT'],
  'RADIO': ['SELECT', 'RADIO', 'MULTISELECT'],
  'MULTISELECT': ['MULTISELECT', 'SELECT']
};

// Helper function to check if field types are compatible
const areTypesCompatible = (leadType, accountType) => {
  const compatibleTypes = FIELD_TYPE_COMPATIBILITY[leadType];
  return compatibleTypes && compatibleTypes.includes(accountType);
};

// Helper function to check if options are compatible for SELECT/RADIO/MULTISELECT fields
const areOptionsCompatible = (leadOptions, accountOptions, leadType, accountType) => {
  if (!leadOptions && !accountOptions) return true;
    if ((leadType === 'SELECT' || leadType === 'RADIO' || leadType === 'MULTISELECT') && 
      (accountType === 'SELECT' || accountType === 'RADIO' || accountType === 'MULTISELECT')) {
    if (!leadOptions || !accountOptions) return false;
    
    // Parse options if they're strings
    const parsedLeadOptions = typeof leadOptions === 'string' ? JSON.parse(leadOptions) : leadOptions;
    const parsedAccountOptions = typeof accountOptions === 'string' ? JSON.parse(accountOptions) : accountOptions;

    // Normalize options to an array of values (strings/numbers)
    const normalizeOption = (option) => {
      if (typeof option === 'object' && option !== null && 'value' in option) {
        return option.value;
      }
      return option; 
    };

    const leadValues = parsedLeadOptions.map(normalizeOption);
    const accountValues = parsedAccountOptions.map(normalizeOption);

    return leadValues.every(leadValue => accountValues.includes(leadValue));
  }
  
  return true;
};

// GET all field mappings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const [rows] = await db.execute(`
      SELECT cfm.*, 
             lcd.field_label as lead_field_label,
             lcd.field_name as lead_field_name,
             lcd.field_type as lead_field_type,
             lcd.options as lead_field_options,
             acd.field_label as account_field_label,
             acd.field_name as account_field_name,
             acd.field_type as account_field_type,
             acd.options as account_field_options
      FROM custom_field_mappings cfm
      JOIN custom_field_definitions lcd ON cfm.lead_field_id = lcd.id
      JOIN custom_field_definitions acd ON cfm.account_field_id = acd.id
      ORDER BY lcd.field_label
    `);
    
    // Parse options for SELECT, RADIO, and MULTISELECT fields
    const processedRows = rows.map(row => ({
      ...row,
      lead_field_options: row.lead_field_options ? JSON.parse(row.lead_field_options) : null,
      account_field_options: row.account_field_options ? JSON.parse(row.account_field_options) : null
    }));
    
    res.json(processedRows);
  } catch (error) {
    console.error('Error fetching field mappings:', error);
    res.status(500).json({ error: 'Failed to retrieve field mappings.' });
  }
});

// GET available fields for mapping
router.get('/available-fields', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    
    // Get lead fields that aren't already mapped
    const [leadFields] = await db.execute(`
      SELECT cd.id, cd.field_label, cd.field_name, cd.field_type, cd.options
      FROM custom_field_definitions cd
      WHERE cd.module = 'leads'
      AND cd.id NOT IN (
        SELECT lead_field_id FROM custom_field_mappings
      )
      ORDER BY cd.field_label
    `);

    // Get all account fields (account fields can be mapped to multiple lead fields)
    const [accountFields] = await db.execute(`
      SELECT id, field_label, field_name, field_type, options
      FROM custom_field_definitions
      WHERE module = 'accounts'
      ORDER BY field_label
    `);

    // Parse options for SELECT, RADIO, and MULTISELECT fields
    const processedLeadFields = leadFields.map(field => ({
      ...field,
      options: field.options ? JSON.parse(field.options) : null
    }));
    
    const processedAccountFields = accountFields.map(field => ({
      ...field,
      options: field.options ? JSON.parse(field.options) : null
    }));

    res.json({
      lead_fields: processedLeadFields,
      account_fields: processedAccountFields
    });
  } catch (error) {
    console.error('Error fetching available fields:', error);
    res.status(500).json({ error: 'Failed to retrieve available fields.' });
  }
});

// POST create new field mapping
router.post('/', authenticateToken, requireRole('manager'), async (req, res) => {
  try {
    const { lead_field_id, account_field_id, mapping_type = 'DIRECT' } = req.body;

    if (!lead_field_id || !account_field_id) {
      return res.status(400).json({ error: 'Lead field and account field are required.' });
    }

    const db = await getDb();
    
    // Check if this lead field is already mapped
    const [existingMapping] = await db.execute(`
      SELECT id FROM custom_field_mappings WHERE lead_field_id = ?
    `, [lead_field_id]);

    if (existingMapping.length > 0) {
      return res.status(409).json({ error: 'This lead field is already mapped to an account field.' });
    }
    
    // Validate that the fields exist and have compatible types
    const [fieldCheck] = await db.execute(`
      SELECT 
        lcd.field_type as lead_type,
        lcd.options as lead_options,
        acd.field_type as account_type,
        acd.options as account_options,
        lcd.field_label as lead_label,
        acd.field_label as account_label
      FROM custom_field_definitions lcd, custom_field_definitions acd
      WHERE lcd.id = ? AND lcd.module = 'leads'
      AND acd.id = ? AND acd.module = 'accounts'
    `, [lead_field_id, account_field_id]);

    if (fieldCheck.length === 0) {
      return res.status(400).json({ error: 'Invalid field selection.' });
    }

    const { lead_type, lead_options, account_type, account_options, lead_label, account_label } = fieldCheck[0];
    
    // Check type compatibility using the compatibility matrix
    if (!areTypesCompatible(lead_type, account_type)) {
      return res.status(400).json({ 
        error: `Field type mismatch: ${lead_label} (${lead_type}) cannot be mapped to ${account_label} (${account_type}). Compatible types for ${lead_type}: ${FIELD_TYPE_COMPATIBILITY[lead_type]?.join(', ') || 'none'}`
      });
    }

    // Check options compatibility for SELECT, RADIO, and MULTISELECT fields
    if (!areOptionsCompatible(lead_options, account_options, lead_type, account_type)) {
      return res.status(400).json({ 
        error: `Options mismatch: ${lead_label} options are not compatible with ${account_label} options. Lead field options must be a subset of account field options.`
      });
    }

    // Special warning for MULTISELECT to SELECT mapping (potential data loss)
    let warning = null;
    if (lead_type === 'MULTISELECT' && account_type === 'SELECT') {
      warning = 'Warning: Mapping MULTISELECT to SELECT may result in data loss. Only the first selected value will be preserved.';
    }

    const [result] = await db.execute(`
      INSERT INTO custom_field_mappings (lead_field_id, account_field_id, mapping_type)
      VALUES (?, ?, ?)
    `, [lead_field_id, account_field_id, mapping_type]);

    const response = { 
      id: result.insertId, 
      message: 'Field mapping created successfully.' 
    };
    
    if (warning) {
      response.warning = warning;
    }

    res.status(201).json(response);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'This lead field is already mapped to an account field.' });
    }
    console.error('Error creating field mapping:', error);
    res.status(500).json({ error: 'Failed to create field mapping.' });
  }
});

// PUT update field mapping
router.put('/:id', authenticateToken, requireRole('manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const { account_field_id, mapping_type } = req.body;

    const db = await getDb();
    
    if (account_field_id) {
      const [compatibilityCheck] = await db.execute(`
        SELECT 
          lcd.field_type as lead_type,
          lcd.options as lead_options,
          acd.field_type as account_type,
          acd.options as account_options,
          lcd.field_label as lead_label,
          acd.field_label as account_label
        FROM custom_field_mappings cfm
        JOIN custom_field_definitions lcd ON cfm.lead_field_id = lcd.id
        JOIN custom_field_definitions acd ON acd.id = ?
        WHERE cfm.id = ? AND acd.module = 'accounts'
      `, [account_field_id, id]);

      if (compatibilityCheck.length === 0) {
        return res.status(400).json({ error: 'Invalid account field selection.' });
      }

      const { lead_type, lead_options, account_type, account_options, lead_label, account_label } = compatibilityCheck[0];
      
      if (!areTypesCompatible(lead_type, account_type)) {
        return res.status(400).json({ 
          error: `Field type mismatch: ${lead_label} (${lead_type}) cannot be mapped to ${account_label} (${account_type}). Compatible types for ${lead_type}: ${FIELD_TYPE_COMPATIBILITY[lead_type]?.join(', ') || 'none'}`
        });
      }

      // Check options compatibility for SELECT, RADIO, and MULTISELECT fields
      if (!areOptionsCompatible(lead_options, account_options, lead_type, account_type)) {
        return res.status(400).json({ 
          error: `Options mismatch: ${lead_label} options are not compatible with ${account_label} options. Lead field options must be a subset of account field options.`
        });
      }
    }

    const [result] = await db.execute(`
      UPDATE custom_field_mappings
      SET account_field_id = ?, mapping_type = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [account_field_id, mapping_type, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Field mapping not found.' });
    }

    res.json({ message: 'Field mapping updated successfully.' });
  } catch (error) {
    console.error('Error updating field mapping:', error);
    res.status(500).json({ error: 'Failed to update field mapping.' });
  }
});

// DELETE field mapping
router.delete('/:id', authenticateToken, requireRole('manager'), async (req, res) => {
  try {
    const { id } = req.params;

    const db = await getDb();
    const [result] = await db.execute(
      'DELETE FROM custom_field_mappings WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Field mapping not found.' });
    }

    res.json({ message: 'Field mapping deleted successfully.' });
  } catch (error) {
    console.error('Error deleting field mapping:', error);
    res.status(500).json({ error: 'Failed to delete field mapping.' });
  }
});

// GET field type compatibility info (optional - for frontend reference)
router.get('/compatibility', authenticateToken, (req, res) => {
  res.json({
    compatibility_matrix: FIELD_TYPE_COMPATIBILITY,
    description: 'Field types and their compatible mapping targets'
  });
});

  return router;
};