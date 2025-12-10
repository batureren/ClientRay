// routes/docsRoutes.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const mammoth = require('mammoth');

module.exports = (dependencies) => {
  const { getDb, authenticateToken, docsUploadDir, JWT_SECRET } = dependencies;
  const router = express.Router();

// Ensure the base upload directory exists
if (!fs.existsSync(docsUploadDir)) {
  fs.mkdirSync(docsUploadDir, { recursive: true });
}

// Multer storage: Now uses req.body to create the destination folder
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const { related_to_entity, related_to_id } = req.body;
    if (!related_to_entity || !related_to_id) {
      return cb(new Error("Entity type and ID are required to save file."), false);
    }
    const dest = path.join(docsUploadDir, `${related_to_entity}_${related_to_id}`);
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    const safeFilename = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeFilename}`);
  }
});

const upload = multer({ storage: storage });

// Helper function to check if file is DOCX
const isDocxFile = (mimeType) => {
  return mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
         mimeType === 'application/msword';
};

// ENHANCED: Get all documents with pagination, search, and entity filtering
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const { page = 1, limit = 20, search = '', entity_type = '' } = req.query;
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    let whereClause = '';
    const params = [];

    // Build where conditions
    const conditions = [];
    
    // Entity type filter
    if (entity_type && (entity_type === 'lead' || entity_type === 'account')) {
      conditions.push('d.related_to_entity = ?');
      params.push(entity_type);
    }
    
    // Search filter
    if (search.trim()) {
      conditions.push('(d.file_name LIKE ? OR a.name LIKE ? OR CONCAT(l.fname, \' \', l.lname) LIKE ?)');
      const searchTerm = `%${search.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }

    const countQuery = `
      SELECT COUNT(d.id) as total
      FROM docs d
      LEFT JOIN leads l ON d.related_to_entity = 'lead' AND d.related_to_id = l.id
      LEFT JOIN accounts a ON d.related_to_entity = 'account' AND d.related_to_id = a.id
      ${whereClause}
    `;
    const [countResult] = await db.execute(countQuery, params);
    const totalItems = countResult[0].total;

    const docsQuery = `
      SELECT 
        d.*, 
        CONCAT(u.first_name, ' ', u.last_name) as uploaded_by_name,
        COALESCE(a.name, CONCAT(l.fname, ' ', l.lname)) as related_to_name
      FROM docs d
      LEFT JOIN users u ON d.uploaded_by_id = u.id
      LEFT JOIN leads l ON d.related_to_entity = 'lead' AND d.related_to_id = l.id
      LEFT JOIN accounts a ON d.related_to_entity = 'account' AND d.related_to_id = a.id
      ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [docs] = await db.execute(docsQuery, [...params, limitNumber, offset]);

    res.json({
      data: docs,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(totalItems / limitNumber),
        total: totalItems,
        limit: limitNumber
      }
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents.' });
  }
});

router.get('/download/:doc_id', authenticateToken, async (req, res) => {
  const { doc_id } = req.params;

  try {
    const db = await getDb();
    const [rows] = await db.execute('SELECT * FROM docs WHERE id = ?', [doc_id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    const doc = rows[0];
    const absolutePath = path.join(docsUploadDir, doc.file_path);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'File not found on server.' });
    }

    const stats = fs.statSync(absolutePath);
    res.setHeader('Content-Disposition', `attachment; filename="${doc.file_name}"`);
    res.setHeader('Content-Type', doc.file_type || 'application/octet-stream');
    res.setHeader('Content-Length', stats.size);

    const fileStream = fs.createReadStream(absolutePath);
    fileStream.pipe(res);
    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error downloading file.' });
      }
    });

  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ error: 'Failed to download document.' });
  }
});

// ENHANCED: Get file for preview with DOCX support
router.get('/preview/:doc_id', async (req, res) => {
  const { doc_id } = req.params;
  const { token, format } = req.query;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }

  try {
    const db = await getDb();
    const [rows] = await db.execute('SELECT * FROM docs WHERE id = ?', [doc_id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    const doc = rows[0];
    const absolutePath = path.join(docsUploadDir, doc.file_path);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'File not found on server.' });
    }

    // Handle DOCX files with HTML conversion
    if (isDocxFile(doc.file_type) && format === 'html') {
      try {
        const buffer = fs.readFileSync(absolutePath);
        const result = await mammoth.convertToHtml({ buffer });
        
        const htmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>${doc.file_name}</title>
              <style>
                body { 
                  font-family: 'Segoe UI', Arial, sans-serif; 
                  padding: 20px; 
                  line-height: 1.6; 
                  max-width: 800px;
                  margin: 0 auto;
                  color: #333;
                }
                p { 
                  margin: 0 0 16px 0; 
                }
                h1, h2, h3, h4, h5, h6 {
                  margin: 20px 0 10px 0;
                  font-weight: 600;
                }
                h1 { font-size: 24px; }
                h2 { font-size: 20px; }
                h3 { font-size: 18px; }
                table {
                  border-collapse: collapse;
                  width: 100%;
                  margin: 16px 0;
                }
                table th, table td {
                  border: 1px solid #ddd;
                  padding: 8px;
                  text-align: left;
                }
                table th {
                  background-color: #f5f5f5;
                  font-weight: 600;
                }
                ul, ol {
                  margin: 16px 0;
                  padding-left: 40px;
                }
                li {
                  margin: 4px 0;
                }
                strong {
                  font-weight: 600;
                }
                em {
                  font-style: italic;
                }
                .docx-error {
                  background: #fee;
                  border: 1px solid #fcc;
                  padding: 10px;
                  border-radius: 4px;
                  color: #c33;
                  margin: 16px 0;
                }
              </style>
            </head>
            <body>
              ${result.value}
              ${result.messages.length > 0 ? 
                `<div class="docx-error">
                  <strong>Conversion notes:</strong><br>
                  ${result.messages.map(msg => msg.message).join('<br>')}
                </div>` : ''
              }
            </body>
          </html>
        `;
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(htmlContent);
        return;
      } catch (conversionError) {
        console.error('Error converting DOCX to HTML:', conversionError);
        // Fall back to regular file serving if conversion fails
      }
    }

    // Default file serving for non-DOCX files or when HTML format is not requested
    const stats = fs.statSync(absolutePath);
    res.setHeader('Content-Disposition', `inline; filename="${doc.file_name}"`);
    res.setHeader('Content-Type', doc.file_type || 'application/octet-stream');
    res.setHeader('Content-Length', stats.size);

    const fileStream = fs.createReadStream(absolutePath);
    fileStream.pipe(res);
    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error loading document preview.' });
      }
    });

  } catch (error) {
    console.error('Error previewing document:', error);
    res.status(500).json({ error: 'Failed to load document preview.' });
  }
});

