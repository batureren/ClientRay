// routes/emailService.js
const nodemailer = require('nodemailer');
const { google } = require('googleapis');

class EmailService {
  constructor(dependencies = {}) {
    this.getDb = dependencies.getDb;
    this.transporter = null;
    this.currentProvider = process.env.EMAIL_PROVIDER || 'gmail';
    this.emailQueue = null;
    this.queueAvailable = false;
    
    this.initializeQueue();
    this.initializeTransporter();
  }

  async initializeQueue() {
    try {
      let Queue;
      try {
        Queue = require('bull');
      } catch (error) {
        console.log('ℹ️  Bull queue not available - using sequential email sending');
        this.queueAvailable = false;
        return;
      }

      const redisConfig = this.getRedisConfig();
      if (!redisConfig) {
        console.log('ℹ️  Redis not configured - using sequential email sending');
        this.queueAvailable = false;
        return;
      }

      this.emailQueue = new Queue('email-queue', {
        redis: redisConfig,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 }
        }
      });

      await this.testQueueConnection();
      this.setupQueueProcessors();
      this.setupQueueEventListeners();
      this.queueAvailable = true;
      console.log('✅ Email queue initialized successfully');

    } catch (error) {
      console.log('ℹ️  Queue not available - using sequential email sending');
      this.queueAvailable = false;
      this.emailQueue = null;
    }
  }

  getRedisConfig() {
    if (process.env.REDIS_URL) {
      const url = new URL(process.env.REDIS_URL);
      return { host: url.hostname, port: parseInt(url.port) || 6379, password: url.password || undefined, db: parseInt(url.pathname?.slice(1)) || 0 };
    }
    if (process.env.REDIS_HOST) {
      return { host: process.env.REDIS_HOST, port: parseInt(process.env.REDIS_PORT) || 6379, password: process.env.REDIS_PASSWORD || undefined, db: parseInt(process.env.REDIS_DB) || 0 };
    }
    return null;
  }

  async testQueueConnection() {
    if (!this.emailQueue) return false;
    try {
      const testJob = await this.emailQueue.add('connection-test', {}, { delay: 60000 });
      await testJob.remove();
      return true;
    } catch (error) {
      throw new Error(`Queue connection test failed: ${error.message}`);
    }
  }

  setupQueueProcessors() {
    if (!this.emailQueue) return;
    this.emailQueue.process('send-email', 5, async (job) => {
      const { emailData } = job.data;
      const result = await this.sendSingleEmail(emailData);
      await job.progress(100);
      return { messageId: result.messageId, recipient: emailData.to, timestamp: new Date().toISOString() };
    });
    this.emailQueue.process('bulk-campaign', 1, async (job) => {
      const { campaignId, recipients, campaignData } = job.data;
      return await this.processBulkCampaign(campaignId, recipients, campaignData, job);
    });
  }

  setupQueueEventListeners() {
    if (!this.emailQueue) return;
    this.emailQueue.on('completed', (job, result) => console.log(`✅ Job ${job.id} completed.`));
    this.emailQueue.on('failed', (job, err) => console.error(`❌ Job ${job.id} failed:`, err.message));
  }

  async initializeTransporter() {
    try {
      await this.setupTransporter();
      console.log(`✅ Email service initialized with ${this.currentProvider}`);
    } catch (error) {
      console.error(`❌ Failed to initialize ${this.currentProvider} transporter:`, error.message);
      if (this.currentProvider === 'gmail' && process.env.GMAIL_AUTH_METHOD === 'oauth2') {
        console.log('🔄 OAuth2 failed, trying app password method...');
        process.env.GMAIL_AUTH_METHOD = 'app_password';
        try {
          await this.setupTransporter();
          console.log('✅ Fallback to Gmail app password successful');
        } catch (fallbackError) {
          console.error('❌ Fallback also failed:', fallbackError.message);
        }
      }
    }
  }

  async setupTransporter() {
    const providers = {
      gmail: () => this.createGmailTransporter(),
      smtp: () => this.createSMTPTransporter(),
      sendgrid: () => this.createSendGridTransporter(),
      aws_ses: () => this.createAWSSESTransporter(),
      mailgun: () => this.createMailgunTransporter()
    };
    if (!providers[this.currentProvider]) throw new Error(`Unsupported email provider: ${this.currentProvider}`);
    this.transporter = await providers[this.currentProvider]();
    if (!this.transporter) throw new Error(`Failed to create transporter for ${this.currentProvider}`);
  }

  async createGmailTransporter() {
    const authMethod = process.env.GMAIL_AUTH_METHOD || 'app_password';
    if (!process.env.GMAIL_USER) throw new Error('GMAIL_USER environment variable is required');
    if (authMethod === 'oauth2') {
      if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) throw new Error('Gmail OAuth2 requires: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN');
      return this.createGmailOAuth2Transporter();
    }
    if (!process.env.GMAIL_APP_PASSWORD) throw new Error('GMAIL_APP_PASSWORD is required for app password method');
    return this.createGmailAppPasswordTransporter();
  }

  createGmailAppPasswordTransporter() {
    return nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }, pool: true });
  }

  async createGmailOAuth2Transporter() {
    try {
      const oauth2Client = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET, 'https://developers.google.com/oauthplayground');
      oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
      const accessToken = await oauth2Client.getAccessToken();
      if (!accessToken?.token) throw new Error('Failed to obtain access token');
      return nodemailer.createTransport({ service: 'gmail', auth: { type: 'OAuth2', user: process.env.GMAIL_USER, clientId: process.env.GMAIL_CLIENT_ID, clientSecret: process.env.GMAIL_CLIENT_SECRET, refreshToken: process.env.GMAIL_REFRESH_TOKEN, accessToken: accessToken.token }, pool: true });
    } catch (error) {
      if (error.message.includes('invalid_grant') || error.message.includes('Token has been expired or revoked')) throw new Error('Gmail OAuth2 token has expired or been revoked.');
      throw error;
    }
  }

  createSMTPTransporter() {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) throw new Error('SMTP requires: SMTP_HOST, SMTP_USER, SMTP_PASS');
    return nodemailer.createTransport({ host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT) || 587, secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, pool: true });
  }

  createSendGridTransporter() {
    if (!process.env.SENDGRID_API_KEY) throw new Error('SENDGRID_API_KEY is required');
    return nodemailer.createTransport({ host: 'smtp.sendgrid.net', port: 587, auth: { user: 'apikey', pass: process.env.SENDGRID_API_KEY }, pool: true });
  }

  createAWSSESTransporter() {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) throw new Error('AWS SES requires: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY');
    try {
      const sesTransport = require('nodemailer-ses-transport');
      return nodemailer.createTransport(sesTransport({ accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, region: process.env.AWS_REGION || 'us-east-1' }));
    } catch (error) {
      throw new Error('AWS SES setup failed. Install "nodemailer-ses-transport"');
    }
  }

  createMailgunTransporter() {
    if (!process.env.MAILGUN_USERNAME || !process.env.MAILGUN_PASSWORD) throw new Error('Mailgun requires: MAILGUN_USERNAME, MAILGUN_PASSWORD');
    return nodemailer.createTransport({ host: 'smtp.mailgun.org', port: 587, auth: { user: process.env.MAILGUN_USERNAME, pass: process.env.MAILGUN_PASSWORD }, pool: true });
  }

  async sendSingleEmail(emailData) {
    if (!this.transporter) throw new Error('Email transporter not initialized');
    try {
      const mailOptions = { 
        from: this.getFromAddress(), 
        to: emailData.to, 
        subject: emailData.subject, 
        html: emailData.html, 
        text: emailData.text || this.htmlToText(emailData.html), 
        headers: this.getEmailHeaders(emailData) 
      };
      
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email sent to ${emailData.to} - MessageID: ${result.messageId}`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to send email to ${emailData.to}:`, error.message);
      throw error;
    }
  }

  getFromAddress() {
    const fromName = process.env.FROM_NAME || 'Your CRM';
    const fromEmail = process.env.FROM_EMAIL || process.env.GMAIL_USER;
    
    if (!fromEmail) {
      throw new Error('FROM_EMAIL or GMAIL_USER must be configured');
    }
    
    return `"${fromName}" <${fromEmail}>`;
  }

  getEmailHeaders(emailData) {
    const headers = { 'X-Mailer': 'Your CRM System' };
    if (emailData.campaignId) {
      const unsubscribeUrl = `${process.env.APP_URL || 'http://localhost:3000'}/unsubscribe/${encodeURIComponent(emailData.to)}`;
      headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
    }
    return headers;
  }

  async sendBulkCampaign(campaignId, recipients, campaignData) {
    const limits = this.getProviderLimits();
    if (recipients.length > limits.dailyLimit) {
      throw new Error(`Campaign exceeds daily limit of ${limits.dailyLimit}`);
    }
    
    if (this.queueAvailable && this.emailQueue) {
      const job = await this.emailQueue.add('bulk-campaign', { 
        campaignId, 
        recipients, 
        campaignData 
      }, { 
        attempts: 3, 
        backoff: { type: 'exponential', delay: 10000 } 
      });
      return { 
        jobId: job.id, 
        status: 'queued', 
        queueUsed: true 
      };
    }
    
    return { 
      jobId: null, 
      status: 'processing_sequential', 
      queueUsed: false 
    };
  }

  async processBulkCampaign(campaignId, recipients, campaignData, job) {
    if (!this.getDb) throw new Error("Database access function (getDb) was not provided to EmailService.");
    const db = await this.getDb();
    const limits = this.getProviderLimits();
    const results = { total: recipients.length, sent: 0, failed: 0 };
    const batchSize = Math.min(limits.batchSize, 10);
    const delayBetweenEmails = Math.ceil(1000 / limits.rateLimit) * 1.2;
    
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      if (job) {
        await job.progress(Math.floor((i / recipients.length) * 100));
      }
      
      for (let j = 0; j < batch.length; j++) {
        const recipient = batch[j];
        try {
          if (j > 0) await new Promise(resolve => setTimeout(resolve, delayBetweenEmails));
          
          const emailContent = this.replaceTemplateVariables(campaignData.content, recipient);
          const emailSubject = this.replaceTemplateVariables(campaignData.subject, recipient);
          const result = await this.sendSingleEmail({ 
            to: recipient.email, 
            subject: emailSubject, 
            html: emailContent, 
            campaignId, 
            recipientId: recipient.id, 
            recipientType: campaignData.recipient_type 
          });
          
          await db.execute(
            `INSERT INTO email_logs (campaign_id, recipient_id, recipient_type, recipient_email, subject, status, sent_at, message_id) 
             VALUES (?, ?, ?, ?, ?, 'sent', NOW(), ?)`, 
            [campaignId, recipient.id, campaignData.recipient_type.slice(0, -1), recipient.email, emailSubject, result.messageId]
          );
          results.sent++;
        } catch (error) {
          try {
            await db.execute(
              `INSERT INTO email_logs (campaign_id, recipient_id, recipient_type, recipient_email, subject, status, error_message) 
               VALUES (?, ?, ?, ?, ?, 'failed', ?)`, 
              [campaignId, recipient.id, campaignData.recipient_type.slice(0, -1), recipient.email, campaignData.subject, error.message]
            );
          } catch (logError) { 
            console.error('Error logging failed send:', logError); 
          }
          results.failed++;
        }
      }
    }
    
    const finalStatus = results.failed === results.total ? 'failed' : 'completed';
    await db.execute(
      `UPDATE email_campaigns SET status = ?, sent_count = ? WHERE id = ?`, 
      [finalStatus, results.sent, campaignId]
    );
    
    if (job) {
      await job.progress(100);
    }
    return results;
  }

  getProviderLimits() {
    const limits = {
      gmail: { dailyLimit: 500, rateLimit: 14, batchSize: 50 },
      smtp: { dailyLimit: 1000, rateLimit: 10, batchSize: 50 },
      sendgrid: { dailyLimit: 40000, rateLimit: 100, batchSize: 1000 },
      aws_ses: { dailyLimit: 200, rateLimit: 1, batchSize: 50 },
      mailgun: { dailyLimit: 10000, rateLimit: 100, batchSize: 1000 }
    };
    return limits[this.currentProvider] || limits.gmail;
  }

  async getQueueStatus() {
    if (!this.queueAvailable || !this.emailQueue) {
      return { 
        available: false, 
        message: "Queue not configured - using sequential processing" 
      };
    }
    try {
      const jobCounts = await this.emailQueue.getJobCounts();
      return { available: true, ...jobCounts };
    } catch (error) {
      return { available: false, error: error.message };
    }
  }

  async pauseQueue() {
    if (!this.emailQueue) throw new Error('Queue not available');
    await this.emailQueue.pause();
    return { success: true, message: 'Queue paused' };
  }

  async resumeQueue() {
    if (!this.emailQueue) throw new Error('Queue not available');
    await this.emailQueue.resume();
    return { success: true, message: 'Queue resumed' };
  }

  async clearQueue() {
    if (!this.emailQueue) throw new Error('Queue not available');
    await this.emailQueue.empty();
    return { success: true, message: 'Queue cleared' };
  }

  async retryFailedJobs() {
    if (!this.emailQueue) throw new Error('Queue not available');
    const failed = await this.emailQueue.getFailed();
    let retriedCount = 0;
    for (const job of failed) {
      try {
        await job.retry();
        retriedCount++;
      } catch (error) { 
        console.error(`Failed to retry job ${job.id}:`, error); 
      }
    }
    return { success: true, message: `Retried ${retriedCount} failed jobs` };
  }

  replaceTemplateVariables(content, recipient) {
    if (!content || !recipient) return content;
    return content
      .replace(/\{\{first_name\}\}/g, recipient.first_name || '')
      .replace(/\{\{last_name\}\}/g, recipient.last_name || '')
      .replace(/\{\{email\}\}/g, recipient.email || '')
      .replace(/\{\{company\}\}/g, recipient.company || '')
      .replace(/\{\{full_name\}\}/g, `${recipient.first_name || ''} ${recipient.last_name || ''}`.trim())
      .replace(/\{\{unsubscribe_link\}\}/g, `<a href="${process.env.APP_URL || 'http://localhost:3000'}/unsubscribe/${encodeURIComponent(recipient.email)}">Unsubscribe</a>`);
  }

  htmlToText(html) {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async testConnection() {
    if (!this.transporter) {
      return { 
        success: false, 
        message: 'Transporter not initialized',
        provider: this.currentProvider 
      };
    }
    try {
      await this.transporter.verify();
      return { 
        success: true, 
        message: `${this.currentProvider} connection successful`, 
        provider: this.currentProvider 
      };
    } catch (error) {
      return { 
        success: false, 
        message: error.message, 
        provider: this.currentProvider 
      };
    }
  }

  async switchProvider(newProvider, config = {}) {
    try {
      this.validateProviderConfig(newProvider);
      if (config.user) process.env.GMAIL_USER = config.user;
      if (config.password) process.env.GMAIL_APP_PASSWORD = config.password;
      this.currentProvider = newProvider;
      await this.setupTransporter();
      const testResult = await this.testConnection();
      if (!testResult.success) throw new Error(testResult.message);
      return testResult;
    } catch (error) {
      throw new Error(`Failed to switch to ${newProvider}: ${error.message}`);
    }
  }

  validateProviderConfig(provider) {
    const requiredVars = {
      gmail: ['GMAIL_USER', 'GMAIL_APP_PASSWORD'],
      sendgrid: ['SENDGRID_API_KEY', 'FROM_EMAIL'],
      aws_ses: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'FROM_EMAIL'],
      smtp: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'FROM_EMAIL'],
      mailgun: ['MAILGUN_USERNAME', 'MAILGUN_PASSWORD', 'FROM_EMAIL']
    };
    const missing = (requiredVars[provider] || []).filter(v => !process.env[v]);
    if (missing.length > 0) {
      throw new Error(`Missing environment variables for ${provider}: ${missing.join(', ')}`);
    }
  }
}

module.exports = (dependencies) => {
  return new EmailService(dependencies);
};