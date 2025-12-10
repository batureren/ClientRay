// routes/emailServiceRouter.js
const express = require('express');

module.exports = (dependencies) => {
  const { emailService } = dependencies;

  const router = express.Router();

  const checkEmailService = (req, res, next) => {
    if (!emailService) {
      return res.status(503).json({ success: false, error: "Email service is not available." });
    }
    next();
  };

  router.get('/health', (req, res) => {
    res.json({
      success: true,
      status: emailService ? 'healthy' : 'unhealthy',
      provider: emailService?.currentProvider || 'none',
      timestamp: new Date().toISOString()
    });
  });

  router.get('/test', checkEmailService, async (req, res) => {
    try {
      const result = await emailService.testConnection();
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  router.get('/status', checkEmailService, async (req, res) => {
    try {
      const limits = emailService.getProviderLimits();
      const queueStatus = await emailService.getQueueStatus();
      const connectionTest = await emailService.testConnection();
      res.json({
        success: true,
        provider: emailService.currentProvider,
        limits,
        queueStatus,
        connectionTest,
        environmentVars: {
          EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'not set',
          GMAIL_USER: process.env.GMAIL_USER ? '✅ set' : '❌ not set',
          REDIS_HOST: process.env.REDIS_HOST ? '✅ set' : '❌ not set',
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/switch-provider', checkEmailService, async (req, res) => {
    try {
      const { provider, config } = req.body;
      if (!provider) return res.status(400).json({ success: false, message: 'Provider is required' });
      const result = await emailService.switchProvider(provider, config);
      res.json({ success: true, message: `Switched to ${provider}`, ...result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  router.post('/reinitialize', checkEmailService, async (req, res) => {
    try {
      await emailService.initializeTransporter();
      const testResult = await emailService.testConnection();
      res.json({ success: true, message: 'Email service reinitialized', connectionTest: testResult });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to reinitialize service', details: error.message });
    }
  });

  router.post('/queue/pause', checkEmailService, async (req, res) => {
    try {
      res.json(await emailService.pauseQueue());
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  router.post('/queue/resume', checkEmailService, async (req, res) => {
    try {
      res.json(await emailService.resumeQueue());
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/queue/clear', checkEmailService, async (req, res) => {
    try {
      res.json(await emailService.clearQueue());
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/queue/retry-failed', checkEmailService, async (req, res) => {
    try {
      res.json(await emailService.retryFailedJobs());
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  return router;
};