// Upload a document via form data (unchanged)
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  const { related_to_entity, related_to_id } = req.body;
  const { file } = req;
  const userId = req.user.id;

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }
  if (!related_to_entity || !related_to_id) {
    return res.status(400).json({ error: 'You must link the document to a lead or account.' });
  }
const relativePath = path.relative(docsUploadDir, file.path).replace(/\\/g, '/');

  try {
    const db = await getDb();
    const [result] = await db.execute(
      `INSERT INTO docs (file_name, file_path, file_type, file_size, related_to_entity, related_to_id, uploaded_by_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
[file.originalname, relativePath, file.mimetype, file.size, related_to_entity, related_to_id, userId]

    );

    res.status(201).json({ id: result.insertId, message: 'File uploaded successfully' });
  } catch (error) {
    console.error('Error saving file metadata:', error);
    fs.unlink(file.path, (err) => {
      if (err) console.error('Error cleaning up orphaned file:', err);
    });
    res.status(500).json({ error: 'Failed to save file metadata.' });
  }
});

// Delete document (unchanged)
router.delete('/:doc_id', authenticateToken, async (req, res) => {
  const { doc_id } = req.params;

  try {
    const db = await getDb();
    const [rows] = await db.execute('SELECT file_path FROM docs WHERE id = ?', [doc_id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    // Normalize path (replace backslashes, make absolute)
    let filePath = rows[0].file_path.replace(/\\/g, '/');
    const absolutePath = path.join(docsUploadDir, filePath);

    // Delete file from filesystem
    fs.unlink(absolutePath, async (err) => {
      if (err) {
        console.error('Error deleting file from filesystem:', err);
        // still continue with DB delete
      }

      await db.execute('DELETE FROM docs WHERE id = ?', [doc_id]);
      res.json({ message: 'Document deleted successfully.' });
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document.' });
  }
});

// Endpoint to search for leads and accounts to link to
router.get('/search-entities', authenticateToken, async (req, res) => {
    const { search = '' } = req.query;
    if (search.length < 2) {
        return res.json([]);
    }
    const searchTerm = `%${search.trim()}%`;
    try {
        const db = await getDb();
        const [leads] = await db.execute(
            "SELECT id, CONCAT(fname, ' ', lname) as name, 'lead' as type FROM leads WHERE CONCAT(fname, ' ', lname) LIKE ? OR company_name LIKE ? LIMIT 5",
            [searchTerm, searchTerm]
        );
        const [accounts] = await db.execute(
            "SELECT id, name, 'account' as type FROM accounts WHERE name LIKE ? LIMIT 5",
            [searchTerm]
        );
        res.json([...leads, ...accounts]);
    } catch (error) {
        console.error('Error searching entities:', error);
        res.status(500).json({ error: 'Failed to search for entities' });
    }
});

router.get('/entity/:entity_type/:entity_id', authenticateToken, async (req, res) => {
  try {
    const { entity_type, entity_id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    // Validate entity type
    if (!['lead', 'account'].includes(entity_type)) {
      return res.status(400).json({ error: 'Invalid entity type. Must be "lead" or "account".' });
    }
    
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;
    
    const db = await getDb();
    
    // Count total documents for this entity
    const countQuery = `
      SELECT COUNT(d.id) as total
      FROM docs d
      WHERE d.related_to_entity = ? AND d.related_to_id = ?
    `;
    const [countResult] = await db.execute(countQuery, [entity_type, entity_id]);
    const totalItems = countResult[0].total;
    
    // Fetch documents for this entity
    const docsQuery = `
      SELECT 
        d.*, 
        CONCAT(u.first_name, ' ', u.last_name) as uploaded_by_name,
        COALESCE(a.name, CONCAT(l.fname, ' ', l.lname)) as related_to_name
      FROM docs d
      LEFT JOIN users u ON d.uploaded_by_id = u.id
      LEFT JOIN leads l ON d.related_to_entity = 'lead' AND d.related_to_id = l.id
      LEFT JOIN accounts a ON d.related_to_entity = 'account' AND d.related_to_id = a.id
      WHERE d.related_to_entity = ? AND d.related_to_id = ?
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const [docs] = await db.execute(docsQuery, [entity_type, entity_id, limitNumber, offset]);
    
    res.json({
      data: docs,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(totalItems / limitNumber),
        total: totalItems,
        limit: limitNumber
      },
      entity: {
        type: entity_type,
        id: entity_id
      }
    });
    
  } catch (error) {
    console.error('Error fetching entity documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents for entity.' });
  }
});

  return router;
};