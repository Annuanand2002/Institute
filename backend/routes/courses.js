const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get all courses
router.get('/', async (req, res) => {
  try {
    const { batch_id, is_active, search } = req.query;
    let query = `
      SELECT 
        c.*,
        b.batch_name,
        b.batch_code
      FROM course c
      LEFT JOIN batch b ON c.batch_id = b.id
      WHERE c.is_deleted = FALSE
    `;
    const params = [];

    if (batch_id) {
      query += ` AND c.batch_id = ?`;
      params.push(batch_id);
    }

    if (is_active !== undefined) {
      query += ` AND c.is_active = ?`;
      params.push(is_active === 'true');
    }

    if (search) {
      query += ` AND (c.course_name LIKE ? OR c.course_code LIKE ? OR c.description LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY c.created_date DESC`;

    const [rows] = await db.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get course by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute(
      `SELECT 
        c.*,
        b.batch_name,
        b.batch_code
      FROM course c
      LEFT JOIN batch b ON c.batch_id = b.id
      WHERE c.id = ? AND c.is_deleted = FALSE`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Course not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create course
router.post('/', async (req, res) => {
  try {
    const {
      course_code,
      course_name,
      description,
      duration,
      total_fee,
      batch_id,
      is_active = true,
      created_by
    } = req.body;

    if (!course_name || typeof course_name !== 'string' || course_name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Course name is required' });
    }
    if (batch_id == null || Number.isNaN(Number(batch_id)) || Number(batch_id) <= 0) {
      return res.status(400).json({ success: false, error: 'Batch is required' });
    }
    if (duration == null || Number.isNaN(Number(duration)) || Number(duration) <= 0) {
      return res.status(400).json({ success: false, error: 'Duration is required' });
    }
    if (total_fee == null || Number.isNaN(Number(total_fee)) || Number(total_fee) <= 0) {
      return res.status(400).json({ success: false, error: 'Total fee is required' });
    }
    if (is_active === null || is_active === undefined || (is_active !== true && is_active !== false && is_active !== 1 && is_active !== 0)) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }

    const [result] = await db.execute(
      `INSERT INTO course (
        course_code, course_name, description, duration, total_fee, batch_id, is_active, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        course_code || null,
        course_name.trim(),
        description || null,
        Number(duration),
        Number(total_fee),
        Number(batch_id),
        !!is_active,
        created_by || null
      ]
    );

    console.log('[COURSE CREATE] Saved successfully, id:', result.insertId);

    const [newCourse] = await db.execute(
      `SELECT 
        c.*,
        b.batch_name,
        b.batch_code
      FROM course c
      LEFT JOIN batch b ON c.batch_id = b.id
      WHERE c.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, data: newCourse[0] });
  } catch (error) {
    console.error('Error creating course:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, error: 'Course code already exists' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update course
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      course_code,
      course_name,
      description,
      duration,
      total_fee,
      batch_id,
      is_active,
      modified_by
    } = req.body;

    await db.execute(
      `UPDATE course SET
        course_code = ?, course_name = ?, description = ?, duration = ?,
        total_fee = ?, batch_id = ?, is_active = ?, modified_by = ?
      WHERE id = ? AND is_deleted = FALSE`,
      [course_code, course_name, description, duration, total_fee, batch_id, is_active, modified_by, id]
    );

    const [updatedCourse] = await db.execute(
      `SELECT 
        c.*,
        b.batch_name,
        b.batch_code
      FROM course c
      LEFT JOIN batch b ON c.batch_id = b.id
      WHERE c.id = ?`,
      [id]
    );

    res.json({ success: true, data: updatedCourse[0] });
  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete course (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { deleted_by } = req.body;

    await db.execute(
      `UPDATE course SET is_deleted = TRUE, deleted_by = ?, deleted_date = NOW() WHERE id = ?`,
      [deleted_by, id]
    );

    res.json({ success: true, message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
