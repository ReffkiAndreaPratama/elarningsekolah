const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../database/connection');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');

// POST /auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, 'Validation failed', 400, errors.array());
  }

  try {
    const { email, password } = req.body;

    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
      [email]
    );

    if (!rows.length) {
      return error(res, 'Invalid email or password', 401);
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return error(res, 'Invalid email or password', 401);
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const { password: _, ...userWithoutPassword } = user;

    return success(res, { token, user: userWithoutPassword }, 'Login successful');
  } catch (err) {
    console.error('Login error:', err);
    return error(res, 'Server error', 500);
  }
});

// POST /auth/register (admin only in production, open for demo)
router.post('/register', [
  body('name').trim().isLength({ min: 2 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['admin', 'teacher', 'student'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, 'Validation failed', 400, errors.array());
  }

  try {
    const { name, email, password, role } = req.body;

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return error(res, 'Email already registered', 409);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, role]
    );

    const [newUser] = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    return success(res, newUser[0], 'Registration successful', 201);
  } catch (err) {
    console.error('Register error:', err);
    return error(res, 'Server error', 500);
  }
});

// GET /auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, avatar, phone, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    return success(res, rows[0]);
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// PUT /auth/profile
router.put('/profile', authenticate, [
  body('name').optional().trim().isLength({ min: 2 }),
  body('phone').optional().isMobilePhone()
], async (req, res) => {
  try {
    const { name, phone } = req.body;
    await pool.query(
      'UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone) WHERE id = ?',
      [name, phone, req.user.id]
    );
    const [updated] = await pool.query(
      'SELECT id, name, email, role, avatar, phone FROM users WHERE id = ?',
      [req.user.id]
    );
    return success(res, updated[0], 'Profile updated');
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// PUT /auth/change-password
router.put('/change-password', authenticate, [
  body('currentPassword').isLength({ min: 6 }),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
    if (!isMatch) return error(res, 'Current password is incorrect', 400);

    const hashed = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);
    return success(res, null, 'Password changed successfully');
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

module.exports = router;
