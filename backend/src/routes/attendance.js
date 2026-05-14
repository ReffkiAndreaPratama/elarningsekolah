const express = require('express');
const router = express.Router();
const pool = require('../database/connection');
const { authenticate, authorize } = require('../middleware/auth');
const { success, error } = require('../utils/response');
const { validateGPSLocation, detectGPSSpoofing } = require('../utils/gps');
const { generateQRToken, generateQRCode, getQRExpiryTime, isQRValid } = require('../utils/qr');

// POST /attendance/sessions - create a class session
router.post('/sessions', authenticate, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { class_id, title, session_date, start_time, end_time } = req.body;

    const [result] = await pool.query(
      `INSERT INTO class_sessions (class_id, title, session_date, start_time, end_time, status, created_by)
       VALUES (?, ?, ?, ?, ?, 'scheduled', ?)`,
      [class_id, title, session_date, start_time, end_time, req.user.id]
    );

    const [session] = await pool.query('SELECT * FROM class_sessions WHERE id = ?', [result.insertId]);
    return success(res, session[0], 'Session created', 201);
  } catch (err) {
    console.error(err);
    return error(res, 'Server error', 500);
  }
});

// GET /attendance/sessions/:classId - get sessions for a class
router.get('/sessions/:classId', authenticate, async (req, res) => {
  try {
    const [sessions] = await pool.query(
      `SELECT cs.*, 
        (SELECT COUNT(*) FROM attendance a WHERE a.session_id = cs.id AND a.status = 'present') as present_count,
        (SELECT COUNT(*) FROM attendance a WHERE a.session_id = cs.id AND a.status = 'late') as late_count,
        (SELECT COUNT(*) FROM attendance a WHERE a.session_id = cs.id) as total_marked
       FROM class_sessions cs
       WHERE cs.class_id = ?
       ORDER BY cs.session_date DESC, cs.start_time DESC`,
      [req.params.classId]
    );
    return success(res, sessions);
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// POST /attendance/sessions/:id/activate - activate session and generate QR
router.post('/sessions/:id/activate', authenticate, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const sessionId = req.params.id;

    // Verify teacher owns this session's class
    const [sessions] = await pool.query(
      `SELECT cs.*, c.teacher_id FROM class_sessions cs
       JOIN classes c ON cs.class_id = c.id
       WHERE cs.id = ?`,
      [sessionId]
    );

    if (!sessions.length) return error(res, 'Session not found', 404);

    const session = sessions[0];
    if (req.user.role === 'teacher' && session.teacher_id !== req.user.id) {
      return error(res, 'Not authorized', 403);
    }

    const qrToken = generateQRToken();
    const qrExpiresAt = getQRExpiryTime();
    const qrDataURL = await generateQRCode(qrToken, sessionId);

    await pool.query(
      `UPDATE class_sessions SET 
        status = 'active', 
        qr_token = ?, 
        qr_expires_at = ?,
        qr_generated_at = NOW()
       WHERE id = ?`,
      [qrToken, qrExpiresAt, sessionId]
    );

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.to(`class_${session.class_id}`).emit('session_activated', {
        sessionId,
        classId: session.class_id,
        qrExpiresAt
      });
    }

    return success(res, {
      sessionId,
      qrCode: qrDataURL,
      qrToken,
      expiresAt: qrExpiresAt,
      expiryMinutes: parseInt(process.env.QR_EXPIRY_MINUTES || '10')
    }, 'Session activated with QR code');
  } catch (err) {
    console.error(err);
    return error(res, 'Server error', 500);
  }
});

