// utils/helpers.js
const { getDb } = require('../server');

// Field mapping for leads (remote field -> local field)
const leadFieldMapping = {
  first_name: 'fname',
  last_name: 'lname',
  email: 'email_address',
  phone: 'phone_number',
  company: 'company_name',
  address_line1: 'address',
  city: 'city',
  state: 'state',
  postal_code: 'zip_code',
  country: 'country',
  website: 'website_url',
  lead_source: 'source',
  notes: 'comments',
  status: 'lead_status'
};

// Map lead from remote database fields to local field names
function mapLeadFromRemote(lead) {
  return {
    id: lead.id,
    first_name: lead.fname,
    last_name: lead.lname,
    email: lead.email_address,
    phone: lead.phone_number,
    company: lead.company_name,
    address_line1: lead.address,
    city: lead.city,
    state: lead.state,
    postal_code: lead.zip_code,
    country: lead.country,
    website: lead.website_url,
    lead_source: lead.source,
    notes: lead.comments,
    status: lead.lead_status,
    created_at: lead.created_at,
    updated_at: lead.updated_at
  };
}

// Map account from remote database fields to local field names
function mapAccountFromRemote(account) {
  return {
    id: account.id,
    account_name: account.name,
    account_type: account.type,
    industry: account.industry,
    annual_revenue: account.revenue,
    employee_count: account.employees,
    company_name: account.company_name,
    primary_contact_first_name: account.contact_fname,
    primary_contact_last_name: account.contact_lname,
    primary_contact_email: account.contact_email,
    primary_contact_phone: account.contact_phone,
    billing_address_line1: account.billing_address,
    billing_city: account.billing_city,
    billing_state: account.billing_state,
    billing_postal_code: account.billing_zip,
    billing_country: account.billing_country,
    website: account.website_url,
    description: account.description,
    created_at: account.created_at,
    updated_at: account.updated_at
  };
}

// Map product from remote database fields to local field names
function mapProductFromRemote(product) {
  return {
    id: product.id,
    product_code: product.sku,
    product_name: product.name,
    product_category: product.category,
    list_price: product.price,
    cost_price: product.cost,
    currency: product.currency,
    description: product.description,
    specifications: product.specs,
    is_active: product.active,
    stock_quantity: product.stock,
    reorder_point: product.reorder_point,
    created_at: product.created_at,
    updated_at: product.updated_at
  };
}

// Log lead history
async function logLeadHistory(leadId, userId, userName, actionType, fieldName, oldValue, newValue, description) {
  try {
    const db = await getDb();
    await db.execute(`
      INSERT INTO lead_history (
        lead_id, user_id, user_name, action_type, 
        field_name, old_value, new_value, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      leadId, userId, userName, actionType, 
      fieldName, oldValue, newValue, description
    ]);
  } catch (error) {
    console.error('Error logging lead history:', error);
  }
}

// Generate description for lead and account history
/**
 * Generates a translated description for a history log entry.
 * @param {Function} t - The i18next translation function for the target language.
 * @param {string} actionType - The type of action (e.g., 'created', 'updated').
 * @param {object} options - An object with placeholder values.
 * @param {string} options.userName - The name of the user who performed the action.
 * @param {string} [options.fieldName] - The name of the field that was changed.
 * @param {string} [options.oldValue] - The old value of the field.
 * @param {string} [options.newValue] - The new value of the field.
 * @returns {string} The translated description string.
 */
const generateDescription = (t, actionType, options) => {
  const { userName, fieldName, oldValue, newValue } = options;

  try {
    // Translate the field name itself using keys from the 'profile.fields' section
    const translatedFieldName = fieldName 
      ? t(`profile.fields.${fieldName}`, { defaultValue: fieldName.replace(/_/g, ' ') }) 
      : '';
    
    const tOptions = {
      userName,
      fieldName: translatedFieldName,
      oldValue,
      newValue,
    };
    
    const translationKey = `history.${actionType}`;
    const translation = t(translationKey, tOptions);
    
    // Debug logging
    console.log('Translation Debug:', {
      actionType,
      translationKey,
      language: t.lng || 'unknown',
      options: tOptions,
      translation,
      isKeyReturned: translation === translationKey
    });
    
    if (translation === translationKey) {
      console.warn(`Translation key '${translationKey}' not found for language '${t.lng || 'unknown'}'`);
      return `${userName} performed action: ${actionType}`;
    }
    
    return translation;
    
  } catch (error) {
    console.error('Translation error:', error);
    return `${userName} performed action: ${actionType}`;
  }
};

module.exports = {
  leadFieldMapping,
  mapLeadFromRemote,
  mapAccountFromRemote,
  mapProductFromRemote,
  logLeadHistory,
  generateDescription
};