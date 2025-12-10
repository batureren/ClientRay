const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

module.exports = (dependencies) => {
  const { getDb, authenticateToken, requireRole, companyUploadsDir } = dependencies;
  const router = express.Router();

  // Ensure upload directory exists
  const ensureUploadDir = async () => {
    try {
      await fs.mkdir(companyUploadsDir, { recursive: true });
    } catch (error) {
      console.error('Error creating upload directory:', error);
    }
  };

  // Configure multer for logo upload
  const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
      await ensureUploadDir();
      cb(null, companyUploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'company-logo-' + uniqueSuffix + path.extname(file.originalname));
    }
  });

  const upload = multer({
    storage: storage,
    limits: {
      fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|svg/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);

      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, svg)'));
      }
    }
  });

  // Helper function to map company details from database
  const mapCompanyDetailsFromRemote = (row) => ({
    id: row.id,
    company_name: row.company_name,
    address_line1: row.address_line1,
    address_line2: row.address_line2,
    city: row.city,
    state: row.state,
    zip_code: row.zip_code,
    country: row.country,
    email: row.email,
    phone: row.phone,
    website: row.website,
    logo_filename: row.logo_filename,
    logo_url: row.logo_filename ? `/uploads/company-detail/${row.logo_filename}` : null,
    tax_id: row.tax_id,
    created_at: row.created_at,
    updated_at: row.updated_at
  });

  // GET company details
  router.get('/', authenticateToken, async (req, res) => {
    try {
      const db = await getDb();
      const [rows] = await db.execute(
        'SELECT * FROM company_details ORDER BY id DESC LIMIT 1'
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Company details not found' });
      }

      const companyDetails = mapCompanyDetailsFromRemote(rows[0]);
      res.json(companyDetails);
    } catch (error) {
      console.error('Error fetching company details:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST/PUT update company details
  router.post('/', authenticateToken, requireRole('manager'), async (req, res) => {
    try {
      const {
        company_name,
        address_line1,
        address_line2,
        city,
        state,
        zip_code,
        country,
        email,
        phone,
        website,
        tax_id
      } = req.body;

      if (!company_name) {
        return res.status(400).json({ error: 'Company name is required' });
      }

      const db = await getDb();

      // Check if company details already exist
      const [existing] = await db.execute('SELECT id FROM company_details LIMIT 1');

      if (existing.length > 0) {
        // Update existing
        await db.execute(`
          UPDATE company_details 
          SET company_name = ?, address_line1 = ?, address_line2 = ?,
              city = ?, state = ?, zip_code = ?, country = ?,
              email = ?, phone = ?, website = ?, tax_id = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          company_name, address_line1, address_line2,
          city, state, zip_code, country,
          email, phone, website, tax_id,
          existing[0].id
        ]);

        const [updated] = await db.execute(
          'SELECT * FROM company_details WHERE id = ?',
          [existing[0].id]
        );

        res.json(mapCompanyDetailsFromRemote(updated[0]));
      } else {
        // Insert new
        const [result] = await db.execute(`
          INSERT INTO company_details (
            company_name, address_line1, address_line2, city, state,
            zip_code, country, email, phone, website, tax_id, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          company_name, address_line1, address_line2, city, state,
          zip_code, country, email, phone, website, tax_id,
          req.user?.userId || req.user?.id
        ]);

        const [inserted] = await db.execute(
          'SELECT * FROM company_details WHERE id = ?',
          [result.insertId]
        );

        res.status(201).json(mapCompanyDetailsFromRemote(inserted[0]));
      }
    } catch (error) {
      console.error('Error updating company details:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST upload company logo
  router.post('/logo', authenticateToken, requireRole('manager'), upload.single('logo'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const db = await getDb();

      // Get existing company details
      const [existing] = await db.execute('SELECT id, logo_filename FROM company_details LIMIT 1');

      if (existing.length === 0) {
        return res.status(404).json({ error: 'Company details not found. Please save company details first.' });
      }

      const oldLogoFilename = existing[0].logo_filename;

      // Update logo filename
      await db.execute(
        'UPDATE company_details SET logo_filename = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [req.file.filename, existing[0].id]
      );

      // Delete old logo file if it exists
      if (oldLogoFilename) {
        try {
          await fs.unlink(path.join(companyUploadsDir, oldLogoFilename));
        } catch (error) {
          console.error('Error deleting old logo:', error);
          // Continue even if deletion fails
        }
      }

      res.json({
        logo_filename: req.file.filename,
        logo_url: `/uploads/company-detail/${req.file.filename}`,
        message: 'Logo uploaded successfully'
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE logo
  router.delete('/logo', authenticateToken, requireRole('manager'), async (req, res) => {
    try {
      const db = await getDb();

      // Get existing company details
      const [existing] = await db.execute('SELECT id, logo_filename FROM company_details LIMIT 1');

      if (existing.length === 0 || !existing[0].logo_filename) {
        return res.status(404).json({ error: 'No logo found' });
      }

      const logoFilename = existing[0].logo_filename;

      // Remove logo filename from database
      await db.execute(
        'UPDATE company_details SET logo_filename = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [existing[0].id]
      );

      // Delete logo file
      try {
        await fs.unlink(path.join(companyUploadsDir, logoFilename));
      } catch (error) {
        console.error('Error deleting logo file:', error);
        // Continue even if deletion fails
      }

      res.json({ message: 'Logo deleted successfully' });
    } catch (error) {
      console.error('Error deleting logo:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};