// POST /attendance/sessions/:id/regenerate-qr
router.post('/sessions/:id/regenerate-qr', authenticate, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const sessionId = req.params.id;
    const qrToken = generateQRToken();
    const qrExpiresAt = getQRExpiryTime();
    const qrDataURL = await generateQRCode(qrToken, sessionId);

    await pool.query(
      `UPDATE class_sessions SET qr_token = ?, qr_expires_at = ?, qr_generated_at = NOW() WHERE id = ?`,
      [qrToken, qrExpiresAt, sessionId]
    );

    const [session] = await pool.query('SELECT class_id FROM class_sessions WHERE id = ?', [sessionId]);
    const io = req.app.get('io');
    if (io && session.length) {
      io.to(`class_${session[0].class_id}`).emit('qr_refreshed', { sessionId, qrExpiresAt });
    }

    return success(res, {
      qrCode: qrDataURL,
      qrToken,
      expiresAt: qrExpiresAt
    }, 'QR code regenerated');
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// POST /attendance/qr - mark attendance via QR
router.post('/qr', authenticate, authorize('student'), async (req, res) => {
  try {
    const { qr_token, session_id, lat, lng, accuracy } = req.body;

    if (!qr_token || !session_id) {
      return error(res, 'QR token and session ID required', 400);
    }

    // Validate session and QR token
    const [sessions] = await pool.query(
      `SELECT cs.*, c.teacher_id FROM class_sessions cs
       JOIN classes c ON cs.class_id = c.id
       WHERE cs.id = ? AND cs.qr_token = ?`,
      [session_id, qr_token]
    );

    if (!sessions.length) {
      return error(res, 'Invalid QR code', 400);
    }

    const session = sessions[0];

    // Check QR expiry
    if (!isQRValid(session.qr_expires_at)) {
      return error(res, 'QR code has expired. Please ask your teacher to regenerate.', 400);
    }

    // Check session is active
    if (session.status !== 'active') {
      return error(res, 'Session is not active', 400);
    }

    // Check student is enrolled
    const [enrollment] = await pool.query(
      'SELECT id FROM enrollments WHERE student_id = ? AND class_id = ?',
      [req.user.id, session.class_id]
    );

    if (!enrollment.length) {
      return error(res, 'You are not enrolled in this class', 403);
    }

    // Check if already marked
    const [existing] = await pool.query(
      'SELECT id, status FROM attendance WHERE student_id = ? AND session_id = ?',
      [req.user.id, session_id]
    );

    if (existing.length && existing[0].status !== 'absent') {
      return error(res, 'Attendance already marked', 409);
    }

    // GPS validation (if coordinates provided)
    let gpsValid = false;
    let gpsDistance = null;
    let gpsSpoofing = { isSuspicious: false };

    if (lat && lng) {
      const gpsResult = validateGPSLocation(parseFloat(lat), parseFloat(lng));
      gpsValid = gpsResult.isValid;
      gpsDistance = gpsResult.distance;
      gpsSpoofing = detectGPSSpoofing(parseFloat(lat), parseFloat(lng), accuracy);

      if (gpsSpoofing.isSuspicious) {
        console.warn(`⚠️ GPS spoofing suspected for student ${req.user.id}:`, gpsSpoofing.indicators);
      }
    }

    // Determine attendance status (present vs late)
    const now = new Date();
    const sessionStart = new Date(`${session.session_date}T${session.start_time}`);
    const lateThresholdMinutes = 15;
    const isLate = (now - sessionStart) > (lateThresholdMinutes * 60 * 1000);
    const status = isLate ? 'late' : 'present';

    // Upsert attendance record
    if (existing.length) {
      await pool.query(
        `UPDATE attendance SET 
          status = ?, method = 'qr', gps_lat = ?, gps_lng = ?, 
          gps_distance = ?, gps_valid = ?, qr_valid = TRUE, marked_at = NOW()
         WHERE student_id = ? AND session_id = ?`,
        [status, lat || null, lng || null, gpsDistance, gpsValid, req.user.id, session_id]
      );
    } else {
      await pool.query(
        `INSERT INTO attendance 
          (student_id, session_id, class_id, status, method, gps_lat, gps_lng, gps_distance, gps_valid, qr_valid, marked_at)
         VALUES (?, ?, ?, ?, 'qr', ?, ?, ?, ?, TRUE, NOW())`,
        [req.user.id, session_id, session.class_id, status, lat || null, lng || null, gpsDistance, gpsValid]
      );
    }

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`class_${session.class_id}`).emit('attendance_marked', {
        studentId: req.user.id,
        studentName: req.user.name,
        sessionId: session_id,
        status,
        method: 'qr',
        timestamp: new Date().toISOString()
      });
    }

    return success(res, {
      status,
      method: 'qr',
      gpsValid,
      gpsDistance,
      isLate,
      spoofingWarning: gpsSpoofing.isSuspicious ? gpsSpoofing.indicators : null
    }, `Attendance marked as ${status}`);
  } catch (err) {
    console.error(err);
    return error(res, 'Server error', 500);
  }
});

