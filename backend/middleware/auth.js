const jwt = require('jsonwebtoken');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'No token provided. Authentication required.' 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify user still exists and can login
    const [users] = await db.execute(
      `SELECT 
        u.id,
        u.is_deleted,
        u.is_active,
        up.can_login
      FROM user u
      LEFT JOIN user_profile up ON up.staff_id = u.id
      WHERE u.id = ?`,
      [decoded.userId]
    );

    if (users.length === 0 || users[0].is_deleted || !users[0].is_active) {
      return res.status(401).json({ 
        success: false, 
        error: 'User account is inactive or deleted' 
      });
    }

    // Only allow when can_login is 1 (or true); block 0, null, false
    const canLogin = users[0].can_login;
    if (canLogin !== 1 && canLogin !== true) {
      return res.status(403).json({ 
        success: false, 
        error: 'Login is disabled for this account' 
      });
    }

    // Attach user info to request
    req.user = {
      id: decoded.userId,
      username: decoded.username,
      roleId: decoded.roleId,
      roleName: decoded.roleName
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Token expired' 
      });
    }
    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Authentication error' 
    });
  }
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    if (!roles.includes(req.user.roleName)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Insufficient permissions' 
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize
};
