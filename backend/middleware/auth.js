// middleware/auth.js
const jwt = require('jsonwebtoken');

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET;

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      code: 'TOKEN_REQUIRED' 
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { getDb } = require('../server');
    const db = await getDb();
    
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    const [users] = await db.execute(
      'SELECT id, username, email, first_name, last_name, language, role, profile_picture, is_active FROM users WHERE id = ? AND is_active = 1',
      [decoded.userId]
    );
    
    if (users.length === 0) {
      return res.status(401).json({ 
        error: 'User not found or inactive',
        code: 'USER_INACTIVE'
      });
    }
    
    req.user = users[0];
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    
    // Differentiate between expired and invalid tokens
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ 
        error: 'Invalid token',
        code: 'TOKEN_INVALID'
      });
    }
    
    return res.status(403).json({ 
      error: 'Invalid or expired token',
      code: 'TOKEN_ERROR'
    });
  }
};

// Role-based access control
const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (req.user.role !== role && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  JWT_SECRET
};