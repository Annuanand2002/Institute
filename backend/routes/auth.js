const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('--- LOGIN REQUEST ---', new Date().toISOString(), '| username:', username || '(empty)');

    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username and password are required' 
      });
    }

    // Find user profile by username
    const [userProfiles] = await db.execute(
      `SELECT 
        up.id, up.staff_id, up.username, up.password, up.can_login, up.created_date, up.modified_date,
        u.id as user_id,
        u.name,
        u.email,
        u.user_role_id,
        ur.role_name,
        COALESCE(u.is_dashboard, 0) as is_dashboard,
        COALESCE(u.is_batch, 0) as is_batch,
        COALESCE(u.is_course, 0) as is_course,
        COALESCE(u.is_staff, 0) as is_staff,
        COALESCE(u.is_student, 0) as is_student,
        COALESCE(u.is_payment, 0) as is_payment,
        COALESCE(u.is_receipt, 0) as is_receipt,
        COALESCE(u.is_proftloss, 0) as is_proftloss
      FROM user_profile up
      INNER JOIN user u ON up.staff_id = u.id
      INNER JOIN user_role ur ON u.user_role_id = ur.id
      WHERE up.username = ? AND up.deleted_date IS NULL AND u.is_deleted = FALSE`,
      [username]
    );

    console.log('User profiles found:', userProfiles.length);

    if (userProfiles.length === 0) {
      console.log('No user found with username:', username);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid username or password' 
      });
    }

    const userProfile = userProfiles[0];

    // Only allow login when can_login is 1 (or true)
    const canLogin = userProfile.can_login;
    if (canLogin !== 1 && canLogin !== true) {
      console.log('Login disabled for user (can_login is not 1):', username);
      return res.status(403).json({ 
        success: false, 
        error: 'Login is disabled for this account' 
      });
    }

    // Verify password using bcrypt
    console.log('Comparing password...');
    const isValidPassword = await bcrypt.compare(password, userProfile.password);
    console.log('Password valid:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('Invalid password for user:', username);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid username or password' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: userProfile.user_id,
        username: userProfile.username,
        roleId: userProfile.user_role_id,
        roleName: userProfile.role_name
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Return user data and token
    console.log('--- LOGIN SUCCESS ---', username, '| user_id:', userProfile.user_id);
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: userProfile.user_id,
          username: userProfile.username,
          name: userProfile.name,
          email: userProfile.email,
          roleId: userProfile.user_role_id,
          roleName: userProfile.role_name,
          is_dashboard: !!userProfile.is_dashboard,
          is_batch: !!userProfile.is_batch,
          is_course: !!userProfile.is_course,
          is_staff: !!userProfile.is_staff,
          is_student: !!userProfile.is_student,
          is_payment: !!userProfile.is_payment,
          is_receipt: !!userProfile.is_receipt,
          is_proftloss: !!userProfile.is_proftloss
        }
      }
    });
  } catch (error) {
    console.error('Error during login:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Verify token endpoint
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'No token provided' 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Get fresh user data including permission flags
    const [users] = await db.execute(
      `SELECT 
        u.id,
        u.name,
        u.email,
        u.user_role_id,
        ur.role_name,
        up.username,
        up.can_login,
        COALESCE(u.is_dashboard, 0) as is_dashboard,
        COALESCE(u.is_batch, 0) as is_batch,
        COALESCE(u.is_course, 0) as is_course,
        COALESCE(u.is_staff, 0) as is_staff,
        COALESCE(u.is_student, 0) as is_student,
        COALESCE(u.is_payment, 0) as is_payment,
        COALESCE(u.is_receipt, 0) as is_receipt,
        COALESCE(u.is_proftloss, 0) as is_proftloss
      FROM user u
      INNER JOIN user_role ur ON u.user_role_id = ur.id
      LEFT JOIN user_profile up ON up.staff_id = u.id
      WHERE u.id = ? AND u.is_deleted = FALSE`,
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    const user = users[0];

    // Only allow when can_login is 1 (or true)
    const canLogin = user.can_login;
    if (canLogin !== 1 && canLogin !== true) {
      return res.status(403).json({ 
        success: false, 
        error: 'Login is disabled for this account' 
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          roleId: user.user_role_id,
          roleName: user.role_name,
          is_dashboard: !!user.is_dashboard,
          is_batch: !!user.is_batch,
          is_course: !!user.is_course,
          is_staff: !!user.is_staff,
          is_student: !!user.is_student,
          is_payment: !!user.is_payment,
          is_receipt: !!user.is_receipt,
          is_proftloss: !!user.is_proftloss
        }
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired token' 
      });
    }
    console.error('Error verifying token:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Create user profile endpoint
router.post('/create-profile', async (req, res) => {
  try {
    const {
      user_id,           // If provided, use existing user
      username,
      password,
      role,              // 'Admin', 'Staff', or 'Student'
      can_login = true,
      // User details (if creating new user)
      name,
      email,
      created_by,
      is_dashboard, is_batch, is_course, is_staff, is_student, is_payment, is_receipt, is_proftloss
    } = req.body;

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    if (!role) {
      return res.status(400).json({
        success: false,
        error: 'Role is required (Admin, Staff, or Student)'
      });
    }

    // Check if username already exists
    const [existingProfiles] = await db.execute(
      `SELECT id FROM user_profile WHERE username = ? AND deleted_date IS NULL`,
      [username]
    );

    if (existingProfiles.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Username already exists'
      });
    }

    let userId = user_id;
    let userRoleId;

    // Get role ID
    const [roles] = await db.execute(
      `SELECT id FROM user_role WHERE role_name = ? LIMIT 1`,
      [role]
    );

    if (roles.length === 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid role. Available roles: Admin, Staff, Student`
      });
    }

    userRoleId = roles[0].id;

    // If user_id not provided, create a new user
    if (!userId) {
      if (!name || !email) {
        return res.status(400).json({
          success: false,
          error: 'If user_id is not provided, name and email are required to create a new user'
        });
      }

      // Create new user
      const [userResult] = await db.execute(
        `INSERT INTO user (
          user_role_id, name, email, is_active, created_by
        ) VALUES (?, ?, ?, ?, ?)`,
        [userRoleId, name, email, true, created_by || null]
      );

      userId = userResult.insertId;
      console.log('Created new user with ID:', userId);
    } else {
      // Verify user exists and matches the role
      const [users] = await db.execute(
        `SELECT id, user_role_id FROM user WHERE id = ? AND is_deleted = FALSE`,
        [userId]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Optionally verify role matches (you can remove this if you want flexibility)
      if (users[0].user_role_id !== userRoleId) {
        console.log(`Warning: User role mismatch. User has role_id ${users[0].user_role_id}, but requested role_id is ${userRoleId}`);
      }
    }

    // Hash password (unless it's admin and you want plain text - but let's hash it for security)
    // For admin, we'll still hash it, but the login route handles plain text comparison
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user profile
    const [profileResult] = await db.execute(
      `INSERT INTO user_profile (
        staff_id, username, password, can_login, created_by
      ) VALUES (?, ?, ?, ?, ?)`,
      [userId, username, hashedPassword, can_login, created_by || null]
    );

    const profileId = profileResult.insertId;
    console.log('[DB SAVE] User profile created in database:', {
      profile_id: profileId,
      staff_id: userId,
      username,
      can_login,
      created_by: created_by || null,
      table: 'user_profile'
    });

    // Update user permission flags if provided
    const permissionFlags = {
      is_dashboard, is_batch, is_course, is_staff, is_student, is_payment, is_receipt, is_proftloss
    };
    const hasPermissionFlags = Object.keys(permissionFlags).some(k => permissionFlags[k] !== undefined);
    if (hasPermissionFlags) {
      const userUpdates = [];
      const userParams = [];
      const toBit = (v) => (v === true || v === 1 || v === '1') ? 1 : 0;
      if (is_dashboard !== undefined) { userUpdates.push('is_dashboard = ?'); userParams.push(toBit(is_dashboard)); }
      if (is_batch !== undefined) { userUpdates.push('is_batch = ?'); userParams.push(toBit(is_batch)); }
      if (is_course !== undefined) { userUpdates.push('is_course = ?'); userParams.push(toBit(is_course)); }
      if (is_staff !== undefined) { userUpdates.push('is_staff = ?'); userParams.push(toBit(is_staff)); }
      if (is_student !== undefined) { userUpdates.push('is_student = ?'); userParams.push(toBit(is_student)); }
      if (is_payment !== undefined) { userUpdates.push('is_payment = ?'); userParams.push(toBit(is_payment)); }
      if (is_receipt !== undefined) { userUpdates.push('is_receipt = ?'); userParams.push(toBit(is_receipt)); }
      if (is_proftloss !== undefined) { userUpdates.push('is_proftloss = ?'); userParams.push(toBit(is_proftloss)); }
      if (userUpdates.length > 0) {
        userParams.push(userId);
        await db.execute(
          `UPDATE user SET ${userUpdates.join(', ')} WHERE id = ?`,
          userParams
        );
      }
    }

    // Fetch the created profile with user details
    const [newProfile] = await db.execute(
      `SELECT 
        up.id, up.staff_id, up.username, up.can_login, up.created_date, up.modified_date,
        u.id as user_id,
        u.name,
        u.email,
        u.user_role_id,
        ur.role_name
      FROM user_profile up
      INNER JOIN user u ON up.staff_id = u.id
      INNER JOIN user_role ur ON u.user_role_id = ur.id
      WHERE up.id = ?`,
      [profileId]
    );

    console.log('User profile created successfully:', username);

    res.status(201).json({
      success: true,
      message: 'User profile created successfully',
      data: {
        profile: newProfile[0],
        // Don't return password hash
        username: newProfile[0].username,
        user_id: newProfile[0].user_id,
        name: newProfile[0].name,
        email: newProfile[0].email,
        role: newProfile[0].role_name
      }
    });
  } catch (error) {
    console.error('Error creating user profile:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Logout endpoint (client-side token removal, but we can track it if needed)
router.post('/logout', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Logged out successfully' 
  });
});

module.exports = router;
