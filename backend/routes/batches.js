const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get all batches
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT * FROM batch
      WHERE is_deleted = FALSE
    `;
    const params = [];

    if (search) {
      query += ` AND (batch_name LIKE ? OR batch_code LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ` ORDER BY created_date DESC`;

    const [rows] = await db.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching batches:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get batch by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute(
      `SELECT * FROM batch WHERE id = ? AND is_deleted = FALSE`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error fetching batch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create batch
router.post('/', async (req, res) => {
  try {
    const { batch_code, batch_name, created_by } = req.body;

    if (!batch_code || !batch_name || typeof batch_code !== 'string' || typeof batch_name !== 'string') {
      return res.status(400).json({ success: false, error: 'Batch code and batch name are required' });
    }
    if (batch_code.trim().length === 0 || batch_name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Batch code and batch name cannot be empty' });
    }

    const [result] = await db.execute(
      `INSERT INTO batch (batch_code, batch_name, created_by) VALUES (?, ?, ?)`,
      [batch_code.trim(), batch_name.trim(), created_by || null]
    );

    console.log('[BATCH CREATE] Saved successfully, id:', result.insertId);

    const [newBatch] = await db.execute(
      `SELECT * FROM batch WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, data: newBatch[0] });
  } catch (error) {
    console.error('Error creating batch:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, error: 'Batch code already exists' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update batch
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { batch_code, batch_name, modified_by } = req.body;

    await db.execute(
      `UPDATE batch SET batch_code = ?, batch_name = ?, modified_by = ? WHERE id = ? AND is_deleted = FALSE`,
      [batch_code, batch_name, modified_by, id]
    );

    const [updatedBatch] = await db.execute(
      `SELECT * FROM batch WHERE id = ?`,
      [id]
    );

    res.json({ success: true, data: updatedBatch[0] });
  } catch (error) {
    console.error('Error updating batch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete batch (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { deleted_by } = req.body;

    await db.execute(
      `UPDATE batch SET is_deleted = TRUE, deleted_by = ?, deleted_date = NOW() WHERE id = ?`,
      [deleted_by, id]
    );

    res.json({ success: true, message: 'Batch deleted successfully' });
  } catch (error) {
    console.error('Error deleting batch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
