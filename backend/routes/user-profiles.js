const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcryptjs');

// Get all user profiles (staff with login credentials)
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT 
        up.id,
        up.staff_id,
        up.username,
        up.can_login,
        up.created_date,
        up.modified_date,
        u.name as staff_name,
        u.registration_no as staff_reg_no,
        ur.role_name,
        COALESCE(u.is_active, 0) as is_active
      FROM user_profile up
      INNER JOIN user u ON up.staff_id = u.id
      INNER JOIN user_role ur ON u.user_role_id = ur.id
      WHERE up.deleted_date IS NULL 
        AND u.is_deleted = FALSE
        AND COALESCE(u.user_role_id, 0) NOT IN (1, 5)
    `;
    const params = [];

    if (search) {
      query += ` AND (up.username LIKE ? OR u.name LIKE ? OR u.registration_no LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY up.created_date DESC`;

    const [rows] = await db.execute(query, params);
    const data = rows.map(r => ({
      id: r.id,
      staff_id: r.staff_id,
      username: r.username,
      can_login: !!r.can_login,
      created_date: r.created_date,
      modified_date: r.modified_date,
      staff_name: r.staff_name,
      staff_reg_no: r.staff_reg_no,
      role_name: r.role_name,
      is_active: !!r.is_active,
      userId: `USR${String(r.id).padStart(4, '0')}`,
      tutorName: r.staff_name,
      tutorRegNo: r.staff_reg_no || '',
      tutorId: r.staff_id
    }));
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching user profiles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user profile by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute(
      `SELECT up.id, up.staff_id, up.username, up.can_login, up.created_date, up.modified_date,
              u.name as staff_name, u.registration_no as staff_reg_no, ur.role_name,
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
       WHERE up.id = ? AND up.deleted_date IS NULL`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User profile not found' });
    }
    const r = rows[0];
    res.json({
      success: true,
      data: {
        id: r.id,
        staff_id: r.staff_id,
        username: r.username,
        can_login: !!r.can_login,
        staff_name: r.staff_name,
        staff_reg_no: r.staff_reg_no,
        role_name: r.role_name,
        created_date: r.created_date,
        modified_date: r.modified_date,
        is_dashboard: !!r.is_dashboard,
        is_batch: !!r.is_batch,
        is_course: !!r.is_course,
        is_staff: !!r.is_staff,
        is_student: !!r.is_student,
        is_payment: !!r.is_payment,
        is_receipt: !!r.is_receipt,
        is_proftloss: !!r.is_proftloss
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update user profile (username, password, can_login, staff_id)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      username, password, can_login, staff_id, modified_by,
      is_dashboard, is_batch, is_course, is_staff, is_student, is_payment, is_receipt, is_proftloss
    } = req.body;

    const [existing] = await db.execute(
      'SELECT id, username, staff_id FROM user_profile WHERE id = ? AND deleted_date IS NULL',
      [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'User profile not found' });
    }

    if (username) {
      const [dup] = await db.execute(
        'SELECT id FROM user_profile WHERE username = ? AND id != ? AND deleted_date IS NULL',
        [username, id]
      );
      if (dup.length > 0) {
        return res.status(400).json({ success: false, error: 'Username already exists' });
      }
    }

    if (staff_id !== undefined) {
      const staffIdNum = parseInt(staff_id, 10);
      if (Number.isNaN(staffIdNum) || staffIdNum <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid staff' });
      }
      const [staffRow] = await db.execute(
        'SELECT u.id FROM user u INNER JOIN user_role ur ON u.user_role_id = ur.id WHERE u.id = ? AND u.is_deleted = FALSE AND LOWER(ur.role_name) = ?',
        [staffIdNum, 'staff']
      );
      if (staffRow.length === 0) {
        return res.status(400).json({ success: false, error: 'Staff not found or not a staff role' });
      }
      const [otherProfile] = await db.execute(
        'SELECT id FROM user_profile WHERE staff_id = ? AND id != ? AND deleted_date IS NULL',
        [staffIdNum, id]
      );
      if (otherProfile.length > 0) {
        return res.status(400).json({ success: false, error: 'Another user is already linked to this staff' });
      }
    }

    const updates = [];
    const params = [];

    if (username !== undefined) {
      updates.push('username = ?');
      params.push(username);
    }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      params.push(hash);
    }
    if (can_login !== undefined) {
      updates.push('can_login = ?');
      params.push(!!can_login);
    }
    if (staff_id !== undefined) {
      updates.push('staff_id = ?');
      params.push(parseInt(staff_id, 10));
    }

    // Resolve which user id to update for permissions (current profile's staff_id)
    let userIdForPermissions = existing[0].staff_id;
    if (staff_id !== undefined) userIdForPermissions = parseInt(staff_id, 10);

    const permissionFlags = {
      is_dashboard, is_batch, is_course, is_staff, is_student, is_payment, is_receipt, is_proftloss
    };
    const hasPermissionUpdates = Object.keys(permissionFlags).some(k => permissionFlags[k] !== undefined);

    if (updates.length === 0 && !hasPermissionUpdates) {
      const [current] = await db.execute(
        'SELECT up.id, up.staff_id, up.username, up.can_login, up.created_date, up.modified_date, u.name as staff_name FROM user_profile up INNER JOIN user u ON up.staff_id = u.id WHERE up.id = ?',
        [id]
      );
      return res.json({ success: true, data: current[0] });
    }

    if (updates.length > 0) {
      updates.push('modified_by = ?', 'modified_date = NOW()');
      params.push(modified_by || null);
      params.push(id);

      await db.execute(
        `UPDATE user_profile SET ${updates.join(', ')} WHERE user_profile.id = ?`,
        params
      );
    }

    if (hasPermissionUpdates) {
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
        userParams.push(userIdForPermissions);
        await db.execute(
          `UPDATE user SET ${userUpdates.join(', ')} WHERE id = ?`,
          userParams
        );
      }
    }

    console.log('[DB SAVE] User profile updated in database:', {
      profile_id: id,
      username: username !== undefined ? username : '(unchanged)',
      password_updated: !!password,
      can_login: can_login !== undefined ? can_login : '(unchanged)',
      staff_id: staff_id !== undefined ? staff_id : '(unchanged)',
      modified_by: modified_by || null,
      table: 'user_profile'
    });

    const [updated] = await db.execute(
      `SELECT up.id, up.staff_id, up.username, up.can_login, up.created_date, up.modified_date,
              u.name as staff_name, u.registration_no as staff_reg_no
       FROM user_profile up INNER JOIN user u ON up.staff_id = u.id WHERE up.id = ?`,
      [id]
    );
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Soft delete user profile
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { deleted_by } = req.body;

    const [beforeDelete] = await db.execute(
      'SELECT id, staff_id, username FROM user_profile WHERE id = ?',
      [id]
    );

    await db.execute(
      'UPDATE user_profile SET deleted_by = ?, deleted_date = NOW() WHERE id = ?',
      [deleted_by || null, id]
    );

    console.log('[DB SAVE] User profile soft-deleted in database:', {
      profile_id: id,
      username: beforeDelete[0]?.username,
      staff_id: beforeDelete[0]?.staff_id,
      deleted_by: deleted_by || null,
      table: 'user_profile'
    });

    res.json({ success: true, message: 'User profile deleted successfully' });
  } catch (error) {
    console.error('Error deleting user profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
