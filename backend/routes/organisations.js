const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Helper to extract base64 from data URL
function extractBase64(data) {
  if (!data) return null;
  if (typeof data === 'string' && data.includes(',')) {
    return data.split(',')[1];
  }
  return data;
}

// Helper to create attachment from base64/data URL (uses conn if provided for transaction)
async function createAttachment(base64Data, fileName, fileType, createdBy, conn) {
  const data = extractBase64(base64Data);
  if (!data) return null;
  const executor = conn || db;
  const [result] = await executor.execute(
    `INSERT INTO attachment (file_name, file_type, base64_data, created_by) VALUES (?, ?, ?, ?)`,
    [fileName || 'image', fileType || 'image/png', data, createdBy]
  );
  return result.insertId;
}

// Soft-delete an attachment (so we always use the current image, not old ones)
async function softDeleteAttachment(attachmentId, deletedBy, conn) {
  if (!attachmentId) return;
  const executor = conn || db;
  await executor.execute(
    `UPDATE attachment SET deleted_by = ?, deleted_date = NOW() WHERE id = ?`,
    [deletedBy ?? null, attachmentId]
  );
}

// Get all organisations (without large base64 in list)
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT o.id, o.org_code, o.org_name, o.description, o.phone_number, o.email, 
        o.address, o.website, o.created_date, o.modified_date
      FROM organization o
      WHERE o.is_deleted = FALSE
    `;
    const params = [];

    if (search) {
      query += ` AND (o.org_name LIKE ? OR o.org_code LIKE ? OR o.email LIKE ? OR o.address LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY o.created_date DESC`;

    const [rows] = await db.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching organisations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get organisation by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute(
      `SELECT o.*, 
        a_logo.base64_data as logo_data,
        a_header.base64_data as header_data,
        a_footer.base64_data as footer_data,
        a_seal.base64_data as seal_data
      FROM organization o
      LEFT JOIN attachment a_logo ON o.logo_id = a_logo.id AND (a_logo.deleted_date IS NULL)
      LEFT JOIN attachment a_header ON o.header_id = a_header.id AND (a_header.deleted_date IS NULL)
      LEFT JOIN attachment a_footer ON o.footer_id = a_footer.id AND (a_footer.deleted_date IS NULL)
      LEFT JOIN attachment a_seal ON o.seal_id = a_seal.id AND (a_seal.deleted_date IS NULL)
      WHERE o.id = ? AND o.is_deleted = FALSE`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Organisation not found' });
    }

    const org = rows[0];
    const toDataUrl = (buf) => buf ? `data:image/png;base64,${Buffer.isBuffer(buf) ? buf.toString('base64') : buf}` : null;
    if (org.logo_data) org.logo = toDataUrl(org.logo_data);
    if (org.header_data) org.header = toDataUrl(org.header_data);
    if (org.footer_data) org.footer = toDataUrl(org.footer_data);
    if (org.seal_data) org.seal = toDataUrl(org.seal_data);
    delete org.logo_data;
    delete org.header_data;
    delete org.footer_data;
    delete org.seal_data;

    res.json({ success: true, data: org });
  } catch (error) {
    console.error('Error fetching organisation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create organisation
router.post('/', async (req, res) => {
  let connection;
  try {
    console.log('[ORG CREATE] Request received, org_name:', req.body?.org_name || '(empty)');
    const {
      org_code, org_name, description, phone_number, email, address, website,
      logo, header, footer, seal, created_by
    } = req.body;

    // Validate required fields per schema (org_code NOT NULL UNIQUE, org_name NOT NULL)
    if (!org_name || typeof org_name !== 'string' || org_name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Organisation name (org_name) is required' });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const code = (org_code && org_code.trim()) ? org_code.trim() : `ORG${Date.now()}`;
    let logoId = null, headerId = null, footerId = null, sealId = null;
    const createdBy = created_by != null ? created_by : null;

    if (logo) logoId = await createAttachment(logo, 'logo', 'image/png', createdBy, connection);
    if (header) headerId = await createAttachment(header, 'header', 'image/png', createdBy, connection);
    if (footer) footerId = await createAttachment(footer, 'footer', 'image/png', createdBy, connection);
    if (seal) sealId = await createAttachment(seal, 'seal', 'image/png', createdBy, connection);

    await connection.execute(
      `INSERT INTO organization (
        org_code, org_name, description, phone_number, email, address, website,
        logo_id, header_id, footer_id, seal_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code,
        org_name.trim(),
        description || null,
        phone_number || null,
        email || null,
        address || null,
        website || null,
        logoId,
        headerId,
        footerId,
        sealId,
        createdBy
      ]
    );

    const [result] = await connection.execute('SELECT LAST_INSERT_ID() as id');
    await connection.commit();
    connection.release();

    const [newOrg] = await db.execute(
      `SELECT * FROM organization WHERE id = ?`,
      [result[0].id]
    );

    console.log('[ORG CREATE] Saved successfully, id:', result[0].id);
    res.status(201).json({ success: true, data: newOrg[0] });
  } catch (error) {
    console.error('[ORG CREATE] Error:', error.message);
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('Error creating organisation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update organisation
router.put('/:id', async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const { id } = req.params;
    const {
      org_code, org_name, description, phone_number, email, address, website,
      logo, header, footer, seal, modified_by
    } = req.body;

    const [existing] = await connection.execute(
      'SELECT logo_id, header_id, footer_id, seal_id FROM organization WHERE id = ? AND is_deleted = FALSE',
      [id]
    );
    if (existing.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, error: 'Organisation not found' });
    }

    let logoId = existing[0].logo_id;
    let headerId = existing[0].header_id;
    let footerId = existing[0].footer_id;
    let sealId = existing[0].seal_id;

    // When replacing an image, soft-delete the old attachment so only the new one is used
    if (logo && logoId) {
      await softDeleteAttachment(logoId, modified_by, connection);
      logoId = null;
    }
    if (header && headerId) {
      await softDeleteAttachment(headerId, modified_by, connection);
      headerId = null;
    }
    if (footer && footerId) {
      await softDeleteAttachment(footerId, modified_by, connection);
      footerId = null;
    }
    if (seal && sealId) {
      await softDeleteAttachment(sealId, modified_by, connection);
      sealId = null;
    }

    if (logo) {
      logoId = await createAttachment(logo, 'logo', 'image/png', modified_by, connection);
    }
    if (header) {
      headerId = await createAttachment(header, 'header', 'image/png', modified_by, connection);
    }
    if (footer) {
      footerId = await createAttachment(footer, 'footer', 'image/png', modified_by, connection);
    }
    if (seal) {
      sealId = await createAttachment(seal, 'seal', 'image/png', modified_by, connection);
    }

    await connection.execute(
      `UPDATE organization SET
        org_code = COALESCE(?, org_code),
        org_name = COALESCE(?, org_name),
        description = ?, phone_number = ?, email = ?, address = ?, website = ?,
        logo_id = COALESCE(?, logo_id), header_id = COALESCE(?, header_id),
        footer_id = COALESCE(?, footer_id), seal_id = COALESCE(?, seal_id),
        modified_by = ?, modified_date = NOW()
      WHERE id = ? AND is_deleted = FALSE`,
      [org_code, org_name, description || null, phone_number || null, email || null, address || null,
        website || null, logoId, headerId, footerId, sealId, modified_by, id]
    );

    await connection.commit();
    connection.release();

    const [updated] = await db.execute('SELECT * FROM organization WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('Error updating organisation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Organisation cannot be deleted once set; only edited
router.delete('/:id', async (req, res) => {
  try {
    res.status(403).json({
      success: false,
      error: 'Organisation cannot be deleted. You can only edit it.'
    });
  } catch (error) {
    console.error('Error deleting organisation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
