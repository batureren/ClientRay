// utils/packageService.js
const axios = require('axios');
const crypto = require('crypto');

const ENCRYPTION_KEY = crypto.randomBytes(32);
const ALGORITHM = 'aes-256-gcm';

function decrypt(encryptedData) {
  try {
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return encryptedData;
  }
}

class PackageService {
  constructor(db) {
    this.db = db;
    this.enabledPackages = new Map();
    this.loadEnabledPackages();
    
    // Refresh enabled packages every 5 minutes
    setInterval(() => this.loadEnabledPackages(), 5 * 60 * 1000);
  }

  async loadEnabledPackages() {
    try {
      const [packages] = await this.db.execute(`
        SELECT name, display_name, config, api_config, status
        FROM packages 
        WHERE is_enabled = true AND status = 'active'
      `);
      
      this.enabledPackages.clear();
      
      for (const pkg of packages) {
        const config = JSON.parse(pkg.config || '{}');
        const apiConfig = JSON.parse(pkg.api_config || '{}');
        
        // Decrypt API config
        const decryptedApiConfig = {};
        for (const [key, value] of Object.entries(apiConfig)) {
          if (value && typeof value === 'string' && value.includes(':')) {
            decryptedApiConfig[key] = decrypt(value);
          } else {
            decryptedApiConfig[key] = value;
          }
        }
        
        this.enabledPackages.set(pkg.name, {
          displayName: pkg.display_name,
          config,
          apiConfig: decryptedApiConfig,
          status: pkg.status
        });
      }
      
      console.log(`Loaded ${this.enabledPackages.size} enabled packages`);
    } catch (error) {
      console.error('Error loading enabled packages:', error);
    }
  }

  isEnabled(packageName) {
    return this.enabledPackages.has(packageName);
  }

  getPackage(packageName) {
    return this.enabledPackages.get(packageName);
  }

