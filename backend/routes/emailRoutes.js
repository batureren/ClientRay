// routes/emailRoutes.js
const express = require("express");
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

module.exports = (dependencies) => {
  const { 
    getDb, 
    authenticateToken, 
    buildFilterWhereClause, 
    buildFilterClause,
    emailService
  } = dependencies;

  const router = express.Router();
  const storage = multer.memoryStorage();
  const upload = multer({ storage: storage });
  const UPLOADS_DIR = path.join(process.cwd(), 'uploads/email_images');

  const checkEmailService = (req, res, next) => {
    if (!emailService) {
      return res.status(503).json({ success: false, error: "Email service is not available." });
    }
    next();
  };

  router.get("/campaigns", async (req, res) => {
    try {
      const db = await getDb();
      const [campaigns] = await db.execute(`SELECT c.*, COUNT(l.id) as total_logs, SUM(CASE WHEN l.status = 'sent' THEN 1 ELSE 0 END) as sent_count FROM email_campaigns c LEFT JOIN email_logs l ON c.id = l.campaign_id GROUP BY c.id ORDER BY c.created_at DESC`);
      res.json({ success: true, data: campaigns });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to fetch campaigns", details: error.message });
    }
  });

  router.get("/campaigns/:id", async (req, res) => {
    try {
      const db = await getDb();
      const [campaigns] = await db.execute(`SELECT * FROM email_campaigns WHERE id = ?`, [req.params.id]);
      if (campaigns.length === 0) return res.status(404).json({ success: false, error: "Campaign not found" });
      res.json({ success: true, data: campaigns[0] });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to fetch campaign", details: error.message });
    }
  });

  router.post("/campaigns", async (req, res) => {
    try {
      const db = await getDb();
      const { name, subject, content, template_id, recipient_type, recipient_filter, scheduled_at } = req.body;
      if (!name || !subject || !content || !recipient_type) return res.status(400).json({ success: false, error: "Name, subject, content, and recipient_type are required" });
      const [result] = await db.execute(`INSERT INTO email_campaigns (name, subject, content, template_id, recipient_type, recipient_filter, scheduled_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, [name, subject, content, template_id, recipient_type, JSON.stringify(recipient_filter || {}), scheduled_at]);
      res.status(201).json({ success: true, data: { id: result.insertId, ...req.body } });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to create campaign", details: error.message });
    }
  });

  router.put("/campaigns/:id", async (req, res) => {
    try {
      const db = await getDb();
      const { name, subject, content, template_id, recipient_type, recipient_filter, scheduled_at, status } = req.body;
      await db.execute(`UPDATE email_campaigns SET name = ?, subject = ?, content = ?, template_id = ?, recipient_type = ?, recipient_filter = ?, scheduled_at = ?, status = ? WHERE id = ?`, [name, subject, content, template_id, recipient_type, JSON.stringify(recipient_filter || {}), scheduled_at, status, req.params.id]);
      res.json({ success: true, message: "Campaign updated" });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to update campaign", details: error.message });
    }
  });

  router.delete("/campaigns/:id", async (req, res) => {
    try {
      const db = await getDb();
      await db.execute(`DELETE FROM email_logs WHERE campaign_id = ?`, [req.params.id]);
      await db.execute(`DELETE FROM email_campaigns WHERE id = ?`, [req.params.id]);
      res.json({ success: true, message: "Campaign deleted" });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to delete campaign", details: error.message });
    }
  });
  
  router.post("/campaigns/:id/send", checkEmailService, async (req, res) => {
    const { id } = req.params;
    
    try {
      const db = await getDb();
      const [campaigns] = await db.execute("SELECT * FROM email_campaigns WHERE id = ?", [id]);
      
      if (campaigns.length === 0) {
        return res.status(404).json({ success: false, error: "Campaign not found" });
      }
      
      const campaign = campaigns[0];
      
      if (campaign.status !== "draft") {
        return res.status(400).json({ success: false, error: `Campaign status is not draft.` });
      }
      
      const recipientFilter = JSON.parse(campaign.recipient_filter || "{}");
      let recipients = [];
      
      if (campaign.recipient_type === "leads") {
        const { whereClause, params } = buildFilterWhereClause(recipientFilter, "leads");
        const [rows] = await db.execute(
          `SELECT id, fname as first_name, lname as last_name, email_address as email, company_name as company 
           FROM leads 
           WHERE email_address IS NOT NULL AND email_address != '' ${whereClause}`, 
          params
        );
        recipients = rows;
      } else if (campaign.recipient_type === "accounts") {
        const { whereClause, params } = buildFilterClause(recipientFilter, "accounts");
        const [rows] = await db.execute(
          `SELECT id, contact_fname as first_name, contact_lname as last_name, contact_email as email, name as company 
           FROM accounts 
           WHERE contact_email IS NOT NULL AND contact_email != '' ${whereClause}`, 
          params
        );
        recipients = rows;
      }

      if (recipients.length === 0) {
        return res.status(400).json({ success: false, error: "No valid recipients found." });
      }

      // Update status to sending
      await db.execute("UPDATE email_campaigns SET status = 'sending' WHERE id = ?", [id]);
      
      // Check if queue is available
      const queueAvailable = emailService.queueAvailable && emailService.emailQueue;
      
      if (queueAvailable) {
        // Use queue if available
        const result = await emailService.sendBulkCampaign(id, recipients, campaign);
        res.json({ 
          success: true, 
          message: `Campaign queued for ${recipients.length} recipients.`,
          queueUsed: true,
          jobId: result.jobId
        });
      } else {
        // Send response immediately
        res.json({ 
          success: true, 
          message: `Campaign processing started for ${recipients.length} recipients.`,
          queueUsed: false
        });
        
        // Process in background without blocking response
        setImmediate(async () => {
          try {
            await sendCampaignSequential(id, campaign, recipients, getDb, emailService);
            console.log(`✅ Campaign ${id} completed successfully`);
          } catch (error) {
            console.error('Background campaign sending error:', error);
            try {
              const dbConnection = await getDb();
              await dbConnection.execute("UPDATE email_campaigns SET status = 'failed' WHERE id = ?", [id]);
            } catch (dbError) {
              console.error('Failed to update campaign status:', dbError);
            }
          }
        });
      }
      
    } catch (error) {
      console.error('Campaign send error:', error);
      res.status(500).json({ 
        success: false, 
        error: "Campaign send failed", 
        details: error.message 
      });
    }
  });

  async function sendCampaignSequential(campaignId, campaign, recipients, getDbFunction, emailServiceInstance) {
    let sentCount = 0, failedCount = 0;
    const db = await getDbFunction();
    
    console.log(`📧 Starting sequential send for campaign ${campaignId} with ${recipients.length} recipients`);
    
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      
      try {
        // Rate limiting delay (1 second between emails for safety)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        const emailContent = replaceTemplateVariables(campaign.content, recipient, campaignId, recipient.id);
        const emailSubject = replaceTemplateVariables(campaign.subject, recipient);
        
        const result = await emailServiceInstance.sendSingleEmail({ 
          to: recipient.email, 
          subject: emailSubject, 
          html: emailContent, 
          campaignId: campaignId, 
          recipientId: recipient.id 
        });
        
        await db.execute(
          `INSERT INTO email_logs (campaign_id, recipient_id, recipient_type, recipient_email, subject, status, sent_at) 
           VALUES (?, ?, ?, ?, ?, 'sent', NOW())`, 
          [campaignId, recipient.id, campaign.recipient_type.slice(0, -1), recipient.email, emailSubject]
        );
        
        sentCount++;
        console.log(`✅ Sent ${sentCount}/${recipients.length} to ${recipient.email}`);
        
      } catch (emailError) {
        console.error(`❌ Failed to send to ${recipient.email}:`, emailError.message);
        
        await db.execute(
          `INSERT INTO email_logs (campaign_id, recipient_id, recipient_type, recipient_email, subject, status, error_message) 
           VALUES (?, ?, ?, ?, ?, 'failed', ?)`, 
          [campaignId, recipient.id, campaign.recipient_type.slice(0, -1), recipient.email, campaign.subject, emailError.message]
        ).catch(e => console.error('Error logging failed send:', e));
        
        failedCount++;
      }
    }
    
    const finalStatus = failedCount === recipients.length ? "failed" : "completed";
    await db.execute(
      `UPDATE email_campaigns SET status = ?, sent_count = ? WHERE id = ?`, 
      [finalStatus, sentCount, campaignId]
    );
    
    console.log(`📊 Campaign ${campaignId} finished: ${sentCount} sent, ${failedCount} failed`);
  }

  function replaceTemplateVariables(content, recipient, campaignId, recipientId) {
    if (!content || !recipient) return content;
    
    let finalContent = content;
    
    // Add tracking pixel if campaignId and recipientId are provided
    if (campaignId && recipientId) {
      const trackingPixelUrl = `${process.env.APP_URL || 'http://localhost:3000'}/api/email/track/open/${campaignId}/${recipientId}.gif`;
      const pixel = `<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;" />`;
      finalContent = content.includes('</body>') ? content.replace('</body>', `${pixel}</body>`) : content + pixel;
    }
    
    return finalContent
      .replace(/\{\{first_name\}\}/g, recipient.first_name || "")
      .replace(/\{\{last_name\}\}/g, recipient.last_name || "")
      .replace(/\{\{email\}\}/g, recipient.email || "")
      .replace(/\{\{company\}\}/g, recipient.company || "")
      .replace(/\{\{full_name\}\}/g, `${recipient.first_name || ""} ${recipient.last_name || ""}`.trim())
      .replace(/\{\{unsubscribe_link\}\}/g, `<a href="${process.env.APP_URL || 'http://localhost:3000'}/unsubscribe/${encodeURIComponent(recipient.email)}">Unsubscribe</a>`);
  }

  router.get("/templates", async (req, res) => {
    try {
      const db = await getDb();
      const [templates] = await db.execute(`SELECT * FROM email_templates ORDER BY created_at DESC`);
      res.json({ success: true, data: templates });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to fetch templates" });
    }
  });

  router.post("/templates", async (req, res) => {
    try {
      const db = await getDb();
      const { name, subject, content } = req.body;
      const [result] = await db.execute(`INSERT INTO email_templates (name, subject, content) VALUES (?, ?, ?)`, [name, subject, content]);
      res.status(201).json({ success: true, data: { id: result.insertId, ...req.body } });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to create template" });
    }
  });

  router.get("/templates/:id", async (req, res) => {
    try {
      const db = await getDb();
      const [templates] = await db.execute(`SELECT * FROM email_templates WHERE id = ?`, [req.params.id]);
      res.json({ success: true, data: templates[0] });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to fetch template" });
    }
  });

  router.put("/templates/:id", async (req, res) => {
    try {
      const db = await getDb();
      const { name, subject, content } = req.body;
      await db.execute(`UPDATE email_templates SET name = ?, subject = ?, content = ? WHERE id = ?`, [name, subject, content, req.params.id]);
      res.json({ success: true, message: "Template updated" });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to update template" });
    }
  });

  router.delete("/templates/:id", async (req, res) => {
    try {
      const db = await getDb();
      await db.execute(`DELETE FROM email_templates WHERE id = ?`, [req.params.id]);
      res.json({ success: true, message: "Template deleted" });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to delete template" });
    }
  });
  
  router.get("/track/open/:campaignId/:recipientId.gif", async (req, res) => {
    try {
      const { campaignId, recipientId } = req.params;
      const db = await getDb();
      await db.execute(`UPDATE email_logs SET status = 'opened', opened_at = NOW() WHERE campaign_id = ? AND recipient_id = ? AND status != 'opened'`, [campaignId, recipientId]);
    } catch (error) { /* Fail silently */ }
    const pixel = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
    res.type("image/gif").set("Cache-Control", "no-store").send(pixel);
  });

  router.get("/track/click/:campaignId/:recipientId", async (req, res) => {
    try {
      const { campaignId, recipientId } = req.params;
      const { url } = req.query;
      if (!url) return res.status(400).send("Missing URL");
      const db = await getDb();
      await db.execute(`UPDATE email_logs SET status = 'clicked', clicked_at = NOW() WHERE campaign_id = ? AND recipient_id = ?`, [campaignId, recipientId]);
      res.redirect(decodeURIComponent(url));
    } catch (error) {
      res.redirect(req.query.url || "/");
    }
  });

  const ensureUploadsDirExists = async () => {
    try { await fs.access(UPLOADS_DIR); } catch { await fs.mkdir(UPLOADS_DIR, { recursive: true }); }
  };

  router.post('/images', authenticateToken, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    try {
      await ensureUploadsDirExists();
      const uniqueFilename = `${Date.now()}_${req.file.originalname.replace(/[^a-z0-9.]/gi, '_')}`;
      const filePath = path.join(UPLOADS_DIR, uniqueFilename);
      await fs.writeFile(filePath, req.file.buffer);
      const publicUrl = `${req.protocol}://${req.get('host')}/uploads/email_images/${uniqueFilename}`;
      res.json({ link: publicUrl });
    } catch (error) {
      res.status(500).json({ error: 'Failed to upload image' });
    }
  });

  router.get('/images', authenticateToken, async (req, res) => {
    try {
      await ensureUploadsDirExists();
      const files = await fs.readdir(UPLOADS_DIR);
      const imageList = files.filter(f => /\.(jpe?g|png|gif)$/i.test(f)).map(f => ({ url: `${req.protocol}://${req.get('host')}/uploads/email_images/${f}` }));
      res.json(imageList);
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve images' });
    }
  });

  router.delete('/images/:filename', authenticateToken, async (req, res) => {
    try {
      const filename = req.params.filename;
      if (filename.includes('..')) return res.status(400).send({ error: 'Invalid filename' });
      const filePath = path.join(UPLOADS_DIR, filename);
      await fs.unlink(filePath);
      res.status(200).send({ message: 'File deleted' });
    } catch (error) {
      res.status(error.code === 'ENOENT' ? 404 : 500).send({ error: 'Could not delete file' });
    }
  });

  return router;
};