const express = require('express');
const router = express.Router();
const pool = require('../database/connection');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { success, error } = require('../utils/response');

// GET /assignments/:classId
router.get('/:classId', authenticate, async (req, res) => {
  try {
    const [assignments] = await pool.query(
      `SELECT a.*, u.name as created_by_name,
        (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) as submission_count
       FROM assignments a
       JOIN users u ON a.created_by = u.id
       WHERE a.class_id = ? AND a.is_published = TRUE
       ORDER BY a.due_date ASC`,
      [req.params.classId]
    );

    // For students, include their submission status
    if (req.user.role === 'student') {
      const assignmentIds = assignments.map(a => a.id);
      if (assignmentIds.length > 0) {
        const [submissions] = await pool.query(
          `SELECT assignment_id, status, score, submitted_at FROM submissions 
           WHERE student_id = ? AND assignment_id IN (?)`,
          [req.user.id, assignmentIds]
        );
        const submissionMap = {};
        submissions.forEach(s => { submissionMap[s.assignment_id] = s; });
        assignments.forEach(a => {
          a.my_submission = submissionMap[a.id] || null;
          a.is_overdue = new Date(a.due_date) < new Date() && !submissionMap[a.id];
        });
      }
    }

    return success(res, assignments);
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// POST /assignments - create assignment
router.post('/', authenticate, authorize('admin', 'teacher'), upload.single('attachment'), async (req, res) => {
  try {
    const { class_id, title, description, due_date, max_score } = req.body;
    const attachmentPath = req.file ? req.file.path.replace(/\\/g, '/') : null;

    const [result] = await pool.query(
      `INSERT INTO assignments (class_id, title, description, due_date, max_score, attachment_path, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [class_id, title, description, due_date, max_score || 100, attachmentPath, req.user.id]
    );

    const [assignment] = await pool.query('SELECT * FROM assignments WHERE id = ?', [result.insertId]);
    return success(res, assignment[0], 'Assignment created', 201);
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// PUT /assignments/:id
router.put('/:id', authenticate, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { title, description, due_date, max_score, is_published } = req.body;
    await pool.query(
      `UPDATE assignments SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        due_date = COALESCE(?, due_date),
        max_score = COALESCE(?, max_score),
        is_published = COALESCE(?, is_published)
       WHERE id = ? AND created_by = ?`,
      [title, description, due_date, max_score, is_published, req.params.id, req.user.id]
    );
    const [updated] = await pool.query('SELECT * FROM assignments WHERE id = ?', [req.params.id]);
    return success(res, updated[0], 'Assignment updated');
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// DELETE /assignments/:id
router.delete('/:id', authenticate, authorize('admin', 'teacher'), async (req, res) => {
  try {
    await pool.query('DELETE FROM assignments WHERE id = ? AND created_by = ?', [req.params.id, req.user.id]);
    return success(res, null, 'Assignment deleted');
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// POST /assignments/:id/submit - student submits
router.post('/:id/submit', authenticate, authorize('student'), upload.single('file'), async (req, res) => {
  try {
    const { content } = req.body;
    const assignmentId = req.params.id;

    const [assignment] = await pool.query('SELECT * FROM assignments WHERE id = ?', [assignmentId]);
    if (!assignment.length) return error(res, 'Assignment not found', 404);

    const isLate = new Date(assignment[0].due_date) < new Date();
    const status = isLate ? 'late' : 'submitted';

    const filePath = req.file ? req.file.path.replace(/\\/g, '/') : null;
    const fileName = req.file ? req.file.originalname : null;

    const [existing] = await pool.query(
      'SELECT id FROM submissions WHERE assignment_id = ? AND student_id = ?',
      [assignmentId, req.user.id]
    );

    if (existing.length) {
      await pool.query(
        `UPDATE submissions SET content = ?, file_path = ?, file_name = ?, status = ?, submitted_at = NOW()
         WHERE assignment_id = ? AND student_id = ?`,
        [content, filePath, fileName, status, assignmentId, req.user.id]
      );
    } else {
      await pool.query(
        `INSERT INTO submissions (assignment_id, student_id, content, file_path, file_name, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [assignmentId, req.user.id, content, filePath, fileName, status]
      );
    }

    return success(res, { status, isLate }, `Assignment ${isLate ? 'submitted late' : 'submitted successfully'}`);
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// GET /assignments/:id/submissions - teacher views submissions
router.get('/:id/submissions', authenticate, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const [submissions] = await pool.query(
      `SELECT s.*, u.name as student_name, u.email as student_email
       FROM submissions s
       JOIN users u ON s.student_id = u.id
       WHERE s.assignment_id = ?
       ORDER BY s.submitted_at DESC`,
      [req.params.id]
    );
    return success(res, submissions);
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// PUT /assignments/submissions/:submissionId/grade
router.put('/submissions/:submissionId/grade', authenticate, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { score, feedback } = req.body;
    await pool.query(
      `UPDATE submissions SET score = ?, feedback = ?, status = 'graded', graded_at = NOW(), graded_by = ?
       WHERE id = ?`,
      [score, feedback, req.user.id, req.params.submissionId]
    );
    return success(res, null, 'Submission graded');
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

module.exports = router;
