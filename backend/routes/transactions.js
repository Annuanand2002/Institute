const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get all transactions
router.get('/', async (req, res) => {
  try {
    const { user_id, transtype, transtypes, start_date, end_date, search } = req.query;
    let query = `
      SELECT 
        t.*,
        u.name as user_name,
        u.registration_no,
        c.course_name,
        c.course_code
      FROM transactions t
      LEFT JOIN user u ON t.user_id = u.id
      LEFT JOIN course c ON u.course_id = c.id
      WHERE t.is_deleted = FALSE
    `;
    const params = [];

    if (user_id) {
      query += ` AND t.user_id = ?`;
      params.push(user_id);
    }

    if (transtype) {
      query += ` AND t.transtype = ?`;
      params.push(transtype);
    }
    if (transtypes) {
      const types = String(transtypes).split(',').map(s => s.trim()).filter(Boolean);
      if (types.length > 0) {
        query += ` AND t.transtype IN (${types.map(() => '?').join(',')})`;
        params.push(...types);
      }
    }

    if (start_date) {
      query += ` AND t.transaction_date >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND t.transaction_date <= ?`;
      params.push(end_date);
    }

    if (search) {
      query += ` AND (u.name LIKE ? OR u.registration_no LIKE ? OR t.reference_number LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY t.transaction_date DESC, t.created_date DESC`;

    const [rows] = await db.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get transaction by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute(
      `SELECT 
        t.*,
        u.name as user_name,
        u.registration_no,
        c.course_name,
        c.course_code
      FROM transactions t
      LEFT JOIN user u ON t.user_id = u.id
      LEFT JOIN course c ON u.course_id = c.id
      WHERE t.id = ? AND t.is_deleted = FALSE`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create transaction
router.post('/', async (req, res) => {
  try {
    const {
      user_id,
      transaction_date,
      payment_mode,
      amount,
      transtype,
      reference_number,
      remarks,
      created_by
    } = req.body;

    if (!user_id) {
      return res.status(400).json({ success: false, error: 'Student (user) is required' });
    }
    if (!transaction_date) {
      return res.status(400).json({ success: false, error: 'Transaction date is required' });
    }
    if (!payment_mode || typeof payment_mode !== 'string') {
      return res.status(400).json({ success: false, error: 'Payment mode is required' });
    }
    if (amount == null || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Valid amount is required' });
    }

    const toNull = (v) => (v === undefined || v === '') ? null : v;
    const [result] = await db.execute(
      `INSERT INTO transactions (
        user_id, transaction_date, payment_mode, amount, transtype, reference_number, remarks, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, transaction_date, payment_mode, parseFloat(amount), toNull(transtype), toNull(reference_number), toNull(remarks), toNull(created_by)]
    );

    console.log('[TRANSACTION CREATE] Saved successfully, id:', result.insertId);

    const [newTransaction] = await db.execute(
      `SELECT 
        t.*,
        u.name as user_name,
        u.registration_no,
        c.course_name,
        c.course_code
      FROM transactions t
      LEFT JOIN user u ON t.user_id = u.id
      LEFT JOIN course c ON u.course_id = c.id
      WHERE t.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, data: newTransaction[0] });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update transaction
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      user_id,
      transaction_date,
      payment_mode,
      amount,
      transtype,
      reference_number,
      remarks,
      modified_by
    } = req.body;

    await db.execute(
      `UPDATE transactions SET
        user_id = ?, transaction_date = ?, payment_mode = ?, amount = ?,
        transtype = ?, reference_number = ?, remarks = ?, modified_by = ?
      WHERE id = ? AND is_deleted = FALSE`,
      [user_id, transaction_date, payment_mode, amount, transtype, reference_number, remarks, modified_by, id]
    );

    const [updatedTransaction] = await db.execute(
      `SELECT 
        t.*,
        u.name as user_name,
        u.registration_no,
        c.course_name,
        c.course_code
      FROM transactions t
      LEFT JOIN user u ON t.user_id = u.id
      LEFT JOIN course c ON u.course_id = c.id
      WHERE t.id = ?`,
      [id]
    );

    res.json({ success: true, data: updatedTransaction[0] });
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete transaction (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { deleted_by } = req.body;

    await db.execute(
      `UPDATE transactions SET is_deleted = TRUE, deleted_by = ?, deleted_date = NOW() WHERE id = ?`,
      [deleted_by, id]
    );

    res.json({ success: true, message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
