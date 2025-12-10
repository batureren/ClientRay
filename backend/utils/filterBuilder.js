// utils/filterBuilder.js

const getDateRangeForPreset = (preset) => {
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
  
  switch (preset) {
    case 'today':
      return { start: startOfToday, end: endOfToday }
      
    case 'this_week': {
      const startOfWeek = new Date(startOfToday)
      // Adjust to Monday as the start of the week
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1); 
      startOfWeek.setDate(diff);
      
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      endOfWeek.setHours(23, 59, 59)
      return { start: startOfWeek, end: endOfWeek }
    }
    
    case 'this_month': {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59)
      return { start: startOfMonth, end: endOfMonth }
    }
    
    case 'previous_month': {
      const startOfPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const endOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59)
      return { start: startOfPrevMonth, end: endOfPrevMonth }
    }
    
    case 'this_year': {
      const startOfYear = new Date(today.getFullYear(), 0, 1)
      const endOfYear = new Date(today.getFullYear(), 11, 31, 23, 59, 59)
      return { start: startOfYear, end: endOfYear }
    }
    
    case 'previous_year': {
      const startOfPrevYear = new Date(today.getFullYear() - 1, 0, 1)
      const endOfPrevYear = new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59)
      return { start: startOfPrevYear, end: endOfPrevYear }
    }
    
    case 'last_7_days': {
      const last7Days = new Date(startOfToday)
      last7Days.setDate(startOfToday.getDate() - 6) // Inclusive of today
      return { start: last7Days, end: endOfToday }
    }
    
    case 'last_30_days': {
      const last30Days = new Date(startOfToday)
      last30Days.setDate(startOfToday.getDate() - 29)
      return { start: last30Days, end: endOfToday }
    }
    
    case 'last_90_days': {
      const last90Days = new Date(startOfToday)
      last90Days.setDate(startOfToday.getDate() - 89)
      return { start: last90Days, end: endOfToday }
    }
    
    default:
      return null
  }
}

// Helper function to format date for SQL
const formatDateForSQL = (date) => {
  return date.toISOString().split('T')[0]
}