  async logActivity(packageName, action, status, message, requestData = null, responseData = null, executionTime = null) {
    try {
      await this.db.execute(
        `INSERT INTO package_logs (package_name, action, status, message, request_data, response_data, execution_time) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [packageName, action, status, message, 
         requestData ? JSON.stringify(requestData) : null,
         responseData ? JSON.stringify(responseData) : null,
         executionTime]
      );
    } catch (error) {
      console.error('Failed to log package activity:', error);
    }
  }

  // İYS Integration Methods
  async sendIYSMessage(recipients, message, messageType = 'BILGILENDIRME') {
    if (!this.isEnabled('iys')) {
      throw new Error('İYS package is not enabled');
    }

    const pkg = this.getPackage('iys');
    const startTime = Date.now();

    try {
      const response = await axios.post(`${pkg.apiConfig.base_url}/api/message/send`, {
        recipients,
        message,
        messageType,
        timestamp: new Date().toISOString()
      }, {
        headers: {
          'Authorization': `Bearer ${pkg.apiConfig.api_key}`,
          'Content-Type': 'application/json'
        },
        timeout: pkg.config.timeout || 30000
      });

      const executionTime = Date.now() - startTime;
      await this.logActivity('iys', 'send_message', 'success', 
        `Message sent to ${recipients.length} recipients`, 
        { recipients: recipients.length, messageType }, 
        response.data, executionTime);

      return response.data;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      await this.logActivity('iys', 'send_message', 'error', error.message, 
        { recipients: recipients.length, messageType }, null, executionTime);
      throw error;
    }
  }

  async checkIYSConsent(phoneNumber) {
    if (!this.isEnabled('iys')) {
      throw new Error('İYS package is not enabled');
    }

    const pkg = this.getPackage('iys');
    const startTime = Date.now();

    try {
      const response = await axios.get(`${pkg.apiConfig.base_url}/api/consent/check`, {
        params: { phoneNumber },
        headers: {
          'Authorization': `Bearer ${pkg.apiConfig.api_key}`
        },
        timeout: pkg.config.timeout || 30000
      });

      const executionTime = Date.now() - startTime;
      await this.logActivity('iys', 'check_consent', 'success', 
        `Consent checked for ${phoneNumber}`, 
        { phoneNumber }, response.data, executionTime);

      return response.data;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      await this.logActivity('iys', 'check_consent', 'error', error.message, 
        { phoneNumber }, null, executionTime);
      throw error;
    }
  }

  // Calendly Integration Methods
  async getCalendlyAvailability(userUri, startTime, endTime) {
    if (!this.isEnabled('calendly')) {
      throw new Error('Calendly package is not enabled');
    }

    const pkg = this.getPackage('calendly');
    const start = Date.now();

    try {
      const response = await axios.get('https://api.calendly.com/availability_windows', {
        params: {
          user: userUri,
          start_time: startTime,
          end_time: endTime
        },
        headers: {
          'Authorization': `Bearer ${pkg.apiConfig.api_key}`,
          'Content-Type': 'application/json'
        },
        timeout: pkg.config.timeout || 15000
      });

      const executionTime = Date.now() - start;
      await this.logActivity('calendly', 'get_availability', 'success', 
        'Availability retrieved', 
        { userUri, startTime, endTime }, response.data, executionTime);

      return response.data;
    } catch (error) {
      const executionTime = Date.now() - start;
      await this.logActivity('calendly', 'get_availability', 'error', error.message, 
        { userUri, startTime, endTime }, null, executionTime);
      throw error;
    }
  }

  async createCalendlyMeeting(eventTypeUri, startTime, inviteeEmail, inviteeName) {
    if (!this.isEnabled('calendly')) {
      throw new Error('Calendly package is not enabled');
    }

    const pkg = this.getPackage('calendly');
    const start = Date.now();

    try {
      const response = await axios.post('https://api.calendly.com/scheduled_events', {
        event_type: eventTypeUri,
        start_time: startTime,
        invitee: {
          email: inviteeEmail,
          name: inviteeName
        }
      }, {
        headers: {
          'Authorization': `Bearer ${pkg.apiConfig.api_key}`,
          'Content-Type': 'application/json'
        },
        timeout: pkg.config.timeout || 15000
      });

      const executionTime = Date.now() - start;
      await this.logActivity('calendly', 'create_meeting', 'success', 
        'Meeting created successfully', 
        { eventTypeUri, startTime, inviteeEmail }, response.data, executionTime);

      return response.data;
    } catch (error) {
      const executionTime = Date.now() - start;
      await this.logActivity('calendly', 'create_meeting', 'error', error.message, 
        { eventTypeUri, startTime, inviteeEmail }, null, executionTime);
      throw error;
    }
  }

  // WhatsApp Integration Methods
  async sendWhatsAppMessage(phoneNumber, message, messageType = 'text') {
    if (!this.isEnabled('whatsapp')) {
      throw new Error('WhatsApp package is not enabled');
    }

    const pkg = this.getPackage('whatsapp');
    const start = Date.now();

    try {
      const payload = {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: messageType,
        text: { body: message }
      };

      const response = await axios.post(
        `https://graph.facebook.com/v17.0/${pkg.apiConfig.phone_number_id}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${pkg.apiConfig.access_token}`,
            'Content-Type': 'application/json'
          },
          timeout: pkg.config.timeout || 20000
        }
      );

      const executionTime = Date.now() - start;
      await this.logActivity('whatsapp', 'send_message', 'success', 
        'WhatsApp message sent', 
        { phoneNumber, messageType }, response.data, executionTime);

