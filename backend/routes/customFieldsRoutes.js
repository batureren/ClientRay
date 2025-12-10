// routes/customFields.js

const express = require('express');
module.exports = (dependencies) => {
  const { getDb, authenticateToken, requireRole } = dependencies;
  const router = express.Router();

const generateFieldName = (label) => {
  return label
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '_')           // Replace spaces with _
    .replace(/[^\w-]+/g, '')        // Remove all non-word chars
    .replace(/--+/g, '_')           // Replace multiple - with single _
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
};

// Valid field types - Added MULTISELECT
const VALID_FIELD_TYPES = ['TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'RADIO', 'MULTISELECT'];

// GET all custom field definitions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const [rows] = await db.execute(
      'SELECT id, module, field_name, field_label, field_type, placeholder, is_required, is_read_only, options FROM custom_field_definitions ORDER BY module, field_label'
    );
    
    // Parse options JSON for SELECT, RADIO, and MULTISELECT fields
    const processedRows = rows.map(row => ({
      ...row,
      options: row.options ? JSON.parse(row.options) : null
    }));
    
    res.json(processedRows);
  } catch (error) {
    console.error('Error fetching custom field definitions:', error);
    res.status(500).json({ error: 'Failed to retrieve custom field definitions.' });
  }
});

// POST a new custom field definition
router.post('/', authenticateToken, requireRole('manager'), async (req, res) => {
  try {
    const {
      module,
      field_label,
      field_type,
      placeholder,
      is_required,
      options
    } = req.body;

    // --- Validation ---
    if (!module || !field_label || !field_type) {
      return res.status(400).json({ error: 'Module, field label, and field type are required.' });
    }
    if (!['leads', 'accounts'].includes(module)) {
      return res.status(400).json({ error: 'Module must be either "leads" or "accounts".' });
    }
    if (!VALID_FIELD_TYPES.includes(field_type)) {
      return res.status(400).json({ error: `Invalid field type. Must be one of: ${VALID_FIELD_TYPES.join(', ')}` });
    }

    // Validate options for SELECT, RADIO, and MULTISELECT fields
    if (field_type === 'SELECT' || field_type === 'RADIO' || field_type === 'MULTISELECT') {
      if (!options || !Array.isArray(options) || options.length === 0) {
        return res.status(400).json({ error: `Options are required for ${field_type} field type.` });
      }
      
      // Validate that all options are non-empty strings
      const invalidOptions = options.filter(option => !option || typeof option !== 'string' || option.trim() === '');
      if (invalidOptions.length > 0) {
        return res.status(400).json({ error: 'All options must be non-empty strings.' });
      }
      
      // Check for duplicate options
      const uniqueOptions = [...new Set(options)];
      if (uniqueOptions.length !== options.length) {
        return res.status(400).json({ error: 'Duplicate options are not allowed.' });
      }
    } else if (options && options.length > 0) {
      return res.status(400).json({ error: `Options are only allowed for SELECT, RADIO, and MULTISELECT field types.` });
    }

    // --- Generate internal field_name ---
    const field_name = generateFieldName(field_label);
    if (!field_name) {
        return res.status(400).json({ error: 'Field label must contain valid characters.' });
    }

    const db = await getDb();
    const [result] = await db.execute(`
      INSERT INTO custom_field_definitions
        (module, field_name, field_label, field_type, placeholder, is_required, options)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      module,
      field_name,
      field_label,
      field_type,
      placeholder || null,
      is_required !== undefined ? is_required : false,
      (field_type === 'SELECT' || field_type === 'RADIO' || field_type === 'MULTISELECT') ? JSON.stringify(options) : null
    ]);

    res.status(201).json({ id: result.insertId, message: 'Custom field created successfully.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A field with this name already exists for this module.' });
    }
    console.error('Error creating custom field:', error);
    res.status(500).json({ error: 'An internal error occurred while creating the field.' });
  }
});

// PUT (Update) an existing custom field definition
router.put('/:id', authenticateToken, requireRole('manager'), async (req, res) => {
    try {
      const { id } = req.params;
      const {
        field_label,
        placeholder,
        is_required,
        options
      } = req.body;
  
      if (!field_label) {
        return res.status(400).json({ error: 'Field label is required.' });
      }

      const field_name = generateFieldName(field_label);

      const db = await getDb();
      
      // Get current field to check its type
      const [currentField] = await db.execute(`
        SELECT field_type FROM custom_field_definitions WHERE id = ?
      `, [id]);
      
      if (currentField.length === 0) {
        return res.status(404).json({ error: 'Custom field not found.' });
      }
      
      const field_type = currentField[0].field_type;
      
      // Validate options for SELECT, RADIO, and MULTISELECT fields
      if (field_type === 'SELECT' || field_type === 'RADIO' || field_type === 'MULTISELECT') {
        if (!options || !Array.isArray(options) || options.length === 0) {
          return res.status(400).json({ error: `Options are required for ${field_type} field type.` });
        }
        
        // Validate that all options are non-empty strings
        const invalidOptions = options.filter(option => !option || typeof option !== 'string' || option.trim() === '');
        if (invalidOptions.length > 0) {
          return res.status(400).json({ error: 'All options must be non-empty strings.' });
        }
        
        // Check for duplicate options
        const uniqueOptions = [...new Set(options)];
        if (uniqueOptions.length !== options.length) {
          return res.status(400).json({ error: 'Duplicate options are not allowed.' });
        }
      } else if (options && options.length > 0) {
        return res.status(400).json({ error: `Options are only allowed for SELECT, RADIO, and MULTISELECT field types.` });
      }
  
      const [result] = await db.execute(`
        UPDATE custom_field_definitions
        SET field_label = ?, field_name = ?, placeholder = ?, is_required = ?, options = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        field_label,
        field_name,
        placeholder || null,
        is_required !== undefined ? is_required : false,
        (field_type === 'SELECT' || field_type === 'RADIO' || field_type === 'MULTISELECT') ? JSON.stringify(options) : null,
        id
      ]);
  
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Custom field not found.' });
      }
  
      res.json({ message: 'Custom field updated successfully.' });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Another field with this name already exists for this module.' });
      }
      console.error('Error updating custom field:', error);
      res.status(500).json({ error: 'Failed to update custom field.' });
    }
  });

// DELETE a custom field definition
router.delete('/:id', authenticateToken, requireRole('manager'), async (req, res) => {
  try {
    const { id } = req.params;

    const db = await getDb();
    const [result] = await db.execute(
      'DELETE FROM custom_field_definitions WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Custom field not found.' });
    }

    res.json({
      success: true,
      message: 'Custom field and all its associated data have been deleted.'
    });
  } catch (error) {
    console.error('Error deleting custom field:', error);
    res.status(500).json({ error: 'Failed to delete custom field.' });
  }
});

  return router;
};