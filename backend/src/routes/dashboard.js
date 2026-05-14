const express = require('express');
const router = express.Router();
const pool = require('../database/connection');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');

// GET /dashboard - role-based dashboard data
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    if (role === 'admin') {
      const [[userStats]] = await pool.query(`
        SELECT 
          COUNT(*) as total_users,
          SUM(CASE WHEN role = 'student' THEN 1 ELSE 0 END) as total_students,
          SUM(CASE WHEN role = 'teacher' THEN 1 ELSE 0 END) as total_teachers,
          SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as total_admins
        FROM users WHERE is_active = TRUE
      `);

      const [[classStats]] = await pool.query(`
        SELECT COUNT(*) as total_classes FROM classes WHERE is_active = TRUE
      `);

      const [[attendanceStats]] = await pool.query(`
        SELECT 
          COUNT(*) as total_records,
          SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
          SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late,
          SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent
        FROM attendance
        WHERE DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      `);

      const [recentSessions] = await pool.query(`
        SELECT cs.*, c.name as class_name, u.name as teacher_name
        FROM class_sessions cs
        JOIN classes c ON cs.class_id = c.id
        JOIN users u ON c.teacher_id = u.id
        ORDER BY cs.created_at DESC LIMIT 5
      `);

      const [attendanceTrend] = await pool.query(`
        SELECT 
          DATE(marked_at) as date,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
          SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late
        FROM attendance
        WHERE marked_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY DATE(marked_at)
        ORDER BY date ASC
      `);

      return success(res, {
        userStats,
        classStats,
        attendanceStats,
        recentSessions,
        attendanceTrend
      });
    }

    if (role === 'teacher') {
      const [[myClasses]] = await pool.query(
        'SELECT COUNT(*) as total FROM classes WHERE teacher_id = ?',
        [userId]
      );

      const [[myStudents]] = await pool.query(`
        SELECT COUNT(DISTINCT e.student_id) as total
        FROM enrollments e
        JOIN classes c ON e.class_id = c.id
        WHERE c.teacher_id = ?
      `, [userId]);

      const [[todayAttendance]] = await pool.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
          SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late,
          SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent
        FROM attendance a
        JOIN class_sessions cs ON a.session_id = cs.id
        JOIN classes c ON cs.class_id = c.id
        WHERE c.teacher_id = ? AND DATE(cs.session_date) = CURDATE()
      `, [userId]);

      const [activeSessions] = await pool.query(`
        SELECT cs.*, c.name as class_name
        FROM class_sessions cs
        JOIN classes c ON cs.class_id = c.id
        WHERE c.teacher_id = ? AND cs.status = 'active'
      `, [userId]);

      const [recentClasses] = await pool.query(`
        SELECT c.*, 
          (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = c.id) as student_count
        FROM classes c
        WHERE c.teacher_id = ?
        ORDER BY c.created_at DESC LIMIT 5
      `, [userId]);

      const [pendingSubmissions] = await pool.query(`
        SELECT COUNT(*) as total FROM submissions s
        JOIN assignments a ON s.assignment_id = a.id
        JOIN classes c ON a.class_id = c.id
        WHERE c.teacher_id = ? AND s.status = 'submitted'
      `, [userId]);

      return success(res, {
        myClasses: myClasses.total,
        myStudents: myStudents.total,
        todayAttendance,
        activeSessions,
        recentClasses,
        pendingSubmissions: pendingSubmissions[0]?.total || 0
      });
    }

    // Student dashboard
    const [[enrolledClasses]] = await pool.query(
      'SELECT COUNT(*) as total FROM enrollments WHERE student_id = ?',
      [userId]
    );

    const [[attendanceStats]] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent
      FROM attendance WHERE student_id = ?
    `, [userId]);

    const attendanceRate = attendanceStats.total > 0
      ? Math.round(((attendanceStats.present + attendanceStats.late) / attendanceStats.total) * 100)
      : 0;

    const [upcomingAssignments] = await pool.query(`
      SELECT a.*, c.name as class_name,
        (SELECT id FROM submissions s WHERE s.assignment_id = a.id AND s.student_id = ?) as submitted
      FROM assignments a
      JOIN classes c ON a.class_id = c.id
      JOIN enrollments e ON e.class_id = c.id
      WHERE e.student_id = ? AND a.due_date >= NOW() AND a.is_published = TRUE
      ORDER BY a.due_date ASC LIMIT 5
    `, [userId, userId]);

    const [todaySchedule] = await pool.query(`
      SELECT s.*, c.name as class_name, c.subject, u.name as teacher_name
      FROM schedules s
      JOIN classes c ON s.class_id = c.id
      JOIN users u ON c.teacher_id = u.id
      JOIN enrollments e ON e.class_id = c.id
      WHERE e.student_id = ? AND s.day_of_week = DAYNAME(CURDATE())
      ORDER BY s.start_time
    `, [userId]);

    const [activeSessions] = await pool.query(`
      SELECT cs.*, c.name as class_name, c.subject
      FROM class_sessions cs
      JOIN classes c ON cs.class_id = c.id
      JOIN enrollments e ON e.class_id = c.id
      WHERE e.student_id = ? AND cs.status = 'active'
    `, [userId]);

    const [recentAttendance] = await pool.query(`
      SELECT a.*, cs.title as session_title, cs.session_date, c.name as class_name
      FROM attendance a
      JOIN class_sessions cs ON a.session_id = cs.id
      JOIN classes c ON a.class_id = c.id
      WHERE a.student_id = ?
      ORDER BY a.marked_at DESC LIMIT 5
    `, [userId]);

    return success(res, {
      enrolledClasses: enrolledClasses.total,
      attendanceStats: { ...attendanceStats, rate: attendanceRate },
      upcomingAssignments,
      todaySchedule,
      activeSessions,
      recentAttendance
    });
  } catch (err) {
    console.error(err);
    return error(res, 'Server error', 500);
  }
});

// GET /dashboard/schedule - weekly schedule
router.get('/schedule', authenticate, async (req, res) => {
  try {
    let query, params;

    if (req.user.role === 'student') {
      query = `
        SELECT s.*, c.name as class_name, c.subject, u.name as teacher_name
        FROM schedules s
        JOIN classes c ON s.class_id = c.id
        JOIN users u ON c.teacher_id = u.id
        JOIN enrollments e ON e.class_id = c.id
        WHERE e.student_id = ?
        ORDER BY FIELD(s.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'), s.start_time
      `;
      params = [req.user.id];
    } else if (req.user.role === 'teacher') {
      query = `
        SELECT s.*, c.name as class_name, c.subject
        FROM schedules s
        JOIN classes c ON s.class_id = c.id
        WHERE c.teacher_id = ?
        ORDER BY FIELD(s.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'), s.start_time
      `;
      params = [req.user.id];
    } else {
      query = `
        SELECT s.*, c.name as class_name, c.subject, u.name as teacher_name
        FROM schedules s
        JOIN classes c ON s.class_id = c.id
        JOIN users u ON c.teacher_id = u.id
        ORDER BY FIELD(s.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'), s.start_time
      `;
      params = [];
    }

    const [schedules] = await pool.query(query, params);
    return success(res, schedules);
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// GET /dashboard/notifications
router.get('/notifications', authenticate, async (req, res) => {
  try {
    const [notifications] = await pool.query(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    );
    return success(res, notifications);
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

// PUT /dashboard/notifications/:id/read
router.put('/notifications/:id/read', authenticate, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    return success(res, null, 'Notification marked as read');
  } catch (err) {
    return error(res, 'Server error', 500);
  }
});

module.exports = router;