      return response.data;
    } catch (error) {
      const executionTime = Date.now() - start;
      await this.logActivity('whatsapp', 'send_message', 'error', error.message, 
        { phoneNumber, messageType }, null, executionTime);
      throw error;
    }
  }

  async sendWhatsAppTemplate(phoneNumber, templateName, languageCode, components = []) {
    if (!this.isEnabled('whatsapp')) {
      throw new Error('WhatsApp package is not enabled');
    }

    const pkg = this.getPackage('whatsapp');
    const start = Date.now();

    try {
      const payload = {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: components
        }
      };

      const response = await axios.post(
        `https://graph.facebook.com/v17.0/${pkg.apiConfig.phone_number_id}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${pkg.apiConfig.access_token}`,
            'Content-Type': 'application/json'
          },
          timeout: pkg.config.timeout || 20000
        }
      );

      const executionTime = Date.now() - start;
      await this.logActivity('whatsapp', 'send_template', 'success', 
        'WhatsApp template sent', 
        { phoneNumber, templateName, languageCode }, response.data, executionTime);

      return response.data;
    } catch (error) {
      const executionTime = Date.now() - start;
      await this.logActivity('whatsapp', 'send_template', 'error', error.message, 
        { phoneNumber, templateName, languageCode }, null, executionTime);
      throw error;
    }
  }

  // Mailchimp Integration Methods
  async addToMailchimpList(email, firstName, lastName, tags = [], mergeFields = {}) {
    if (!this.isEnabled('mailchimp')) {
      throw new Error('Mailchimp package is not enabled');
    }

    const pkg = this.getPackage('mailchimp');
    const start = Date.now();

    try {
      const payload = {
        email_address: email,
        status: 'subscribed',
        merge_fields: {
          FNAME: firstName,
          LNAME: lastName,
          ...mergeFields
        },
        tags: tags
      };

      const response = await axios.post(
        `https://${pkg.apiConfig.server_prefix}.api.mailchimp.com/3.0/lists/${pkg.apiConfig.list_id}/members`,
        payload,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`anystring:${pkg.apiConfig.api_key}`).toString('base64')}`,
            'Content-Type': 'application/json'
          },
          timeout: pkg.config.timeout || 25000
        }
      );

      const executionTime = Date.now() - start;
      await this.logActivity('mailchimp', 'add_subscriber', 'success', 
        'Contact added to Mailchimp list', 
        { email, firstName, lastName, tags }, response.data, executionTime);

      return response.data;
    } catch (error) {
      const executionTime = Date.now() - start;
      await this.logActivity('mailchimp', 'add_subscriber', 'error', error.message, 
        { email, firstName, lastName, tags }, null, executionTime);
      throw error;
    }
  }

  async updateMailchimpSubscriber(email, updateData) {
    if (!this.isEnabled('mailchimp')) {
      throw new Error('Mailchimp package is not enabled');
    }

    const pkg = this.getPackage('mailchimp');
    const start = Date.now();

    try {
      const subscriberHash = crypto.createHash('md5').update(email.toLowerCase()).digest('hex');
      
      const response = await axios.patch(
        `https://${pkg.apiConfig.server_prefix}.api.mailchimp.com/3.0/lists/${pkg.apiConfig.list_id}/members/${subscriberHash}`,
        updateData,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`anystring:${pkg.apiConfig.api_key}`).toString('base64')}`,
            'Content-Type': 'application/json'
          },
          timeout: pkg.config.timeout || 25000
        }
      );

      const executionTime = Date.now() - start;
      await this.logActivity('mailchimp', 'update_subscriber', 'success', 
        'Mailchimp subscriber updated', 
        { email, updateData }, response.data, executionTime);

      return response.data;
    } catch (error) {
      const executionTime = Date.now() - start;
      await this.logActivity('mailchimp', 'update_subscriber', 'error', error.message, 
        { email, updateData }, null, executionTime);
      throw error;
    }
  }

  // Generic method to execute any package API call
  async executePackageCall(packageName, method, endpoint, data = null, config = {}) {
    if (!this.isEnabled(packageName)) {
      throw new Error(`${packageName} package is not enabled`);
    }

    const pkg = this.getPackage(packageName);
    const start = Date.now();

    try {
      const axiosConfig = {
        method: method.toLowerCase(),
        url: endpoint,
        timeout: pkg.config.timeout || 30000,
        ...config
      };

      if (data) {
        axiosConfig.data = data;
      }

      const response = await axios(axiosConfig);
      
      const executionTime = Date.now() - start;
      await this.logActivity(packageName, 'custom_call', 'success', 
        `Custom API call to ${endpoint}`, 
        { method, endpoint, data }, response.data, executionTime);

      return response.data;
    } catch (error) {
      const executionTime = Date.now() - start;
      await this.logActivity(packageName, 'custom_call', 'error', error.message, 
        { method, endpoint, data }, null, executionTime);
      throw error;
    }
  }

  // Get all enabled packages for frontend
  getEnabledPackages() {
    const packages = {};
    for (const [name, pkg] of this.enabledPackages) {
      packages[name] = {
        displayName: pkg.displayName,
        status: pkg.status,
        hasConfig: Object.keys(pkg.apiConfig).length > 0
      };
    }
    return packages;
  }
}

module.exports = PackageService;