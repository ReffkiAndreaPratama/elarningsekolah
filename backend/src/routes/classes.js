const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../database/connection');
const { authenticate, authorize } = require('../middleware/auth');
const { success, error, paginated } = require('../utils/response');

// GET /classes - list classes based on role
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (page - 1) * limit;
    let query, params;

    if (req.user.role === 'admin') {
      query = `
        SELECT c.*, u.name as teacher_name, u.email as teacher_email,
          (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = c.id) as student_count
        FROM classes c
        JOIN users u ON c.teacher_id = u.id
        WHERE c.name LIKE ? OR c.subject LIKE ?
        ORDER BY c.created_at DESC LIMIT ? OFFSET ?
      `;
      params = [`%${search}%`, `%${search}%`, parseInt(limit), offset];
    } else if (req.user.role === 'teacher') {
      query = `
        SELECT c.*, u.name as teacher_name,
          (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = c.id) as student_count
        FROM classes c
        JOIN users u ON c.teacher_id = u.id
        WHERE c.teacher_id = ? AND (c.name LIKE ? OR c.subject LIKE ?)
        ORDER BY c.created_at DESC LIMIT ? OFFSET ?
      `;
      params = [req.user.id, `%${search}%`, `%${search}%`, parseInt(limit), offset];
    } else {
      // Student - get enrolled classes
      query = `
        SELECT c.*, u.name as teacher_name,
          (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = c.id) as student_count
        FROM classes c
        JOIN users u ON c.teacher_id = u.id
        JOIN enrollments en ON en.class_id = c.id
        WHERE en.student_id = ? AND (c.name LIKE ? OR c.subject LIKE ?)
        ORDER BY c.created_at DESC LIMIT ? OFFSET ?
      `;
      params = [req.user.id, `%${search}%`, `%${search}%`, parseInt(limit), offset];
    }

    const [classes] = await pool.query(query, params);

    // Count query
    let countQuery, countParams;
    if (req.user.role === 'admin') {
      countQuery = 'SELECT COUNT(*) as total FROM classes WHERE name LIKE ? OR subject LIKE ?';
      countParams = [`%${search}%`, `%${search}%`];
    } else if (req.user.role === 'teacher') {
      countQuery = 'SELECT COUNT(*) as total FROM classes WHERE teacher_id = ? AND (name LIKE ? OR subject LIKE ?)';
      countParams = [req.user.id, `%${search}%`, `%${search}%`];
    } else {
      countQuery = 'SELECT COUNT(*) as total FROM enrollments en JOIN classes c ON en.class_id = c.id WHERE en.student_id = ? AND (c.name LIKE ? OR c.subject LIKE ?)';
      countParams = [req.user.id, `%${search}%`, `%${search}%`];
    }

    const [[{ total }]] = await pool.query(countQuery, countParams);
    return paginated(res, classes, total, page, limit);
  } catch (err) {
    console.error(err);
    return error(res, 'Server error', 500);
  }
});

// GET /classes/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, u.name as teacher_name, u.email as teacher_email,
        (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = c.id) as student_count
      FROM classes c
      JOIN users u ON c.teacher_id = u.id
      WHERE c.id = ?
    `, [req.params.id]);

    if (!rows.length) return error(res, 'Class not found', 404);

    // Get schedules
    const [schedules] = await pool.query(
      'SELECT * FROM schedules WHERE class_id = ? ORDER BY FIELD(day_of_week, "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday")',
      [req.params.id]
    );

    // Get enrolled students
    const [students] = await pool.query(`
      SELECT u.id, u.name, u.email, u.avatar, en.enrolled_at
      FROM users u
      JOIN enrollments en ON en.student_id = u.id
      WHERE en.class_id = ?
      ORDER BY u.name
    `, [req.params.id]);

    return success(res, { ...rows[0], schedules, students });
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// POST /classes - create class (admin, teacher)
router.post('/', authenticate, authorize('admin', 'teacher'), [
  body('name').trim().isLength({ min: 2 }),
  body('subject').trim().isLength({ min: 2 }),
  body('teacher_id').optional().isInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, 'Validation failed', 400, errors.array());

  try {
    const { name, subject, description, room, grade_level, school_year, teacher_id } = req.body;
    const assignedTeacherId = req.user.role === 'admin' ? (teacher_id || req.user.id) : req.user.id;

    const [result] = await pool.query(
      'INSERT INTO classes (name, subject, description, teacher_id, room, grade_level, school_year) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, subject, description, assignedTeacherId, room, grade_level, school_year]
    );

    const [newClass] = await pool.query('SELECT * FROM classes WHERE id = ?', [result.insertId]);
    return success(res, newClass[0], 'Class created', 201);
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// PUT /classes/:id
router.put('/:id', authenticate, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { name, subject, description, room, grade_level, school_year, teacher_id } = req.body;

    // Teachers can only edit their own classes
    if (req.user.role === 'teacher') {
      const [cls] = await pool.query('SELECT teacher_id FROM classes WHERE id = ?', [req.params.id]);
      if (!cls.length || cls[0].teacher_id !== req.user.id) {
        return error(res, 'Not authorized', 403);
      }
    }

    await pool.query(
      `UPDATE classes SET 
        name = COALESCE(?, name),
        subject = COALESCE(?, subject),
        description = COALESCE(?, description),
        room = COALESCE(?, room),
        grade_level = COALESCE(?, grade_level),
        school_year = COALESCE(?, school_year),
        teacher_id = COALESCE(?, teacher_id)
      WHERE id = ?`,
      [name, subject, description, room, grade_level, school_year, teacher_id, req.params.id]
    );

    const [updated] = await pool.query('SELECT * FROM classes WHERE id = ?', [req.params.id]);
    return success(res, updated[0], 'Class updated');
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// DELETE /classes/:id
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM classes WHERE id = ?', [req.params.id]);
    return success(res, null, 'Class deleted');
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// POST /classes/:id/enroll - enroll students
router.post('/:id/enroll', authenticate, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { student_ids } = req.body;
    if (!Array.isArray(student_ids) || !student_ids.length) {
      return error(res, 'student_ids array required', 400);
    }

    const values = student_ids.map(sid => [sid, req.params.id]);
    await pool.query(
      'INSERT IGNORE INTO enrollments (student_id, class_id) VALUES ?',
      [values]
    );

    return success(res, null, `${student_ids.length} student(s) enrolled`);
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// DELETE /classes/:id/enroll/:studentId
router.delete('/:id/enroll/:studentId', authenticate, authorize('admin', 'teacher'), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM enrollments WHERE class_id = ? AND student_id = ?',
      [req.params.id, req.params.studentId]
    );
    return success(res, null, 'Student removed from class');
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// POST /classes/:id/schedules
router.post('/:id/schedules', authenticate, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { day_of_week, start_time, end_time, room } = req.body;
    const [result] = await pool.query(
      'INSERT INTO schedules (class_id, day_of_week, start_time, end_time, room) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, day_of_week, start_time, end_time, room]
    );
    const [schedule] = await pool.query('SELECT * FROM schedules WHERE id = ?', [result.insertId]);
    return success(res, schedule[0], 'Schedule added', 201);
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

module.exports = router;
