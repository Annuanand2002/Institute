const bcrypt = require('bcryptjs');
const db = require('../config/database');
require('dotenv').config();

async function createAdminUser() {
  try {
    // Check if admin user already exists
    const [existingAdmin] = await db.execute(
      `SELECT u.id FROM user u
       INNER JOIN user_role ur ON u.user_role_id = ur.id
       WHERE ur.role_name = 'Admin' AND u.is_deleted = FALSE
       LIMIT 1`
    );

    if (existingAdmin.length > 0) {
      console.log('Admin user already exists');
      process.exit(0);
    }

    // Get Admin role ID
    const [roles] = await db.execute(
      `SELECT id FROM user_role WHERE role_name = 'Admin' LIMIT 1`
    );

    if (roles.length === 0) {
      console.error('Admin role not found. Please run the SQL script to create user_role table.');
      process.exit(1);
    }

    const adminRoleId = roles[0].id;

    // Create admin user
    const [userResult] = await db.execute(
      `INSERT INTO user (
        user_role_id, name, email, is_active, created_by
      ) VALUES (?, ?, ?, ?, ?)`,
      [adminRoleId, 'Admin User', 'admin@institute.com', true, null]
    );

    const userId = userResult.insertId;

    // Hash password
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Create user profile
    await db.execute(
      `INSERT INTO user_profile (
        staff_id, username, password, can_login, created_by
      ) VALUES (?, ?, ?, ?, ?)`,
      [userId, 'admin', hashedPassword, true, null]
    );

    console.log('✅ Admin user created successfully!');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('⚠️  Please change the password after first login!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
}

createAdminUser();