// POST /attendance/gps - mark attendance via GPS only
router.post('/gps', authenticate, authorize('student'), async (req, res) => {
  try {
    const { session_id, lat, lng, accuracy } = req.body;

    if (!lat || !lng || !session_id) {
      return error(res, 'GPS coordinates and session ID required', 400);
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    // Spoofing detection
    const spoofCheck = detectGPSSpoofing(latitude, longitude, accuracy);
    if (spoofCheck.isSuspicious) {
      return error(res, `GPS validation failed: ${spoofCheck.indicators.join(', ')}`, 400);
    }

    // Validate location
    const gpsResult = validateGPSLocation(latitude, longitude);
    if (!gpsResult.isValid) {
      return error(res, `You are ${Math.round(gpsResult.distance)}m away from school. Must be within ${gpsResult.allowedRadius}m.`, 400);
    }

    // Get session
    const [sessions] = await pool.query(
      'SELECT * FROM class_sessions WHERE id = ? AND status = "active"',
      [session_id]
    );

    if (!sessions.length) return error(res, 'Active session not found', 404);
    const session = sessions[0];

    // Check enrollment
    const [enrollment] = await pool.query(
      'SELECT id FROM enrollments WHERE student_id = ? AND class_id = ?',
      [req.user.id, session.class_id]
    );
    if (!enrollment.length) return error(res, 'Not enrolled in this class', 403);

    // Check existing
    const [existing] = await pool.query(
      'SELECT id, status FROM attendance WHERE student_id = ? AND session_id = ?',
      [req.user.id, session_id]
    );
    if (existing.length && existing[0].status !== 'absent') {
      return error(res, 'Attendance already marked', 409);
    }

    const now = new Date();
    const sessionStart = new Date(`${session.session_date}T${session.start_time}`);
    const isLate = (now - sessionStart) > (15 * 60 * 1000);
    const status = isLate ? 'late' : 'present';

    if (existing.length) {
      await pool.query(
        `UPDATE attendance SET status = ?, method = 'gps', gps_lat = ?, gps_lng = ?, 
          gps_distance = ?, gps_valid = TRUE, marked_at = NOW()
         WHERE student_id = ? AND session_id = ?`,
        [status, latitude, longitude, gpsResult.distance, req.user.id, session_id]
      );
    } else {
      await pool.query(
        `INSERT INTO attendance (student_id, session_id, class_id, status, method, gps_lat, gps_lng, gps_distance, gps_valid, marked_at)
         VALUES (?, ?, ?, ?, 'gps', ?, ?, ?, TRUE, NOW())`,
        [req.user.id, session_id, session.class_id, status, latitude, longitude, gpsResult.distance]
      );
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`class_${session.class_id}`).emit('attendance_marked', {
        studentId: req.user.id,
        studentName: req.user.name,
        sessionId: session_id,
        status,
        method: 'gps',
        timestamp: new Date().toISOString()
      });
    }

    return success(res, {
      status,
      method: 'gps',
      distance: gpsResult.distance,
      allowedRadius: gpsResult.allowedRadius
    }, `Attendance marked as ${status}`);
  } catch (err) {
    console.error(err);
    return error(res, 'Server error', 500);
  }
});

