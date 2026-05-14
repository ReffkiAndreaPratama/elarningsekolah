const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../database/connection');
const { authenticate, authorize } = require('../middleware/auth');
const { success, error, paginated } = require('../utils/response');

// GET /users - admin only
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE (name LIKE ? OR email LIKE ?)';
    let params = [`%${search}%`, `%${search}%`];

    if (role) {
      whereClause += ' AND role = ?';
      params.push(role);
    }

    const [users] = await pool.query(
      `SELECT id, name, email, role, phone, is_active, created_at FROM users ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      params
    );

    return paginated(res, users, total, page, limit);
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// GET /users/students - get all students (for enrollment)
router.get('/students', authenticate, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { search = '', class_id } = req.query;
    let query, params;

    if (class_id) {
      // Students NOT in this class
      query = `
        SELECT id, name, email FROM users 
        WHERE role = 'student' AND is_active = TRUE
        AND id NOT IN (SELECT student_id FROM enrollments WHERE class_id = ?)
        AND (name LIKE ? OR email LIKE ?)
        ORDER BY name LIMIT 50
      `;
      params = [class_id, `%${search}%`, `%${search}%`];
    } else {
      query = `SELECT id, name, email FROM users WHERE role = 'student' AND is_active = TRUE AND (name LIKE ? OR email LIKE ?) ORDER BY name LIMIT 50`;
      params = [`%${search}%`, `%${search}%`];
    }

    const [students] = await pool.query(query, params);
    return success(res, students);
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// GET /users/teachers
router.get('/teachers', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [teachers] = await pool.query(
      `SELECT id, name, email FROM users WHERE role = 'teacher' AND is_active = TRUE ORDER BY name`
    );
    return success(res, teachers);
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// GET /users/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'student' && req.user.id !== parseInt(req.params.id)) {
      return error(res, 'Not authorized', 403);
    }

    const [rows] = await pool.query(
      'SELECT id, name, email, role, avatar, phone, is_active, created_at FROM users WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) return error(res, 'User not found', 404);
    return success(res, rows[0]);
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// POST /users - admin creates user
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return error(res, 'Email already exists', 409);

    const hashed = await bcrypt.hash(password || 'password123', 12);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashed, role, phone]
    );

    const [user] = await pool.query(
      'SELECT id, name, email, role, phone, created_at FROM users WHERE id = ?',
      [result.insertId]
    );
    return success(res, user[0], 'User created', 201);
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// PUT /users/:id
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, email, role, phone, is_active } = req.body;
    await pool.query(
      `UPDATE users SET 
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        role = COALESCE(?, role),
        phone = COALESCE(?, phone),
        is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [name, email, role, phone, is_active, req.params.id]
    );
    const [updated] = await pool.query(
      'SELECT id, name, email, role, phone, is_active FROM users WHERE id = ?',
      [req.params.id]
    );
    return success(res, updated[0], 'User updated');
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// DELETE /users/:id
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    if (req.user.id === parseInt(req.params.id)) {
      return error(res, 'Cannot delete your own account', 400);
    }
    await pool.query('UPDATE users SET is_active = FALSE WHERE id = ?', [req.params.id]);
    return success(res, null, 'User deactivated');
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

module.exports = router;
