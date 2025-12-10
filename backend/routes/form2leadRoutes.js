// routes/form2leadRoutes.js
const express = require('express');

module.exports = (dependencies) => {
  const { getDb, logLeadHistory } = dependencies;
  const router = express.Router();

// Helper function to save custom fields for Form2Lead
const saveCustomFieldsForm2Lead = async (db, leadId, customFieldsObject) => {
  if (!customFieldsObject || Object.keys(customFieldsObject).length === 0) {
    return;
  }

  try {
    // Get all custom field definitions for leads module
    const [definitions] = await db.execute(
      "SELECT id, field_name, field_type FROM custom_field_definitions WHERE module = 'leads'"
    );
    const definitionMap = new Map(definitions.map(def => [def.field_name, { id: def.id, type: def.field_type }]));

    for (const [fieldName, value] of Object.entries(customFieldsObject)) {
      const definition = definitionMap.get(fieldName);
      if (!definition || !value) {
        continue; // Skip if field definition not found or value is empty
      }

      // Convert value based on field type
      let storedValue = value;
      switch (definition.type) {
        case 'BOOLEAN':
          storedValue = (value === true || value === 'true' || value === '1' || value === 1) ? '1' : '0';
          break;
        case 'NUMBER':
          storedValue = parseFloat(value).toString();
          if (isNaN(parseFloat(value))) {
            continue; // Skip invalid numbers
          }
          break;
        case 'DATE':
          // Ensure date is in proper format
          const dateObj = new Date(value);
          if (isNaN(dateObj.getTime())) {
            continue; // Skip invalid dates
          }
          storedValue = dateObj.toISOString().split('T')[0];
          break;
        case 'SELECT':
        case 'RADIO':
        case 'TEXT':
        case 'TEXTAREA':
        default:
          storedValue = value.toString();
          break;
      }

      try {
        await db.execute(`
          INSERT INTO custom_field_values (definition_id, record_id, module, value)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = CURRENT_TIMESTAMP
        `, [definition.id, leadId, 'leads', storedValue]);
      } catch (error) {
        console.error(`Error saving custom field ${fieldName}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in saveCustomFieldsForm2Lead:', error);
  }
};

// Helper function to get custom field values for a lead
const getCustomFieldValues = async (db, leadId) => {
  try {
    const [customFieldValues] = await db.execute(`
      SELECT 
        cfd.field_name,
        cfd.field_label,
        cfd.field_type,
        cfv.value
      FROM custom_field_values cfv
      JOIN custom_field_definitions cfd ON cfv.definition_id = cfd.id
      WHERE cfv.record_id = ? AND cfv.module = 'leads'
    `, [leadId]);

    const customFields = {};
    customFieldValues.forEach(field => {
      // Convert stored values back to appropriate types
      let convertedValue = field.value;
      switch (field.field_type) {
        case 'BOOLEAN':
          convertedValue = field.value === '1';
          break;
        case 'NUMBER':
          convertedValue = parseFloat(field.value);
          break;
        default:
          convertedValue = field.value;
      }
      
      customFields[field.field_name] = {
        label: field.field_label,
        type: field.field_type,
        value: convertedValue
      };
    });

    return customFields;
  } catch (error) {
    console.error('Error fetching custom field values:', error);
    return {};
  }
};

// Main form2lead endpoint
router.post('/form2lead', async (req, res) => {
  // CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let db;
  try {
    db = await getDb();
    await db.execute('START TRANSACTION');
    
    const {
      first_name, 
      last_name, 
      email, 
      phone, 
      company, 
      address_line1,
      city, 
      state, 
      postal_code, 
      country, 
      website, 
      lead_source, 
      notes, 
      custom_fields,
      status = 'new'
    } = req.body;

    // Enhanced validation
    if (!first_name?.trim() || !last_name?.trim() || !email?.trim()) {
      await db.execute('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: 'First name, last name, and email are required',
        field_errors: {
          first_name: !first_name?.trim() ? 'First name is required' : null,
          last_name: !last_name?.trim() ? 'Last name is required' : null,
          email: !email?.trim() ? 'Email is required' : null
        }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      await db.execute('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide a valid email address',
        field_errors: {
          email: 'Please provide a valid email address'
        }
      });
    }

    // Validate phone number format if provided
    if (phone && phone.trim()) {
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
      if (!phoneRegex.test(cleanPhone) || cleanPhone.length < 10) {
        await db.execute('ROLLBACK');
        return res.status(400).json({ 
          success: false, 
          error: 'Please provide a valid phone number',
          field_errors: {
            phone: 'Please provide a valid phone number'
          }
        });
      }
    }

    // Validate website URL format if provided
    if (website && website.trim()) {
      try {
        new URL(website);
      } catch (e) {
        await db.execute('ROLLBACK');
        return res.status(400).json({ 
          success: false, 
          error: 'Please provide a valid website URL',
          field_errors: {
            website: 'Please provide a valid website URL'
          }
        });
      }
    }

    // Check for duplicate email to prevent spam (optional - you might want to update existing leads)
    const [existingLead] = await db.execute(
      'SELECT id, fname, lname FROM leads WHERE email_address = ?', 
      [email.trim()]
    );

    if (existingLead.length > 0) {
      await db.execute('ROLLBACK');
      return res.status(409).json({ 
        success: false, 
        error: 'A lead with this email already exists',
        existing_lead: {
          id: existingLead[0].id,
          name: `${existingLead[0].fname} ${existingLead[0].lname}`
        }
      });
    }

    // Validate custom fields against their definitions
    if (custom_fields && Object.keys(custom_fields).length > 0) {
      const [customFieldDefs] = await db.execute(
        "SELECT field_name, field_type, is_required FROM custom_field_definitions WHERE module = 'leads' AND field_name IN (?)",
        [Object.keys(custom_fields)]
      );

      const fieldDefMap = new Map(customFieldDefs.map(def => [def.field_name, def]));
      
      for (const [fieldName, value] of Object.entries(custom_fields)) {
        const fieldDef = fieldDefMap.get(fieldName);
        if (!fieldDef) {
          continue; // Skip unknown fields
        }

        // Check required fields
        if (fieldDef.is_required === 1 && (!value || value.toString().trim() === '')) {
          await db.execute('ROLLBACK');
          return res.status(400).json({ 
            success: false, 
            error: `${fieldName} is required`,
            field_errors: {
              [fieldName]: `${fieldName} is required`
            }
          });
        }

        // Validate field types
        if (value && value.toString().trim() !== '') {
          switch (fieldDef.field_type) {
            case 'NUMBER':
              if (isNaN(parseFloat(value))) {
                await db.execute('ROLLBACK');
                return res.status(400).json({ 
                  success: false, 
                  error: `${fieldName} must be a valid number`,
                  field_errors: {
                    [fieldName]: `${fieldName} must be a valid number`
                  }
                });
              }
              break;
            case 'DATE':
              const dateObj = new Date(value);
              if (isNaN(dateObj.getTime())) {
                await db.execute('ROLLBACK');
                return res.status(400).json({ 
                  success: false, 
                  error: `${fieldName} must be a valid date`,
                  field_errors: {
                    [fieldName]: `${fieldName} must be a valid date`
                  }
                });
              }
              break;
          }
        }
      }
    }

    // Clean and prepare data
    const cleanData = {
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      company: company?.trim() || null,
      address_line1: address_line1?.trim() || null,
      city: city?.trim() || null,
      state: state?.trim() || null,
      postal_code: postal_code?.trim() || null,
      country: country?.trim() || null,
      website: website?.trim() || null,
      lead_source: lead_source?.trim() || 'Website Form',
      notes: notes?.trim() || null,
      status: status || 'new'
    };

    // Insert the lead
    const [result] = await db.execute(`
      INSERT INTO leads (
        fname, lname, email_address, phone_number, company_name, 
        address, city, state, zip_code, country, website_url, 
        source, comments, lead_status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      cleanData.first_name,
      cleanData.last_name,
      cleanData.email,
      cleanData.phone,
      cleanData.company,
      cleanData.address_line1,
      cleanData.city,
      cleanData.state,
      cleanData.postal_code,
      cleanData.country,
      cleanData.website,
      cleanData.lead_source,
      cleanData.notes,
      cleanData.status
    ]);

    const leadId = result.insertId;

    // Save custom fields if provided
    if (custom_fields && Object.keys(custom_fields).length > 0) {
      await saveCustomFieldsForm2Lead(db, leadId, custom_fields);
    }

    // Log the creation
    const description = `Lead created via Form2Lead from ${cleanData.lead_source}`;
    
    try {
      await logLeadHistory(
        leadId, 
        null,
        'Form2Lead System',
        'created', 
        null, 
        null, 
        null, 
        description
      );
    } catch (historyError) {
      console.error('Error logging lead history:', historyError);
    }

    await db.execute('COMMIT');

    res.status(201).json({ 
      success: true,
      message: 'Lead created successfully',
      lead_id: leadId,
      lead: {
        id: leadId,
        name: `${cleanData.first_name} ${cleanData.last_name}`,
        email: cleanData.email,
        source: cleanData.lead_source
      }
    });
    
  } catch (error) {
    if (db) {
      try {
        await db.execute('ROLLBACK');
      } catch (rollbackError) {
        console.error('Error rolling back transaction:', rollbackError);
      }
    }
    
    console.error('Error creating lead from Form2Lead:', error);
    
    res.status(500).json({ 
      success: false,
      error: 'Unable to process form submission. Please try again later.',
      error_code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// Enhanced validation endpoint
router.post('/form2lead/validate', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { email, custom_fields } = req.body;
    const validationErrors = {};
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email is required for validation' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      validationErrors.email = 'Please provide a valid email address';
    }

    const db = await getDb();
    
    // Check for existing email
    const [existingLead] = await db.execute(
      'SELECT id, fname, lname FROM leads WHERE email_address = ?', 
      [email.trim()]
    );

    const emailExists = existingLead.length > 0;
    if (emailExists) {
      validationErrors.email = 'A lead with this email already exists';
    }

    // Validate custom fields if provided
    if (custom_fields && Object.keys(custom_fields).length > 0) {
      const [customFieldDefs] = await db.execute(
        "SELECT field_name, field_type, is_required FROM custom_field_definitions WHERE module = 'leads'"
      );
      
      const fieldDefMap = new Map(customFieldDefs.map(def => [def.field_name, def]));
      
      for (const [fieldName, value] of Object.entries(custom_fields)) {
        const fieldDef = fieldDefMap.get(fieldName);
        if (!fieldDef) {
          validationErrors[fieldName] = 'Unknown field';
          continue;
        }

        // Check required fields
        if (fieldDef.is_required === 1 && (!value || value.toString().trim() === '')) {
          validationErrors[fieldName] = 'This field is required';
          continue;
        }

        // Validate field types
        if (value && value.toString().trim() !== '') {
          switch (fieldDef.field_type) {
            case 'NUMBER':
              if (isNaN(parseFloat(value))) {
                validationErrors[fieldName] = 'Must be a valid number';
              }
              break;
            case 'DATE':
              const dateObj = new Date(value);
              if (isNaN(dateObj.getTime())) {
                validationErrors[fieldName] = 'Must be a valid date';
              }
              break;
          }
        }
      }
    }

    res.json({ 
      success: true,
      valid: Object.keys(validationErrors).length === 0,
      email_exists: emailExists,
      validation_errors: validationErrors,
      message: emailExists 
        ? `A lead with this email already exists: ${existingLead[0].fname} ${existingLead[0].lname}` 
        : Object.keys(validationErrors).length === 0
          ? 'All fields are valid'
          : 'Some fields have validation errors'
    });
    
  } catch (error) {
    console.error('Error validating form data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Unable to validate form data'
    });
  }
});

// Get lead with custom fields (useful for form2lead admin/tracking)
router.get('/form2lead/lead/:id', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { id } = req.params;
    const db = await getDb();
    
    // Get lead data
    const [leadRows] = await db.execute(`
      SELECT 
        id, fname, lname, email_address, phone_number, company_name,
        address, city, state, zip_code, country, website_url,
        source, comments, lead_status, created_at, updated_at
      FROM leads 
      WHERE id = ?
    `, [id]);

    if (leadRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    const lead = leadRows[0];
    
    // Get custom field values
    const customFields = await getCustomFieldValues(db, id);

    res.json({
      success: true,
      lead: {
        ...lead,
        custom_fields: customFields
      }
    });

  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({
      success: false,
      error: 'Unable to fetch lead data'
    });
  }
});

// Get available custom fields for form building
router.get('/form2lead/custom-fields', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const db = await getDb();
    const [rows] = await db.execute(`
      SELECT 
        id, field_name, field_label, field_type, placeholder, 
        is_required, options 
      FROM custom_field_definitions 
      WHERE module = 'leads' 
      ORDER BY field_label
    `);
    
    // Parse options JSON for SELECT and RADIO fields
    const processedRows = rows.map(row => ({
      ...row,
      options: row.options ? JSON.parse(row.options) : null
    }));
    
    res.json({
      success: true,
      custom_fields: processedRows
    });
    
  } catch (error) {
    console.error('Error fetching custom fields:', error);
    res.status(500).json({
      success: false,
      error: 'Unable to fetch custom fields'
    });
  }
});

  return router;
};