// GET /attendance/session/:sessionId - get attendance for a session
router.get('/session/:sessionId', authenticate, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const [records] = await pool.query(
      `SELECT a.*, u.name as student_name, u.email as student_email
       FROM attendance a
       JOIN users u ON a.student_id = u.id
       WHERE a.session_id = ?
       ORDER BY u.name`,
      [req.params.sessionId]
    );

    // Get all enrolled students to show absent ones too
    const [session] = await pool.query('SELECT class_id FROM class_sessions WHERE id = ?', [req.params.sessionId]);
    if (session.length) {
      const [enrolled] = await pool.query(
        `SELECT u.id, u.name, u.email FROM users u
         JOIN enrollments e ON e.student_id = u.id
         WHERE e.class_id = ?`,
        [session[0].class_id]
      );

      const markedIds = new Set(records.map(r => r.student_id));
      const absentStudents = enrolled
        .filter(s => !markedIds.has(s.id))
        .map(s => ({ ...s, status: 'absent', method: null }));

      return success(res, { records, absentStudents });
    }

    return success(res, { records, absentStudents: [] });
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// GET /attendance/student/:studentId - get student attendance history
router.get('/student/:studentId', authenticate, async (req, res) => {
  try {
    // Students can only view their own
    if (req.user.role === 'student' && req.user.id !== parseInt(req.params.studentId)) {
      return error(res, 'Not authorized', 403);
    }

    const [records] = await pool.query(
      `SELECT a.*, cs.title as session_title, cs.session_date, cs.start_time,
        c.name as class_name, c.subject
       FROM attendance a
       JOIN class_sessions cs ON a.session_id = cs.id
       JOIN classes c ON a.class_id = c.id
       WHERE a.student_id = ?
       ORDER BY cs.session_date DESC`,
      [req.params.studentId]
    );

    // Calculate stats
    const total = records.length;
    const present = records.filter(r => r.status === 'present').length;
    const late = records.filter(r => r.status === 'late').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return success(res, { records, stats: { total, present, late, absent, rate } });
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// GET /attendance/class/:classId/summary
router.get('/class/:classId/summary', authenticate, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const [summary] = await pool.query(
      `SELECT 
        u.id as student_id, u.name as student_name,
        COUNT(cs.id) as total_sessions,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late,
        SUM(CASE WHEN a.status = 'absent' OR a.id IS NULL THEN 1 ELSE 0 END) as absent
       FROM users u
       JOIN enrollments e ON e.student_id = u.id
       JOIN class_sessions cs ON cs.class_id = e.class_id
       LEFT JOIN attendance a ON a.student_id = u.id AND a.session_id = cs.id
       WHERE e.class_id = ?
       GROUP BY u.id, u.name
       ORDER BY u.name`,
      [req.params.classId]
    );

    return success(res, summary);
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// PUT /attendance/:id/manual - manual override (teacher/admin)
router.put('/:id/manual', authenticate, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { status, notes } = req.body;
    await pool.query(
      `UPDATE attendance SET status = ?, method = 'manual', notes = ?, marked_at = NOW() WHERE id = ?`,
      [status, notes, req.params.id]
    );
    return success(res, null, 'Attendance updated');
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// POST /attendance/sessions/:id/close
router.post('/sessions/:id/close', authenticate, authorize('admin', 'teacher'), async (req, res) => {
  try {
    await pool.query(
      `UPDATE class_sessions SET status = 'completed', qr_token = NULL WHERE id = ?`,
      [req.params.id]
    );

    const [session] = await pool.query('SELECT class_id FROM class_sessions WHERE id = ?', [req.params.id]);
    const io = req.app.get('io');
    if (io && session.length) {
      io.to(`class_${session[0].class_id}`).emit('session_closed', { sessionId: req.params.id });
    }

    return success(res, null, 'Session closed');
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

module.exports = router;
