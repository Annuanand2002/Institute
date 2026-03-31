const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get all users (with filters for students/staff)
router.get('/', async (req, res) => {
  try {
    const { role, course_id, is_active, search } = req.query;
    let query = `
      SELECT 
        u.*,
        ur.role_name,
        c.course_name,
        c.course_code,
        b.batch_name,
        b.batch_code
      FROM user u
      LEFT JOIN user_role ur ON u.user_role_id = ur.id
      LEFT JOIN course c ON u.course_id = c.id
      LEFT JOIN batch b ON c.batch_id = b.id
      WHERE u.is_deleted = FALSE AND COALESCE(u.user_role_id, 0) NOT IN (1, 5)
    `;
    const params = [];

    if (role) {
      query += ` AND ur.role_name = ?`;
      params.push(role);
    }

    if (course_id) {
      query += ` AND u.course_id = ?`;
      params.push(course_id);
    }

    // Filter by active flag only when explicitly requested
    if (is_active === 'true') {
      query += ` AND u.is_active = TRUE`;
    } else if (is_active === 'false') {
      query += ` AND u.is_active = FALSE`;
    }

    if (search) {
      query += ` AND (u.name LIKE ? OR u.registration_no LIKE ? OR u.email LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY u.created_date DESC`;

    const [rows] = await db.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helpers for report: month boundaries and count of months
function startOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfMonth(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  d.setHours(23, 59, 59, 999);
  return d;
}
function monthsBetween(startDate, endDate) {
  const start = startOfMonth(startDate);
  const end = startOfMonth(endDate);
  return Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
}

// Student report: due amount from application_date to current month only.
// Start = application_date month; end = current month. Expected = (months in range) × monthly installment.
// Paid in period = sum of Fee transactions only (transtype = 'Fee') in that date range. Due = expected − paid (min 0).
router.get('/report', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT 
        u.id,
        u.registration_no,
        u.name,
        u.course_id,
        u.application_date,
        u.course_fee,
        u.adjustment_amount,
        u.payment_mode,
        c.course_name,
        c.course_code,
        b.batch_name,
        c.total_fee,
        c.duration
      FROM user u
      INNER JOIN user_role ur ON u.user_role_id = ur.id
      LEFT JOIN course c ON u.course_id = c.id
      LEFT JOIN batch b ON c.batch_id = b.id
      WHERE u.is_deleted = FALSE
        AND u.is_active = TRUE
        AND ur.role_name = 'Student'`
    );

    const [txnRows] = await db.execute(
      `SELECT user_id, amount, transaction_date
       FROM transactions
       WHERE is_deleted = FALSE AND transtype = 'Fee'`
    );

    const now = new Date();
    const periodEnd = endOfMonth(now);

    const data = (rows || []).map(row => {
      const courseFee =
        row.course_fee != null
          ? Number(row.course_fee)
          : row.total_fee != null
            ? Number(row.total_fee)
            : 0;
      const adjustment = row.adjustment_amount != null ? Number(row.adjustment_amount) : 0;
      const totalPayable = Math.max(0, courseFee - adjustment);
      const duration = row.duration != null && Number(row.duration) > 0 ? Number(row.duration) : 1;
      const monthlyAmount = totalPayable / duration;

      const appDate = row.application_date ? new Date(row.application_date) : null;
      const periodStart = appDate ? startOfMonth(appDate) : null;
      const monthsInPeriod = periodStart ? monthsBetween(periodStart, now) : 0;
      const expectedInPeriod = monthsInPeriod * monthlyAmount;

      let paidInPeriod = 0;
      let totalPaidAllTime = 0;
      if (txnRows && txnRows.length > 0) {
        for (const t of txnRows) {
          if (t.user_id !== row.id) continue;
          const amt = Number(t.amount) || 0;
          totalPaidAllTime += amt;
          if (periodStart) {
            const tDate = new Date(t.transaction_date);
            if (tDate >= periodStart && tDate <= periodEnd) paidInPeriod += amt;
          }
        }
      }

      let dueAmount;
      let paidAmount;
      if (periodStart && monthsInPeriod > 0) {
        dueAmount = Math.max(0, expectedInPeriod - paidInPeriod);
        paidAmount = paidInPeriod;
      } else {
        paidAmount = totalPaidAllTime;
        dueAmount = Math.max(0, totalPayable - totalPaidAllTime);
      }

      return {
        student_id: row.id,
        registration_no: row.registration_no,
        name: row.name,
        course_name: row.course_name || '-',
        batch_name: row.batch_name || '-',
        course_code: row.course_code,
        due_amount: Math.round(dueAmount * 100) / 100,
        total_payable: totalPayable,
        paid_amount: Math.round(paidAmount * 100) / 100,
        application_date: row.application_date || null,
        months_in_period: monthsInPeriod,
        expected_in_period: Math.round(expectedInPeriod * 100) / 100
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error building student report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Student report: month-wise due breakdown for one student (Fee transactions only)
// For each month from application_date month to current month:
// - if there is any Fee transaction in that month => due = 0 (month considered paid)
// - else due = monthly installment
router.get('/report/:id/monthly-due', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Valid student id is required' });
    }

    const [[student]] = await db.execute(
      `SELECT 
        u.id,
        u.registration_no,
        u.name,
        u.application_date,
        u.course_fee,
        u.adjustment_amount,
        c.total_fee,
        c.duration,
        c.course_name,
        c.course_code
      FROM user u
      INNER JOIN user_role ur ON u.user_role_id = ur.id
      LEFT JOIN course c ON u.course_id = c.id
      WHERE u.is_deleted = FALSE
        AND u.is_active = TRUE
        AND ur.role_name = 'Student'
        AND u.id = ?`,
      [id]
    );

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    if (!student.application_date) {
      return res.json({
        success: true,
        data: {
          student_id: student.id,
          registration_no: student.registration_no,
          name: student.name,
          course_name: student.course_name || '-',
          course_code: student.course_code,
          monthly_amount: 0,
          months: [],
          note: 'Student application_date is missing'
        }
      });
    }

    const courseFee =
      student.course_fee != null
        ? Number(student.course_fee)
        : student.total_fee != null
          ? Number(student.total_fee)
          : 0;
    const adjustment = student.adjustment_amount != null ? Number(student.adjustment_amount) : 0;
    const totalPayable = Math.max(0, courseFee - adjustment);
    const duration = student.duration != null && Number(student.duration) > 0 ? Number(student.duration) : 1;
    const monthlyAmount = totalPayable / duration;

    const now = new Date();
    const periodStart = startOfMonth(new Date(student.application_date));
    const periodEnd = endOfMonth(now);

    const [txns] = await db.execute(
      `SELECT amount, transaction_date
       FROM transactions
       WHERE is_deleted = FALSE
         AND transtype = 'Fee'
         AND user_id = ?
         AND transaction_date >= ?
         AND transaction_date <= ?`,
      [id, periodStart, periodEnd]
    );

    const txByMonth = new Map(); // key: YYYY-MM -> paidAmount
    for (const t of txns || []) {
      const d = startOfMonth(new Date(t.transaction_date));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const prev = txByMonth.get(key) || 0;
      txByMonth.set(key, prev + (Number(t.amount) || 0));
    }

    const months = [];
    const monthsCount = monthsBetween(periodStart, now);
    const cursor = new Date(periodStart);
    // Carry forward unpaid due into next month:
    // payable_this_month = monthly_amount + carried_due_from_previous_month
    // next_carried_due = max(0, payable_this_month - paid_this_month)
    let carriedDue = 0;
    for (let i = 0; i < monthsCount; i++) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      const paidAmount = txByMonth.get(key) || 0;
      const payableThisMonth = monthlyAmount + carriedDue;
      const dueAmount = Math.max(0, payableThisMonth - paidAmount);
      carriedDue = dueAmount;
      const isPaid = dueAmount === 0;
      months.push({
        month: key,
        paid_amount: Math.round(paidAmount * 100) / 100,
        due_amount: Math.round(dueAmount * 100) / 100,
        status: isPaid ? 'Paid' : 'Pending'
      });
      cursor.setMonth(cursor.getMonth() + 1);
      cursor.setDate(1);
      cursor.setHours(0, 0, 0, 0);
    }

    res.json({
      success: true,
      data: {
        student_id: student.id,
        registration_no: student.registration_no,
        name: student.name,
        course_name: student.course_name || '-',
        course_code: student.course_code,
        monthly_amount: Math.round(monthlyAmount * 100) / 100,
        months
      }
    });
  } catch (error) {
    console.error('Error building monthly due report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper to extract base64 from data URL (for profile image)
function extractBase64(data) {
  if (!data) return null;
  if (typeof data === 'string' && data.includes(',')) {
    return data.split(',')[1];
  }
  return data;
}

// Get user by ID (includes profile_image as data URL when present)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute(
      `SELECT 
        u.*,
        ur.role_name,
        c.course_name,
        c.course_code,
        b.batch_name,
        b.batch_code,
        a.base64_data as profile_image_data
      FROM user u
      LEFT JOIN user_role ur ON u.user_role_id = ur.id
      LEFT JOIN course c ON u.course_id = c.id
      LEFT JOIN batch b ON c.batch_id = b.id
      LEFT JOIN attachment a ON u.profile_image_id = a.id
      WHERE u.id = ? AND u.is_deleted = FALSE`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = rows[0];
    const rawImg = user.profile_image_data;
    if (rawImg != null && rawImg !== '') {
      const b64 = Buffer.isBuffer(rawImg) ? rawImg.toString('base64') : String(rawImg);
      user.profile_image = b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
    } else {
      user.profile_image = null;
    }
    delete user.profile_image_data;

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create user
router.post('/', async (req, res) => {
  try {
    const {
      course_id,
      user_role_id,
      registration_no,
      application_date,
      name,
      guardian_name,
      relationship_with_guardian,
      occupation_of_guardian,
      permanent_address,
      local_address,
      personal_number,
      home_number,
      date_of_birth,
      gender,
      marital_status,
      religion,
      caste,
      educational_qualification,
      email,
      class_time,
      course_fee,
      fee_details,
      admitted_by,
      remarks,
      profile_image_id,
      profile_image,
      is_active = true,
      payment_mode,
      adjustment_amount,
      created_by
    } = req.body;

    const toNull = (v) => (v === undefined || v === '') ? null : v;

    let finalProfileImageId = (profile_image_id === undefined || profile_image_id === '') ? null : profile_image_id;
    if (profile_image) {
      const data = extractBase64(profile_image);
      if (data) {
        const [ins] = await db.execute(
          `INSERT INTO attachment (file_name, file_type, base64_data, created_by) VALUES (?, ?, ?, ?)`,
          ['profile', 'image/png', data, toNull(created_by)]
        );
        finalProfileImageId = ins.insertId;
      }
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    if (!user_role_id) {
      return res.status(400).json({ success: false, error: 'User role is required' });
    }
    const [result] = await db.execute(
      `INSERT INTO user (
        course_id, user_role_id, registration_no, application_date, name,
        guardian_name, relationship_with_guardian, occupation_of_guardian,
        permanent_address, local_address, personal_number, home_number,
        date_of_birth, gender, marital_status, religion, caste,
        educational_qualification, email, class_time, course_fee, fee_details,
        admitted_by, remarks, profile_image_id, is_active,
        payment_mode, adjustment_amount, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        toNull(course_id), user_role_id, toNull(registration_no), toNull(application_date), name.trim(),
        toNull(guardian_name), toNull(relationship_with_guardian), toNull(occupation_of_guardian),
        toNull(permanent_address), toNull(local_address), toNull(personal_number), toNull(home_number),
        toNull(date_of_birth), toNull(gender), toNull(marital_status), toNull(religion), toNull(caste),
        toNull(educational_qualification), toNull(email), toNull(class_time), toNull(course_fee), toNull(fee_details),
        toNull(admitted_by), toNull(remarks), toNull(finalProfileImageId), !!is_active,
        toNull(payment_mode), toNull(adjustment_amount), toNull(created_by)
      ]
    );

    console.log('[USER CREATE] Saved successfully, id:', result.insertId);

    const [newUser] = await db.execute(
      `SELECT 
        u.*,
        ur.role_name,
        c.course_name,
        c.course_code
      FROM user u
      LEFT JOIN user_role ur ON u.user_role_id = ur.id
      LEFT JOIN course c ON u.course_id = c.id
      WHERE u.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, data: newUser[0] });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update user (merges body with existing user so partial updates e.g. Settings do not null required columns)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const [existingRows] = await db.execute(
      `SELECT id, user_role_id, course_id, registration_no, application_date, name,
        guardian_name, relationship_with_guardian, occupation_of_guardian,
        permanent_address, local_address, personal_number, home_number,
        date_of_birth, gender, marital_status, religion, caste, educational_qualification,
        email, class_time, course_fee, fee_details, admitted_by, remarks,
        profile_image_id, is_active, payment_mode, adjustment_amount
      FROM user WHERE id = ? AND is_deleted = FALSE`,
      [id]
    );
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const existing = existingRows[0];
    const getExisting = (key) => existing[key];

    const toNull = (v) => (v === undefined || v === '') ? null : v;
    const use = (bodyVal, existingVal) => (bodyVal !== undefined && bodyVal !== null) ? (bodyVal === '' ? null : bodyVal) : existingVal;

    const name = use(body.name, existing.name);
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    let finalProfileImageId = use(body.profile_image_id, getExisting('profile_image_id'));
    if (body.profile_image) {
      const data = extractBase64(body.profile_image);
      if (data) {
        const [ins] = await db.execute(
          `INSERT INTO attachment (file_name, file_type, base64_data, created_by) VALUES (?, ?, ?, ?)`,
          ['profile', 'image/png', data, toNull(body.modified_by)]
        );
        finalProfileImageId = ins.insertId;
      }
    }

    const course_id = use(body.course_id, getExisting('course_id'));
    const user_role_id = use(body.user_role_id, getExisting('user_role_id'));
    const registration_no = use(body.registration_no, getExisting('registration_no'));
    const application_date = use(body.application_date, getExisting('application_date'));
    const guardian_name = use(body.guardian_name, getExisting('guardian_name'));
    const relationship_with_guardian = use(body.relationship_with_guardian, getExisting('relationship_with_guardian'));
    const occupation_of_guardian = use(body.occupation_of_guardian, getExisting('occupation_of_guardian'));
    const permanent_address = use(body.permanent_address, getExisting('permanent_address'));
    const local_address = use(body.local_address, getExisting('local_address'));
    const personal_number = use(body.personal_number, getExisting('personal_number'));
    const home_number = use(body.home_number, getExisting('home_number'));
    const date_of_birth = use(body.date_of_birth, getExisting('date_of_birth'));
    const gender = use(body.gender, getExisting('gender'));
    const marital_status = use(body.marital_status, getExisting('marital_status'));
    const religion = use(body.religion, getExisting('religion'));
    const caste = use(body.caste, getExisting('caste'));
    const educational_qualification = use(body.educational_qualification, getExisting('educational_qualification'));
    const email = use(body.email, getExisting('email'));
    const class_time = use(body.class_time, getExisting('class_time'));
    const course_fee = use(body.course_fee, getExisting('course_fee'));
    const fee_details = use(body.fee_details, getExisting('fee_details'));
    const admitted_by = use(body.admitted_by, getExisting('admitted_by'));
    const remarks = use(body.remarks, getExisting('remarks'));
    const is_active = body.is_active !== undefined ? (body.is_active !== false) : getExisting('is_active');
    const payment_mode = body.payment_mode !== undefined ? body.payment_mode : getExisting('payment_mode');
    const adjustment_amount = body.adjustment_amount !== undefined ? body.adjustment_amount : getExisting('adjustment_amount');
    const modified_by = toNull(body.modified_by);

    await db.execute(
      `UPDATE user SET
        course_id = ?, user_role_id = ?, registration_no = ?, application_date = ?, name = ?,
        guardian_name = ?, relationship_with_guardian = ?, occupation_of_guardian = ?,
        permanent_address = ?, local_address = ?, personal_number = ?, home_number = ?,
        date_of_birth = ?, gender = ?, marital_status = ?, religion = ?, caste = ?,
        educational_qualification = ?, email = ?, class_time = ?, course_fee = ?, fee_details = ?,
        admitted_by = ?, remarks = ?, profile_image_id = ?, is_active = ?,
        payment_mode = ?, adjustment_amount = ?, modified_by = ?
      WHERE id = ? AND is_deleted = FALSE`,
      [
        toNull(course_id), toNull(user_role_id), toNull(registration_no), toNull(application_date), name.trim(),
        toNull(guardian_name), toNull(relationship_with_guardian), toNull(occupation_of_guardian),
        toNull(permanent_address), toNull(local_address), toNull(personal_number), toNull(home_number),
        toNull(date_of_birth), toNull(gender), toNull(marital_status), toNull(religion), toNull(caste),
        toNull(educational_qualification), toNull(email), toNull(class_time), toNull(course_fee), toNull(fee_details),
        toNull(admitted_by), toNull(remarks), finalProfileImageId, is_active !== false,
        toNull(payment_mode), toNull(adjustment_amount), toNull(modified_by), id
      ]
    );

    const [updatedUser] = await db.execute(
      `SELECT 
        u.*,
        ur.role_name,
        c.course_name,
        c.course_code,
        a.base64_data as profile_image_data
      FROM user u
      LEFT JOIN user_role ur ON u.user_role_id = ur.id
      LEFT JOIN course c ON u.course_id = c.id
      LEFT JOIN attachment a ON u.profile_image_id = a.id
      WHERE u.id = ?`,
      [id]
    );

    const user = updatedUser[0];
    if (user && user.profile_image_data) {
      user.profile_image = `data:image/png;base64,${Buffer.isBuffer(user.profile_image_data) ? user.profile_image_data.toString('base64') : user.profile_image_data}`;
    } else if (user) {
      user.profile_image = null;
    }
    if (user) delete user.profile_image_data;

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete user (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { deleted_by } = req.body;

    await db.execute(
      `UPDATE user SET is_deleted = TRUE, deleted_by = ?, deleted_date = NOW() WHERE id = ?`,
      [deleted_by, id]
    );

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
