// routes/authRoutes.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

module.exports = (dependencies) => {
  const { 
    getDb, 
    authenticateToken, 
    JWT_SECRET,
    profileUploadsDir
  } = dependencies;

  const router = express.Router();
  const JWT_EXPIRES_IN = '1h';

  // Configure multer for profile picture uploads
  const storage = multer.memoryStorage();
  const upload = multer({
    storage,
    limits: {
      fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'), false);
      }
    }
  });

  // Login endpoint
  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      
      console.log('Login attempt:', { username, passwordLength: password?.length });
      
      if (!username || !password) {
        return res.status(400).json({ 
          error: 'VALIDATION_ERROR',
          message: 'Username and password are required' 
        });
      }
      
      const db = await getDb();
      if (!db) {
        console.error('Database connection failed');
        return res.status(500).json({ 
          error: 'DATABASE_ERROR',
          message: 'Database not connected' 
        });
      }
      
      // Get user from database with profile picture
      const [users] = await db.execute(
        'SELECT id, username, email, password_hash, first_name, last_name, role, is_active, profile_picture FROM users WHERE username = ? AND is_active = 1',
        [username]
      );
      
      console.log('Users found:', users.length);
      
      if (users.length === 0) {
        return res.status(401).json({ 
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password' 
        });
      }
      
      const user = users[0];
      
      // Verify password
      console.log('Verifying password...');
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      console.log('Password valid:', isValidPassword);
      
      if (!isValidPassword) {
        return res.status(401).json({ 
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password' 
        });
      }
      
      // Update last login
      await db.execute(
        'UPDATE users SET last_login = NOW() WHERE id = ?',
        [user.id]
      );
      
      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role, language: user.language },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );
      
      // Remove password_hash from response and format profile picture URL
      const { password_hash, ...userResponse } = user;
      if (userResponse.profile_picture) {
        userResponse.profile_picture = `${userResponse.profile_picture}`;
      }
      
      console.log('✅ Login successful for user:', userResponse.username);
      
      res.json({
        success: true,
        token,
        user: userResponse
      });
      
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ 
        error: 'INTERNAL_ERROR',
        message: 'Internal server error' 
      });
    }
  });

  // Token verification endpoint
  router.get('/verify', authenticateToken, async (req, res) => {
    try {
      res.json({
        success: true,
        user: req.user
      });
    } catch (error) {
      console.error('Token verification error:', error);
      res.status(500).json({ 
        error: 'INTERNAL_ERROR',
        message: 'Failed to verify token' 
      });
    }
  });

  // Logout endpoint
  router.post('/logout', authenticateToken, (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
  });

  // Get current user profile
  router.get('/profile', authenticateToken, async (req, res) => {
    try {
      const db = await getDb();
      const [users] = await db.execute(
        'SELECT id, username, email, first_name, last_name, role, is_active, profile_picture FROM users WHERE id = ?',
        [req.user.id]
      );
      
      if (users.length === 0) {
        return res.status(404).json({ 
          error: 'USER_NOT_FOUND',
          message: 'User not found' 
        });
      }
      
      const user = users[0];
      if (user.profile_picture) {
        user.profile_picture = `${user.profile_picture}`;
      }
      
      res.json({
        success: true,
        user
      });
    } catch (error) {
      console.error('Profile fetch error:', error);
      res.status(500).json({ 
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch profile' 
      });
    }
  });

  // Refresh token
  router.post('/refresh', async (req, res) => {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({ 
          error: 'TOKEN_REQUIRED',
          code: 'TOKEN_REQUIRED',
          message: 'Access token required for refresh'
        });
      }

      // Try to decode the token even if it's expired to get user info
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          // Token is expired, but we can still decode it to get user info
          decoded = jwt.decode(token);
          if (!decoded || !decoded.userId) {
            return res.status(401).json({ 
              error: 'TOKEN_INVALID',
              code: 'TOKEN_INVALID',
              message: 'Invalid token structure'
            });
          }
        } else {
          return res.status(401).json({ 
            error: 'TOKEN_INVALID',
            code: 'TOKEN_INVALID',
            message: 'Invalid token'
          });
        }
      }

      const db = await getDb();
      if (!db) {
        return res.status(500).json({ 
          error: 'DATABASE_ERROR',
          message: 'Database not connected' 
        });
      }
      
      // Check if user is still active
      const [users] = await db.execute(
        'SELECT id, username, email, first_name, last_name, role, is_active, profile_picture FROM users WHERE id = ? AND is_active = 1',
        [decoded.userId]
      );
      
      if (users.length === 0) {
        return res.status(401).json({ 
          error: 'USER_INACTIVE',
          code: 'USER_INACTIVE',
          message: 'User not found or inactive'
        });
      }
      
      // Update last login time
      await db.execute(
        'UPDATE users SET last_login = NOW() WHERE id = ?',
        [decoded.userId]
      );
      
      // Generate new JWT token
      const newToken = jwt.sign(
        { userId: decoded.userId, username: decoded.username, role: decoded.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );
      
      const userData = users[0];
      if (userData.profile_picture) {
        userData.profile_picture = `${userData.profile_picture}`;
      }
      
      res.json({
        success: true,
        token: newToken,
        user: userData,
        message: 'Token refreshed successfully'
      });
      
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({ 
        error: 'REFRESH_ERROR',
        code: 'REFRESH_ERROR',
        message: 'Token refresh failed'
      });
    }
  });

  // Update user profile with profile picture upload
  router.put('/profile', authenticateToken, upload.single('profile_picture'), async (req, res) => {
    try {
      const { first_name, last_name, email } = req.body;
      const userId = req.user.id;
      const db = await getDb();
      
      // Validate required fields
      if (!first_name || !last_name || !email) {
        return res.status(400).json({ 
          error: 'VALIDATION_ERROR',
          message: 'First name, last name, and email are required' 
        });
      }
      
      // Check if email is already taken by another user
      const [existingUsers] = await db.execute(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, userId]
      );
      
      if (existingUsers.length > 0) {
        return res.status(400).json({ 
          error: 'EMAIL_TAKEN',
          message: 'Email is already taken' 
        });
      }
      
      let profilePictureName = null;
      
      // Handle profile picture upload
      if (req.file) {
        // Create uploads/profiles directory if it doesn't exist
        const uploadsDir = profileUploadsDir
        try {
          await fs.access(uploadsDir);
        } catch {
          await fs.mkdir(uploadsDir, { recursive: true });
        }
        
        // Generate unique filename
        const fileExtension = 'webp'; // Since frontend converts to WebP
        profilePictureName = `${userId}_${Date.now()}.${fileExtension}`;
        const filePath = path.join(uploadsDir, profilePictureName);
        
        // Get current profile picture to delete old one
        const [currentUser] = await db.execute(
          'SELECT profile_picture FROM users WHERE id = ?',
          [userId]
        );
        
        // Save new file
        await fs.writeFile(filePath, req.file.buffer);
        
        // Delete old profile picture if it exists
        if (currentUser[0]?.profile_picture) {
          const oldFilePath = path.join(uploadsDir, currentUser[0].profile_picture);
          try {
            await fs.unlink(oldFilePath);
          } catch (error) {
            console.log('Could not delete old profile picture:', error.message);
          }
        }
      }
      
      // Update user data
      const updateQuery = profilePictureName 
        ? 'UPDATE users SET first_name = ?, last_name = ?, email = ?, profile_picture = ? WHERE id = ?'
        : 'UPDATE users SET first_name = ?, last_name = ?, email = ? WHERE id = ?';
      
      const updateParams = profilePictureName 
        ? [first_name, last_name, email, profilePictureName, userId]
        : [first_name, last_name, email, userId];
      
      await db.execute(updateQuery, updateParams);
      
      // Get updated user data
      const [users] = await db.execute(
        'SELECT id, username, email, first_name, last_name, role, is_active, profile_picture FROM users WHERE id = ?',
        [userId]
      );
      
      const userData = users[0];
      if (userData.profile_picture) {
        userData.profile_picture = `${userData.profile_picture}`;
      }
      
      res.json({
        success: true,
        user: userData,
        message: 'Profile updated successfully'
      });
      
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ 
        error: 'INTERNAL_ERROR',
        message: 'Failed to update profile' 
      });
    }
  });

  // Change password endpoint
  router.put('/change-password', authenticateToken, async (req, res) => {
    try {
      const { current_password, new_password } = req.body;
      const userId = req.user.id;
      const db = await getDb();
      
      // Validate input
      if (!current_password || !new_password) {
        return res.status(400).json({ 
          error: 'VALIDATION_ERROR',
          message: 'Current password and new password are required' 
        });
      }
      
      if (new_password.length < 6) {
        return res.status(400).json({ 
          error: 'VALIDATION_ERROR',
          message: 'New password must be at least 6 characters long' 
        });
      }
      
      // Get current user with password hash
      const [users] = await db.execute(
        'SELECT password_hash FROM users WHERE id = ? AND is_active = 1',
        [userId]
      );
      
      if (users.length === 0) {
        return res.status(404).json({ 
          error: 'USER_NOT_FOUND',
          message: 'User not found' 
        });
      }
      
      const user = users[0];
      
      // Verify current password
      const isValidPassword = await bcrypt.compare(current_password, user.password_hash);
          
      if (!isValidPassword) {
        return res.status(401).json({ 
          error: 'INVALID_PASSWORD',
          message: 'Current password is incorrect' 
        });
      }
      
      // Hash new password
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(new_password, saltRounds);
      
      // Update password in database
      await db.execute(
        'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
        [newPasswordHash, userId]
      );
      
      res.json({
        success: true,
        message: 'Password changed successfully'
      });
      
    } catch (error) {
      console.error('Password change error:', error);
      res.status(500).json({ 
        error: 'INTERNAL_ERROR',
        message: 'Failed to change password' 
      });
    }
  });

  // Delete profile picture endpoint
  router.delete('/profile-picture', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;
      const db = await getDb();
      
      // Get current profile picture
      const [users] = await db.execute(
        'SELECT profile_picture FROM users WHERE id = ?',
        [userId]
      );
      
      if (users.length === 0) {
        return res.status(404).json({ 
          error: 'USER_NOT_FOUND',
          message: 'User not found' 
        });
      }
      
      const currentProfilePicture = users[0].profile_picture;
      
      // Update database to remove profile picture
      await db.execute(
        'UPDATE users SET profile_picture = NULL WHERE id = ?',
        [userId]
      );
      
      // Delete file from disk if it exists
      if (currentProfilePicture) {
        const uploadsDir = profileUploadsDir
        const filePath = path.join(uploadsDir, currentProfilePicture);
        
        try {
          await fs.unlink(filePath);
        } catch (error) {
          console.log('Could not delete profile picture file:', error.message);
        }
      }
      
      res.json({
        success: true,
        message: 'Profile picture deleted successfully'
      });
      
    } catch (error) {
      console.error('Profile picture delete error:', error);
      res.status(500).json({ 
        error: 'INTERNAL_ERROR',
        message: 'Failed to delete profile picture' 
      });
    }
  });

  return router;
};