const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const pool = require('../database/connection');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { success, error } = require('../utils/response');

// GET /materials/:classId
router.get('/:classId', authenticate, async (req, res) => {
  try {
    // Verify access
    if (req.user.role === 'student') {
      const [enrollment] = await pool.query(
        'SELECT id FROM enrollments WHERE student_id = ? AND class_id = ?',
        [req.user.id, req.params.classId]
      );
      if (!enrollment.length) return error(res, 'Not enrolled in this class', 403);
    }

    const [materials] = await pool.query(
      `SELECT m.*, u.name as uploaded_by_name
       FROM materials m
       JOIN users u ON m.uploaded_by = u.id
       WHERE m.class_id = ? AND m.is_published = TRUE
       ORDER BY m.created_at DESC`,
      [req.params.classId]
    );

    return success(res, materials);
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// POST /materials - upload material
router.post('/', authenticate, authorize('admin', 'teacher'), upload.single('file'), async (req, res) => {
  try {
    const { class_id, title, description, type, content, url } = req.body;

    let filePath = null;
    let fileName = null;
    let fileSize = null;

    if (req.file) {
      filePath = req.file.path.replace(/\\/g, '/');
      fileName = req.file.originalname;
      fileSize = req.file.size;
    }

    const [result] = await pool.query(
      `INSERT INTO materials (class_id, title, description, type, file_path, file_name, file_size, content, url, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [class_id, title, description, type || 'text', filePath, fileName, fileSize, content, url, req.user.id]
    );

    const [material] = await pool.query('SELECT * FROM materials WHERE id = ?', [result.insertId]);
    return success(res, material[0], 'Material uploaded', 201);
  } catch (err) {
    console.error(err);
    return error(res, 'Server error', 500);
  }
});

// PUT /materials/:id
router.put('/:id', authenticate, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { title, description, content, url, is_published } = req.body;
    await pool.query(
      `UPDATE materials SET 
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        content = COALESCE(?, content),
        url = COALESCE(?, url),
        is_published = COALESCE(?, is_published)
       WHERE id = ? AND uploaded_by = ?`,
      [title, description, content, url, is_published, req.params.id, req.user.id]
    );
    const [updated] = await pool.query('SELECT * FROM materials WHERE id = ?', [req.params.id]);
    return success(res, updated[0], 'Material updated');
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// DELETE /materials/:id
router.delete('/:id', authenticate, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const [material] = await pool.query('SELECT * FROM materials WHERE id = ?', [req.params.id]);
    if (!material.length) return error(res, 'Material not found', 404);

    // Delete file if exists
    if (material[0].file_path && fs.existsSync(material[0].file_path)) {
      fs.unlinkSync(material[0].file_path);
    }

    await pool.query('DELETE FROM materials WHERE id = ?', [req.params.id]);
    return success(res, null, 'Material deleted');
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// GET /materials/file/:id - serve file
router.get('/file/:id', authenticate, async (req, res) => {
  try {
    const [material] = await pool.query('SELECT * FROM materials WHERE id = ?', [req.params.id]);
    if (!material.length || !material[0].file_path) return error(res, 'File not found', 404);

    const filePath = path.resolve(material[0].file_path);
    if (!fs.existsSync(filePath)) return error(res, 'File not found on server', 404);

    res.download(filePath, material[0].file_name || 'download');
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

module.exports = router;
