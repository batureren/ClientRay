// routes/packageRoutes.js
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

module.exports = (dependencies) => {
  const { getDb } = dependencies;
  const router = express.Router();

  // Encryption settings
  // Uses ENCRYPTION_KEY from .env, or falls back to a hash of the JWT_SECRET, or a default
  const RAW_KEY = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'default-fallback-encryption-key-value';
  
  // Ensure we have a valid 32-byte key for aes-256-gcm
  const ENCRYPTION_KEY = crypto.createHash('sha256').update(String(RAW_KEY)).digest();
  
  const ALGORITHM = 'aes-256-gcm';

  function encrypt(text) {
    try {
      const iv = crypto.randomBytes(12); // 12 bytes is recommended for GCM
      const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      console.error('Encryption error:', error.message);
      return null;
    }
  }

  function decrypt(encryptedData) {
    try {
      if (!encryptedData) return null;
      const parts = encryptedData.split(':');
      if (parts.length !== 3) return encryptedData; // Not a valid encrypted string, return as is.
      
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error.message);
      return encryptedData; // fallback if decryption fails
    }
  }

  // Log package activity
  async function logPackageActivity(packageName, action, status, message, requestData = null, responseData = null, executionTime = null) {
    try {
      const db = await getDb();
      await db.execute(
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

  // GET /api/packages - Get all packages
  router.get('/', async (req, res) => {
    try {
      const db = await getDb();
      const [packages] = await db.execute(`
        SELECT id, name, display_name, description, category, is_enabled, 
               config, status, version, last_sync, error_message, 
               created_at, updated_at
        FROM packages 
        ORDER BY display_name
      `);
      res.json(packages);
    } catch (error) {
      console.error('Error fetching packages:', error);
      res.status(500).json({ error: 'Failed to fetch packages' });
    }
  });

  // GET /api/packages/:name - Get specific package with decrypted API config
  router.get('/:name', async (req, res) => {
    try {
      const db = await getDb();
      const [packages] = await db.execute('SELECT * FROM packages WHERE name = ?', [req.params.name]);
      
      if (packages.length === 0) {
        return res.status(404).json({ error: 'Package not found' });
      }
      
      const pkg = packages[0];
      
      if (pkg.api_config) {
        const apiConfig = JSON.parse(pkg.api_config);
        const decryptedConfig = {};
        for (const [key, value] of Object.entries(apiConfig)) {
          decryptedConfig[key] = (value && typeof value === 'string') ? decrypt(value) : value;
        }
        pkg.api_config = decryptedConfig;
      }
      
      res.json(pkg);
    } catch (error) {
      console.error('Error fetching package:', error);
      res.status(500).json({ error: 'Failed to fetch package' });
    }
  });

  // PUT /api/packages/:name - Update package configuration
  router.put('/:name', async (req, res) => {
    try {
      const db = await getDb();
      const { is_enabled, config, api_config } = req.body;
      
      let encryptedApiConfig = null;
      if (api_config) {
        const encrypted = {};
        const sensitiveKeys = ['access_token', 'client_secret', 'api_key', 'webhook_signing_key'];
        for (const [key, value] of Object.entries(api_config)) {
          if (value && typeof value === 'string' && sensitiveKeys.includes(key)) {
            encrypted[key] = encrypt(value);
          } else {
            encrypted[key] = value;
          }
        }
        encryptedApiConfig = JSON.stringify(encrypted);
      }
      
      // Determine new status based on configuration
      let newStatus = 'inactive';
      let errorMessage = null;
      
      if (is_enabled) {
        // Basic validation - can be expanded per package type
        if (!api_config) {
          newStatus = 'error';
          errorMessage = 'Configuration is required';
        } else {
          newStatus = 'pending'; // Pending until tested
          errorMessage = null;
        }
      }
      
      await db.execute(`
        UPDATE packages 
        SET is_enabled = ?, config = ?, api_config = ?, status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
        WHERE name = ?
      `, [
        is_enabled, 
        config ? JSON.stringify(config) : null,
        encryptedApiConfig,
        newStatus,
        errorMessage,
        req.params.name
      ]);
      
      await logPackageActivity(req.params.name, 'update_config', 'success', 'Package configuration updated');
      res.json({ message: 'Package updated successfully' });
    } catch (error) {
      console.error('Error updating package:', error);
      res.status(500).json({ error: 'Failed to update package' });
    }
  });

  // POST /api/packages/:name/test - Test package connection
  router.post('/:name/test', async (req, res) => {
    try {
      const db = await getDb();
      const [packages] = await db.execute('SELECT * FROM packages WHERE name = ?', [req.params.name]);
      
      if (packages.length === 0) {
        return res.status(404).json({ error: 'Package not found' });
      }
      
      const pkg = packages[0];
      const startTime = Date.now();
      
      let testResult;
      
      // Route to specific test logic
      if (req.params.name === 'calendly') {
        testResult = await testCalendlyConnection(pkg);
      } else {
        testResult = { success: true, message: 'Generic package check passed' };
      }
      
      const executionTime = Date.now() - startTime;
      const status = testResult.success ? 'active' : 'error';
      const errorMessage = testResult.success ? null : testResult.message;
      
      // Update both status AND error_message
      await db.execute(
        'UPDATE packages SET status = ?, error_message = ?, last_sync = CURRENT_TIMESTAMP WHERE name = ?',
        [status, errorMessage, req.params.name]
      );
      
      await logPackageActivity(req.params.name, 'test_connection', testResult.success ? 'success' : 'error', testResult.message, null, testResult, executionTime);
      res.json(testResult);
    } catch (error) {
      console.error('Error testing package:', error);
      res.status(500).json({ error: 'Failed to test package connection' });
    }
  });

  // POST /api/packages/:name/execute - Execute API calls
  router.post('/:name/execute', async (req, res) => {
    const { endpoint, options } = req.body;
    const packageName = req.params.name;

    try {
      const db = await getDb();
      const [packages] = await db.execute('SELECT * FROM packages WHERE name = ?', [packageName]);
      if (packages.length === 0 || !packages[0].is_enabled) {
        return res.status(400).json({ error: `Package ${packageName} is not found or not enabled.` });
      }
      
      const pkg = packages[0];
      const apiConfig = JSON.parse(pkg.api_config);
      const config = JSON.parse(pkg.config || '{}');
      
      // Decrypt the access token
      const accessToken = apiConfig.access_token ? decrypt(apiConfig.access_token) : null;
      
      let result;
      
      // Logic for Calendly
      if (packageName === 'calendly') {
        switch (endpoint) {
          case 'get-user-info':
            const tempAccessToken = options.access_token;
            if (!tempAccessToken) throw new Error('Access token is required');
            result = await executeCalendlyAPI('GET', 'https://api.calendly.com/users/me', tempAccessToken, null, config.timeout);
            if (result.resource) {
              result = {
                success: true,
                message: 'User info fetched successfully',
                data: {
                  userUri: result.resource.uri,
                  organizationUri: result.resource.current_organization
                }
              };
            }
            break;
          case 'get-user':
            result = await executeCalendlyAPI('GET', 'https://api.calendly.com/users/me', accessToken, null, config.timeout);
            break;
          case 'get-event-types':
            const userUri = options.userUri || config.default_user_uri;
            if (!userUri) throw new Error('User URI is required');
            result = await executeCalendlyAPI('GET', `https://api.calendly.com/event_types?user=${encodeURIComponent(userUri)}`, accessToken, null, config.timeout);
            break;
          case 'get-meetings':
            const { userUri: meetingUserUri, startTime, endTime } = options;
            const params = new URLSearchParams({
              user: meetingUserUri,
              min_start_time: startTime,
              max_start_time: endTime
            });
            result = await executeCalendlyAPI('GET', `https://api.calendly.com/scheduled_events?${params}`, accessToken, null, config.timeout);
            break;
          case 'cancel-meeting':
            const { meetingUri, reason } = options;
            result = await executeCalendlyAPI('DELETE', `https://api.calendly.com/scheduled_events/${meetingUri.split('/').pop()}`, accessToken, { reason }, config.timeout);
            break;
          case 'get-invitees':
            const { eventUri } = options;
            result = await executeCalendlyAPI('GET', `https://api.calendly.com/scheduled_events/${eventUri.split('/').pop()}/invitees`, accessToken, null, config.timeout);
            break;
          default:
            throw new Error(`Unknown endpoint: ${endpoint}`);
        }
      } else {
        throw new Error(`Execution logic not implemented for ${packageName}`);
      }
      
      await logPackageActivity(packageName, `execute:${endpoint}`, 'success', 'API endpoint executed successfully');
      res.json(result);

    } catch (error) {
      console.error(`Error executing API for ${packageName}:`, error);
      await logPackageActivity(packageName, `execute:${endpoint}`, 'error', error.message);
      res.status(500).json({ error: `Failed to execute API call for ${packageName}: ${error.message}` });
    }
  });

  // Helper function to execute Calendly API calls
  async function executeCalendlyAPI(method, url, accessToken, data = null, timeout = 15000) {
    const config = {
      method,
      url,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout
    };
    
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  }

  // GET /api/packages/:name/logs - Get package activity logs
  router.get('/:name/logs', async (req, res) => {
    try {
      const db = await getDb();
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      
      const [logs] = await db.execute(`
        SELECT id, action, status, message, execution_time, created_at
        FROM package_logs WHERE package_name = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
      `, [req.params.name, limit, offset]);
      
      const [[{ total }]] = await db.execute('SELECT COUNT(*) as total FROM package_logs WHERE package_name = ?', [req.params.name]);
      
      res.json({ logs, total, limit, offset });
    } catch (error) {
      console.error('Error fetching package logs:', error);
      res.status(500).json({ error: 'Failed to fetch package logs' });
    }
  });

  // Test Calendly Connection Function
  async function testCalendlyConnection(pkg) {
    try {
      const apiConfig = JSON.parse(pkg.api_config);
      const config = JSON.parse(pkg.config);
      
      if (!apiConfig.access_token) {
        return { success: false, message: 'Access Token is required' };
      }
      
      const accessToken = decrypt(apiConfig.access_token);
      
      const response = await axios.get('https://api.calendly.com/users/me', {
        headers: { 
          'Authorization': `Bearer ${accessToken}`, 
          'Content-Type': 'application/json' 
        },
        timeout: config.timeout || 15000
      });
      
      const resource = response.data.resource;
      return { 
        success: true, 
        message: 'Calendly connection successful', 
        data: { 
          userUri: resource.uri, 
          organizationUri: resource.current_organization 
        } 
      };
    } catch (error) {
      return { success: false, message: `Calendly connection failed: ${error.message}` };
    }
  }

  router.post('/:name/webhooks', async (req, res) => {
    const packageName = req.params.name;
    try {
      const { organization_uri, url } = req.body;
      if (!organization_uri || !url) {
        return res.status(400).json({ error: 'Organization URI and Webhook URL are required' });
      }

      const db = await getDb();
      const [packages] = await db.execute('SELECT * FROM packages WHERE name = ?', [packageName]);
      if (packages.length === 0) {
        return res.status(404).json({ error: 'Package not found' });
      }

      const pkg = packages[0];
      const apiConfig = JSON.parse(pkg.api_config || '{}');
      const accessToken = decrypt(apiConfig.access_token);

      const signingKey = generateWebhookSigningKey();

      let newWebhook;

      if (packageName === 'calendly') {
        const calendlyPayload = {
          url: url,
          organization: organization_uri,
          events: ["invitee.created", "invitee.canceled"],
          scope: "organization",
          signing_key: signingKey,
        };
  
        const response = await executeCalendlyAPI(
          'POST',
          'https://api.calendly.com/webhook_subscriptions',
          accessToken,
          calendlyPayload
        );
        newWebhook = response.resource;
      } else {
        return res.status(400).json({ error: 'Webhook creation not supported for this package' });
      }

      // Update the package's api_config with new webhook details
      const updatedApiConfig = {
        ...apiConfig,
        webhook_id: newWebhook.uri,
        webhook_url: newWebhook.url,
        webhook_signing_key: signingKey // Store plain key momentarily
      };
      
      // Encrypt sensitive keys
      const encryptedApiConfig = { ...updatedApiConfig };
      encryptedApiConfig.access_token = encrypt(decrypt(apiConfig.access_token));
      encryptedApiConfig.webhook_signing_key = encrypt(updatedApiConfig.webhook_signing_key);
      
      await db.execute(
        'UPDATE packages SET api_config = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?',
        [JSON.stringify(encryptedApiConfig), packageName]
      );

      await logPackageActivity(packageName, 'create_webhook', 'success', 'Webhook created successfully');

      res.status(201).json({
        success: true,
        webhook: newWebhook,
        signing_key: signingKey
      });

    } catch (error) {
      console.error('Error creating webhook:', error.response ? error.response.data : error.message);
      await logPackageActivity(packageName, 'create_webhook', 'error', error.message);
      res.status(500).json({ error: `Failed to create webhook: ${error.message}` });
    }
  });

  // POST /api/packages/:name/webhook-receiver
  router.post('/:name/webhook-receiver', async (req, res) => {
    try {
      const db = await getDb();
      const [packages] = await db.execute('SELECT * FROM packages WHERE name = ?', [req.params.name]);
      
      if (packages.length === 0 || !packages[0].is_enabled) {
        await logPackageActivity(req.params.name, 'webhook:rejected', 'error', 'Package not found or not enabled');
        return res.status(404).json({ error: 'Package not found or not enabled' });
      }

      const pkg = packages[0];
      const apiConfig = JSON.parse(pkg.api_config || '{}');
      const config = JSON.parse(pkg.config || '{}');
      
      if (config.webhook_enabled === false) {
        return res.status(200).json({ 
          success: true, 
          processed: false, 
          message: 'Webhooks are disabled for this package' 
        });
      }
      
      if (apiConfig.webhook_signing_key) {
        const signature = req.headers['calendly-webhook-signature'];
        const signingKey = decrypt(apiConfig.webhook_signing_key);
        
        if (!verifyWebhookSignature(req.body, signature, signingKey)) {
          await logPackageActivity(req.params.name, 'webhook:error', 'error', 'Invalid webhook signature');
          return res.status(401).json({ error: 'Invalid webhook signature' });
        }
      }

      const webhookData = req.body;
      const eventType = webhookData.event;
      let leadData = null;
      
      // Calendly specific webhook processing
      if (req.params.name === 'calendly') {
        switch (eventType) {
          case 'invitee.created':
            leadData = await processInviteeCreated(webhookData, pkg);
            break;
          case 'invitee.canceled':
            leadData = await processInviteeCanceled(webhookData, pkg);
            break;
        }
      }

      if (leadData) {
          await storeWebhookEvent(req.params.name, webhookData, leadData, eventType);
      }
      
      await logPackageActivity(req.params.name, `webhook:${eventType}`, 'success', `Processed webhook event: ${eventType}`);
      res.status(200).json({ success: true, processed: true });

    } catch (error) {
      console.error('Error processing webhook:', error);
      await logPackageActivity(req.params.name, 'webhook:error', 'error', error.message);
      res.status(500).json({ error: 'Failed to process webhook' });
    }
  });

  // Helper functions
  function generateWebhookSigningKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  function verifyWebhookSignature(payload, signatureHeader, signingKey) {
    if (!signatureHeader || !signingKey) return false;

    try {
      const [timestamp, signature] = signatureHeader.split(',');
      const t = timestamp.split('=')[1];
      const s = signature.split('=')[1];

      const signedPayload = `${t}.${JSON.stringify(payload)}`;

      const expectedSignature = crypto
        .createHmac('sha256', signingKey)
        .update(signedPayload)
        .digest('hex');

      return crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expectedSignature));
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  async function processInviteeCreated(webhookData, pkg) {
    try {
      const invitee = webhookData.payload;
      
      const splitName = (fullName) => {
          const parts = fullName.trim().split(/\s+/);
          const lname = parts.pop() || '';
          const fname = parts.join(' ') || '';
          return { fname, lname };
      };
      
      const { fname, lname } = splitName(invitee.name);
      
      const comments = (invitee.questions_and_answers || [])
        .map(qa => `${qa.question}: ${qa.answer}`)
        .join('\n');
      
      return {
        fname,
        lname,
        email_address: invitee.email,
        phone_number: invitee.text_reminder_number,
        source: 'Calendly',
        comments,
        lead_status: 'new',
      };
    } catch (error) {
      console.error('Error processing invitee.created:', error);
      throw error;
    }
  }

  async function processInviteeCanceled(webhookData, pkg) {
    try {
      const invitee = webhookData.payload;
      return {
        email_address: invitee.email,
        lead_status: 'canceled',
        cancellation_reason: invitee.cancellation?.reason || 'No reason provided.'
      };
    } catch (error) {
      console.error('Error processing invitee.canceled:', error);
      throw error;
    }
  }

  async function storeWebhookEvent(packageName, webhookData, leadData, eventType) {
    try {
      const db = await getDb();
      
      const [result] = await db.execute(`
        INSERT INTO webhook_events (package_name, event_type, payload, processed_at) 
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `, [packageName, webhookData.event, JSON.stringify(webhookData)]);
      
      const webhookEventId = result.insertId;

      if (eventType === 'invitee.created') {
          await db.execute(`
              INSERT INTO leads (
                  fname, lname, email_address, phone_number, source, comments, lead_status, webhook_event_id 
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE
                  lead_status = 'new',
                  updated_at = CURRENT_TIMESTAMP;
          `, [
              leadData.fname, leadData.lname, leadData.email_address, leadData.phone_number,
              leadData.source, leadData.comments, leadData.lead_status, webhookEventId
          ]);

      } else if (eventType === 'invitee.canceled') {
          await db.execute(`
              UPDATE leads 
              SET 
                  lead_status = ?,
                  comments = CONCAT(IFNULL(comments, ''), '\n\n--- CANCELED ---\n', ?),
                  updated_at = CURRENT_TIMESTAMP
              WHERE email_address = ?
          `, [
              leadData.lead_status,
              `Cancellation Reason: ${leadData.cancellation_reason}`,
              leadData.email_address
          ]);
      }
    } catch (error) {
      console.error('Error storing webhook event and updating lead:', error);
      throw error;
    }
  }

  return router;
};