const buildFilterWhereClause = (filters, reportType = 'leads') => {
  if (!filters || filters.length === 0) {
    return { whereClause: '', params: [] };
  }

  const fieldMapping = {
    leads: {
      'first_name': 'fname',
      'last_name': 'lname',
      'email': 'email_address',
      'phone': 'phone_number',
      'company': 'company_name',
      'status': 'lead_status',
      'created_at': 'created_at',
      'updated_at': 'updated_at',
      'source': 'source'
    },
    calls: {
      // Map computed/alias fields to their underlying SQL expressions
      'logged_by_name': 'CONCAT(u.first_name, \' \', u.last_name)',
      'lead_name': 'CONCAT(l.fname, \' \', l.lname)',
      'lead_company': 'l.company_name',
      'lead_email': 'l.email_address',
      'lead_phone': 'l.phone_number',
      // Direct field mappings
      'category': 'cl.category',
      'call_outcome': 'cl.call_outcome',
      'call_date': 'cl.call_date',
      'call_duration': 'cl.call_duration',
      'notes': 'cl.notes',
      'created_at': 'cl.created_at',
      'updated_at': 'cl.updated_at',
      'user_name': 'cl.user_name'
    },
    account_calls: {
      // Map computed/alias fields to their underlying SQL expressions
      'logged_by_name': 'CONCAT(u.first_name, \' \', u.last_name)',
      'account_name': 'a.name',
      'primary_contact_name': 'CONCAT(a.contact_fname, \' \', a.contact_lname)',
      'primary_contact_first_name': 'a.contact_fname',
      'primary_contact_last_name': 'a.contact_lname',
      'company_type': 'a.type',
      'industry': 'a.industry',
      'account_phone': 'a.contact_phone',
      'account_email': 'a.contact_email',
      'account_status': 'a.type',
      'address': 'a.billing_address',
      'city': 'a.billing_city',
      'state': 'a.billing_state',
      'zip_code': 'a.billing_zip',
      // Direct field mappings
      'category': 'ac.category',
      'call_outcome': 'ac.call_outcome',
      'call_date': 'ac.call_date',
      'call_duration': 'ac.call_duration',
      'contact_person': 'ac.contact_person',
      'notes': 'ac.notes',
      'created_at': 'ac.created_at',
      'updated_at': 'ac.updated_at',
      'user_name': 'ac.user_name'
    }
  };
  
  // Centralized definition of date fields for each report type
  const dateFields = {
    leads: ['created_at', 'updated_at'],
    calls: ['call_date', 'created_at', 'updated_at'],
    account_calls: ['call_date', 'created_at', 'updated_at']
  };

  const conditions = [];
  const params = [];

  filters.forEach(filter => {
    if (!filter || !filter.field || filter.operator == null) return;

    const dbField = fieldMapping[reportType]?.[filter.field] || filter.field;
    
    // Check if this is a date field by looking at the original field name
    const originalFieldName = filter.field;
    const isDateField = dateFields[reportType]?.includes(originalFieldName) || 
                       (originalFieldName.includes('date') || originalFieldName.includes('created_at') || originalFieldName.includes('updated_at'));
    
    let value = filter.value;
    let condition;
    
    // For date fields that aren't already wrapped in functions, apply DATE() wrapper
    const needsDateWrapper = isDateField && !dbField.includes('(');
    const effectiveField = needsDateWrapper ? `DATE(${dbField})` : dbField;

    const datePresets = ['today', 'this_week', 'this_month', 'previous_month', 'this_year', 'previous_year', 'last_7_days', 'last_30_days', 'last_90_days'];
    if (datePresets.includes(filter.operator)) {
      const dateRange = getDateRangeForPreset(filter.operator);
      if (dateRange) {
        // Always wrap the field in DATE() for presets
        const dateFieldForPreset = dbField.includes('(') ? `DATE(${dbField})` : `DATE(${dbField})`;
        condition = `${dateFieldForPreset} BETWEEN ? AND ?`;
        params.push(formatDateForSQL(dateRange.start), formatDateForSQL(dateRange.end));
        conditions.push(condition);
      }
      return;
    }

    if (value === undefined || value === null) return;

    switch (filter.operator) {
      case 'contains':
      case 'not_contains':
      case 'starts_with':
      case 'ends_with':
        // String operators should not use the DATE() wrapper
        condition = {
          'contains': `${dbField} LIKE ?`,
          'not_contains': `${dbField} NOT LIKE ?`,
          'starts_with': `${dbField} LIKE ?`,
          'ends_with': `${dbField} LIKE ?`
        }[filter.operator];
        const paramValue = {
          'contains': `%${value}%`,
          'not_contains': `%${value}%`,
          'starts_with': `${value}%`,
          'ends_with': `%${value}`
        }[filter.operator];
        params.push(paramValue);
        break;

      // Operators that work for both date and non-date fields
      case 'equals':
        condition = `${effectiveField} = ?`;
        params.push(value);
        break;
      case 'not_equals':
        condition = `${effectiveField} != ?`;
        params.push(value);
        break;

      // Date/Number specific operators
      case 'greater_than':
      case 'after':
        condition = `${effectiveField} > ?`;
        params.push(value);
        break;
      case 'less_than':
      case 'before':
        condition = `${effectiveField} < ?`;
        params.push(value);
        break;
      case 'between': {
        const range = String(value).split(',').map(v => v.trim()).filter(Boolean);
        if (range.length === 2) {
          condition = `${effectiveField} BETWEEN ? AND ?`;
          params.push(range[0], range[1]);
        }
        break;
      }
      
      // Array-based operators
      case 'in':
      case 'not_in': {
        const inValues = String(value).split(',').map(v => v.trim()).filter(v => v);
        if (inValues.length > 0) {
          const operator = filter.operator === 'in' ? 'IN' : 'NOT IN';
          condition = `${effectiveField} ${operator} (${inValues.map(() => '?').join(',')})`;
          params.push(...inValues);
        }
        break;
      }
      default:
        return;
    }

    if (condition) {
      conditions.push(condition);
    }
  });

  if (conditions.length === 0) {
    return { whereClause: '', params: [] };
  }

  return {
    whereClause: `AND ${conditions.join(' AND ')}`,
    params,
  };
};

