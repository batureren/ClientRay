//routes/fieldDefinations

const express = require('express');
module.exports = (dependencies) => {
  const { getDb, authenticateToken } = dependencies;
  const router = express.Router();

router.get('/:table', authenticateToken, async (req, res) => {
  try {
    const { table } = req.params;
    const db = await getDb();
    const allowedTables = ['leads', 'accounts', 'products', 'users'];
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
    let fieldDefinitions;
    
    if (table === 'leads') {
      fieldDefinitions = getTransformedLeadFields();
    } else if (table === 'accounts') {
      fieldDefinitions = getTransformedAccountFields();
    } else if (table === 'products') {
      fieldDefinitions = getTransformedProductFields();
    } else {
      // For other tables, fall back to database introspection
      const query = `
        SELECT 
          COLUMN_NAME as column_name,
          DATA_TYPE as data_type,
          IS_NULLABLE as is_nullable,
          COLUMN_DEFAULT as column_default,
          CHARACTER_MAXIMUM_LENGTH as character_maximum_length,
          NUMERIC_PRECISION as numeric_precision,
          NUMERIC_SCALE as numeric_scale
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = ? 
        AND TABLE_SCHEMA = DATABASE()
        ORDER BY ORDINAL_POSITION
      `;
      
      const [rows] = await db.query(query, [table]);
      fieldDefinitions = rows.map(column => ({
        name: column.column_name,
        label: getCustomLabel(column.column_name, table),
        type: mapDataType(column.data_type),
        nullable: column.is_nullable === 'YES',
        maxLength: column.character_maximum_length
      }));
    }

    res.json(fieldDefinitions);
  } catch (error) {
    console.error('Error fetching field definitions:', error);
    res.status(500).json({ error: 'Failed to fetch field definitions' });
  }
});

// Define field definitions that match the transformed data structure
function getTransformedLeadFields() {
  return [
    { name: 'id', label: 'ID', type: 'number', nullable: false },
    { name: 'first_name', label: 'First Name', type: 'text', nullable: true },
    { name: 'last_name', label: 'Last Name', type: 'text', nullable: true },
    { name: 'email', label: 'Email', type: 'text', nullable: true },
    { name: 'phone', label: 'Phone', type: 'text', nullable: true },
    { name: 'company', label: 'Company', type: 'text', nullable: true },
    { name: 'address_line1', label: 'Address', type: 'text', nullable: true },
    { name: 'city', label: 'City', type: 'text', nullable: true },
    { name: 'state', label: 'State', type: 'text', nullable: true },
    { name: 'postal_code', label: 'Postal Code', type: 'text', nullable: true },
    { name: 'country', label: 'Country', type: 'text', nullable: true },
    { name: 'website', label: 'Website', type: 'text', nullable: true },
    { name: 'lead_source', label: 'Lead Source', type: 'select', nullable: true, 
      options: ['website', 'referral', 'cold_call', 'social_media', 'email', 'other'] },
    { name: 'notes', label: 'Notes', type: 'text', nullable: true },
    { name: 'status', label: 'Status', type: 'select', nullable: false,
      options: ['new', 'contacted', 'qualified', 'converted', 'lost'] },
    { name: 'created_at', label: 'Created Date', type: 'date', nullable: false },
    { name: 'updated_at', label: 'Updated Date', type: 'date', nullable: false }
  ];
}

function getTransformedAccountFields() {
  return [
    { name: 'id', label: 'ID', type: 'number', nullable: false },
    { name: 'account_name', label: 'Account Name', type: 'text', nullable: false },
    { name: 'account_type', label: 'Account Type', type: 'select', nullable: true,
      options: ['customer', 'prospect', 'partner'] },
    { name: 'industry', label: 'Industry', type: 'text', nullable: true },
    { name: 'annual_revenue', label: 'Annual Revenue', type: 'number', nullable: true },
    { name: 'employee_count', label: 'Employee Count', type: 'number', nullable: true },
    { name: 'primary_contact_first_name', label: 'Primary Contact First Name', type: 'text', nullable: true },
    { name: 'primary_contact_last_name', label: 'Primary Contact Last Name', type: 'text', nullable: true },
    { name: 'primary_contact_email', label: 'Primary Contact Email', type: 'text', nullable: true },
    { name: 'primary_contact_phone', label: 'Primary Contact Phone', type: 'text', nullable: true },
    { name: 'billing_address_line1', label: 'Billing Address', type: 'text', nullable: true },
    { name: 'billing_city', label: 'Billing City', type: 'text', nullable: true },
    { name: 'billing_state', label: 'Billing State', type: 'text', nullable: true },
    { name: 'billing_postal_code', label: 'Billing Postal Code', type: 'text', nullable: true },
    { name: 'billing_country', label: 'Billing Country', type: 'text', nullable: true },
    { name: 'website', label: 'Website', type: 'text', nullable: true },
    { name: 'description', label: 'Description', type: 'text', nullable: true },
    { name: 'has_products', label: 'Has Products', type: 'select', nullable: true,
      options: ['yes', 'no'] },
    { name: 'product_count', label: 'Product Count', type: 'number', nullable: true },
    { name: 'has_product_name', label: 'Has Product Name', type: 'text', nullable: true },
    { name: 'total_products_value', label: 'Total Products Value', type: 'number', nullable: true },
    { name: 'purchase_date', label: 'Product Purchase Date', type: 'date', nullable: true },
    { name: 'created_at', label: 'Created Date', type: 'date', nullable: false },
    { name: 'updated_at', label: 'Updated Date', type: 'date', nullable: false }
  ];
}

function getTransformedProductFields() {
  return [
    { name: 'id', label: 'ID', type: 'number', nullable: false },
    { name: 'product_code', label: 'Product Code', type: 'text', nullable: true },
    { name: 'product_name', label: 'Product Name', type: 'text', nullable: false },
    { name: 'product_category', label: 'Product Category', type: 'text', nullable: true },
    { name: 'list_price', label: 'List Price', type: 'number', nullable: true },
    { name: 'cost_price', label: 'Cost Price', type: 'number', nullable: true },
    { name: 'currency', label: 'Currency', type: 'text', nullable: true },
    { name: 'description', label: 'Description', type: 'text', nullable: true },
    { name: 'specifications', label: 'Specifications', type: 'text', nullable: true },
    { name: 'is_active', label: 'Is Active', type: 'select', nullable: true,
      options: ['true', 'false'] },
    { name: 'stock_quantity', label: 'Stock Quantity', type: 'number', nullable: true },
    { name: 'reorder_point', label: 'Reorder Point', type: 'number', nullable: true },
    { name: 'created_at', label: 'Created Date', type: 'date', nullable: false },
    { name: 'updated_at', label: 'Updated Date', type: 'date', nullable: false }
  ];
}

// Helper functions
function getCustomLabel(columnName, table) {
  // Define custom labels for specific fields
  const customLabels = {
    'leads': {
      'fname': 'First Name',
      'lname': 'Last Name',
      'email_address': 'Email',
      'phone_number': 'Phone',
      'company_name': 'Company',
      'address': 'Address',
      'zip_code': 'Postal Code',
      'website_url': 'Website',
      'source': 'Lead Source',
      'comments': 'Notes',
      'lead_status': 'Status',
      'created_at': 'Created Date',
      'updated_at': 'Updated Date'
    },
    'accounts': {
      'name': 'Account Name',
      'type': 'Account Type',
      'revenue': 'Annual Revenue',
      'employees': 'Employee Count',
      'contact_fname': 'Primary Contact First Name',
      'contact_lname': 'Primary Contact Last Name',
      'contact_email': 'Primary Contact Email',
      'contact_phone': 'Primary Contact Phone',
      'billing_address': 'Billing Address',
      'billing_city': 'Billing City',
      'billing_state': 'Billing State',
      'billing_zip': 'Billing Postal Code',
      'billing_country': 'Billing Country',
      'website_url': 'Website',
      'has_products': 'Has Products',
      'product_count': 'Product Count',
      'purchase_date': 'Product Purchase Date',
      'created_at': 'Created Date',
      'updated_at': 'Updated Date'
    },
    'products': {
      'sku': 'Product Code',
      'name': 'Product Name',
      'category': 'Product Category',
      'price': 'List Price',
      'cost': 'Cost Price',
      'specs': 'Specifications',
      'active': 'Is Active',
      'stock': 'Stock Quantity',
      'reorder_point': 'Reorder Point',
      'created_at': 'Created Date',
      'updated_at': 'Updated Date'
    }
  };
  
  // Check if there's a custom label for this field
  const tableLabels = customLabels[table];
  if (tableLabels && tableLabels[columnName]) {
    return tableLabels[columnName];
  }
  
  // Fallback to automatic formatting
  return formatLabel(columnName);
}

function formatLabel(columnName) {
  // Handle common abbreviations and special cases
  const specialCases = {
    'id': 'ID',
    'url': 'URL',
    'api': 'API',
    'crm': 'CRM',
    'sms': 'SMS',
    'pdf': 'PDF',
    'csv': 'CSV',
    'json': 'JSON',
    'xml': 'XML',
    'html': 'HTML',
    'css': 'CSS',
    'js': 'JavaScript',
    'sql': 'SQL'
  };

  return columnName
    .split('_')
    .map(word => {
      const lowerWord = word.toLowerCase();
      if (specialCases[lowerWord]) {
        return specialCases[lowerWord];
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function mapDataType(sqlType) {
  const typeMap = {
    'int': 'number',
    'integer': 'number',
    'bigint': 'number',
    'decimal': 'number',
    'numeric': 'number',
    'float': 'number',
    'double': 'number',
    'real': 'number',
    'varchar': 'text',
    'char': 'text',
    'text': 'text',
    'longtext': 'text',
    'mediumtext': 'text',
    'tinytext': 'text',
    'boolean': 'select',
    'tinyint': 'number',
    'date': 'date',
    'datetime': 'date',
    'timestamp': 'date',
    'time': 'date'
  };
  
  return typeMap[sqlType.toLowerCase()] || 'text';
}

  return router;
};