const buildFilterClause = (filters, reportType = 'accounts') => {
  if (!filters || filters.length === 0) {
    return {
      whereClause: '', havingClause: '', whereParams: [], havingParams: [],
      productDateFilter: null, productJoinCondition: '', purchaseDateFilter: null
    };
  }

  const computedFields = ['has_products', 'product_count', 'total_products_value', 'has_product_name'];
  const fieldMapping = {
    accounts: {
      account_name: 'name',
      account_type: 'type',
      industry: 'industry',
      annual_revenue: 'revenue',
      employee_count: 'employees',
      primary_contact_first_name: 'contact_fname',
      primary_contact_last_name: 'contact_lname',
      primary_contact_email: 'contact_email',
      primary_contact_phone: 'contact_phone',
      billing_address_line1: 'billing_address',
      billing_city: 'billing_city',
      billing_state: 'billing_state',
      billing_postal_code: 'billing_zip',
      billing_country: 'billing_country',
      website: 'website_url',
      description: 'description',
      created_at: 'created_at',
      updated_at: 'updated_at',
      has_products: 'has_products',
      product_count: 'product_count',
      total_products_value: 'total_products_value',
      has_product_name: 'has_product_name',
      product_created_date: 'product_created_date',
      purchase_date: 'purchase_date'
    }
  };
  
  // Centralized definition of date fields for each report type
  const dateFields = {
    accounts: ['created_at', 'updated_at', 'product_created_date', 'purchase_date']
  };

  const whereConds = [], havingConds = [], whereParams = [], havingParams = [];
  let productJoinCondition = '', productDateFilter = null, purchaseDateFilter = null;;

  filters.forEach(filter => {
    if (!filter || !filter.field) return;

    const mappedField = fieldMapping[reportType]?.[filter.field] || filter.field;
    const op = (filter.operator || 'equals').toLowerCase();
    const rawVal = filter.value;

    // --- Special handling for Product Assignment Date ---
    if (filter.field === 'product_created_date') {
      const datePresets = ['today', 'this_week', 'this_month', 'previous_month', 'this_year', 'previous_year', 'last_7_days', 'last_30_days', 'last_90_days'];
      if (datePresets.includes(op)) {
        const dateRange = getDateRangeForPreset(op);
        if(dateRange) {
          productJoinCondition += ' AND DATE(ap.created_at) BETWEEN ? AND ?';
          productDateFilter = { 
            type: 'between', 
            start: formatDateForSQL(dateRange.start), 
            end: formatDateForSQL(dateRange.end),
            params: [formatDateForSQL(dateRange.start), formatDateForSQL(dateRange.end)]
          };
        }
      } else if (rawVal != null) {
        let operator, values;
        switch (op) {
          case 'after': operator = '>'; values = [rawVal]; break;
          case 'before': operator = '<'; values = [rawVal]; break;
          case 'equals': operator = '='; values = [rawVal]; break;
          case 'between':
            const range = String(rawVal).split(',').map(v => v.trim()).filter(Boolean);
            if (range.length === 2) {
              operator = 'BETWEEN ? AND'; values = range;
            }
            break;
        }
        if(operator && values) {
          if (operator === 'BETWEEN ? AND') {
            productJoinCondition += ` AND DATE(ap.created_at) BETWEEN ? AND ?`;
            productDateFilter = { type: 'between', start: values[0], end: values[1], params: values };
          } else {
            productJoinCondition += ` AND DATE(ap.created_at) ${operator} ?`;
            productDateFilter = { type: op, value: values[0], params: values };
          }
        }
      }
      return;
    }

    // --- Special handling for Purchase Date ---
    if (filter.field === 'purchase_date') {
      const datePresets = ['today', 'this_week', 'this_month', 'previous_month', 'this_year', 'previous_year', 'last_7_days', 'last_30_days', 'last_90_days'];
      if (datePresets.includes(op)) {
        const dateRange = getDateRangeForPreset(op);
        if(dateRange) {
          // Use a separate condition for purchase date
          productJoinCondition += ' AND DATE(ap.purchase_date) BETWEEN ? AND ?';
          purchaseDateFilter = { 
            type: 'between', 
            start: formatDateForSQL(dateRange.start), 
            end: formatDateForSQL(dateRange.end),
            params: [formatDateForSQL(dateRange.start), formatDateForSQL(dateRange.end)]
          };
        }
      } else if (rawVal != null) {
        let operator, values;
        switch (op) {
          case 'after': operator = '>'; values = [rawVal]; break;
          case 'before': operator = '<'; values = [rawVal]; break;
          case 'equals': operator = '='; values = [rawVal]; break;
          case 'not_equals': operator = '!='; values = [rawVal]; break;
          case 'between':
            const range = String(rawVal).split(',').map(v => v.trim()).filter(Boolean);
            if (range.length === 2) {
              operator = 'BETWEEN ? AND'; values = range;
            }
            break;
        }
        if(operator && values) {
          if (operator === 'BETWEEN ? AND') {
            productJoinCondition += ` AND DATE(ap.purchase_date) BETWEEN ? AND ?`;
            purchaseDateFilter = { type: 'between', start: values[0], end: values[1], params: values };
          } else {
            productJoinCondition += ` AND DATE(ap.purchase_date) ${operator} ?`;
            purchaseDateFilter = { type: op, value: values[0], params: values };
          }
        }
      }
      return;
    }
    
    // --- Standard Field Filtering (existing logic) ---
    const isComputed = computedFields.includes(mappedField);
    const fieldRef = isComputed ? mappedField : `a.${mappedField}`;
    const isDateField = dateFields[reportType]?.includes(mappedField);
    const effectiveFieldRef = isDateField ? `DATE(${fieldRef})` : fieldRef;
    
    const datePresets = ['today', 'this_week', 'this_month', 'previous_month', 'this_year', 'previous_year', 'last_7_days', 'last_30_days', 'last_90_days'];
    if (datePresets.includes(op)) {
      const dateRange = getDateRangeForPreset(op);
      if (dateRange) {
        const cond = `DATE(${fieldRef}) BETWEEN ? AND ?`;
        const params = [formatDateForSQL(dateRange.start), formatDateForSQL(dateRange.end)];
        isComputed ? (havingConds.push(cond), havingParams.push(...params)) : (whereConds.push(cond), whereParams.push(...params));
      }
      return;
    }

    if (rawVal == null) return;
    
    let cond, paramVals = [];

    switch (op) {
      case 'contains': cond = `${fieldRef} LIKE ?`; paramVals.push(`%${rawVal}%`); break;
      case 'not_contains': cond = `${fieldRef} NOT LIKE ?`; paramVals.push(`%${rawVal}%`); break;
      case 'starts_with': cond = `${fieldRef} LIKE ?`; paramVals.push(`${rawVal}%`); break;
      case 'ends_with': cond = `${fieldRef} LIKE ?`; paramVals.push(`%${rawVal}`); break;
      case 'equals': cond = `${effectiveFieldRef} = ?`; paramVals.push(rawVal); break;
      case 'not_equals': cond = `${effectiveFieldRef} != ?`; paramVals.push(rawVal); break;
      case 'greater_than': case 'after': cond = `${effectiveFieldRef} > ?`; paramVals.push(rawVal); break;
      case 'less_than': case 'before': cond = `${effectiveFieldRef} < ?`; paramVals.push(rawVal); break;
      case 'between':
        const range = String(rawVal).split(',').map(v => v.trim()).filter(Boolean);
        if (range.length === 2) {
          cond = `${effectiveFieldRef} BETWEEN ? AND ?`; paramVals.push(...range);
        }
        break;
      case 'in': case 'not_in':
        const parts = String(rawVal).split(',').map(v => v.trim()).filter(Boolean);
        if (parts.length > 0) {
          const operator = op === 'in' ? 'IN' : 'NOT IN';
          cond = `${effectiveFieldRef} ${operator} (${parts.map(() => '?').join(',')})`;
          paramVals.push(...parts);
        }
        break;
      default: return;
    }

    if (cond) {
      isComputed ? (havingConds.push(cond), havingParams.push(...paramVals)) : (whereConds.push(cond), whereParams.push(...paramVals));
    }
  });

  return {
    whereClause: whereConds.length ? `AND ${whereConds.join(' AND ')}` : '',
    havingClause: havingConds.length ? `HAVING ${havingConds.join(' AND ')}` : '',
    whereParams, 
    havingParams, 
    productDateFilter, 
    purchaseDateFilter,
    productJoinCondition
  };
};

module.exports = {
  buildFilterWhereClause,
  buildFilterClause
};