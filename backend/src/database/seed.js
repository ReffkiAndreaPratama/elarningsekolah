require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./connection');

async function seed() {
  console.log('🌱 Seeding database...');

  const hashedPassword = await bcrypt.hash('password123', 12);

  // Seed admin
  await pool.query(`
    INSERT IGNORE INTO users (name, email, password, role) VALUES
    ('System Admin', 'admin@school.edu', ?, 'admin'),
    ('Dr. Maria Santos', 'teacher1@school.edu', ?, 'teacher'),
    ('Prof. Juan Dela Cruz', 'teacher2@school.edu', ?, 'teacher'),
    ('Alice Reyes', 'student1@school.edu', ?, 'student'),
    ('Bob Mendoza', 'student2@school.edu', ?, 'student'),
    ('Carol Lim', 'student3@school.edu', ?, 'student'),
    ('David Tan', 'student4@school.edu', ?, 'student')
  `, [hashedPassword, hashedPassword, hashedPassword, hashedPassword, hashedPassword, hashedPassword, hashedPassword]);

  // Get teacher IDs
  const [teachers] = await pool.query(`SELECT id FROM users WHERE role = 'teacher' LIMIT 2`);
  const [students] = await pool.query(`SELECT id FROM users WHERE role = 'student'`);

  if (teachers.length < 2) {
    console.log('⚠️  Not enough teachers found');
    return;
  }

  // Seed classes
  await pool.query(`
    INSERT IGNORE INTO classes (name, subject, description, teacher_id, room, grade_level, school_year) VALUES
    ('Grade 10 - Mathematics', 'Mathematics', 'Advanced algebra and geometry', ?, 'Room 101', 'Grade 10', '2025-2026'),
    ('Grade 10 - Science', 'Science', 'Physics and chemistry fundamentals', ?, 'Room 102', 'Grade 10', '2025-2026'),
    ('Grade 11 - English', 'English', 'Advanced communication skills', ?, 'Room 201', 'Grade 11', '2025-2026')
  `, [teachers[0].id, teachers[1].id, teachers[0].id]);

  const [classes] = await pool.query(`SELECT id FROM classes LIMIT 3`);

  // Enroll students
  for (const student of students) {
    for (const cls of classes) {
      await pool.query(
        `INSERT IGNORE INTO enrollments (student_id, class_id) VALUES (?, ?)`,
        [student.id, cls.id]
      );
    }
  }

  // Seed schedules
  if (classes.length > 0) {
    await pool.query(`
      INSERT IGNORE INTO schedules (class_id, day_of_week, start_time, end_time, room) VALUES
      (?, 'Monday', '08:00:00', '09:30:00', 'Room 101'),
      (?, 'Wednesday', '08:00:00', '09:30:00', 'Room 101'),
      (?, 'Tuesday', '10:00:00', '11:30:00', 'Room 102'),
      (?, 'Thursday', '10:00:00', '11:30:00', 'Room 102')
    `, [classes[0].id, classes[0].id, classes[1].id, classes[1].id]);
  }

  // Seed materials
  if (classes.length > 0) {
    const [teacherUsers] = await pool.query(`SELECT id FROM users WHERE role = 'teacher' LIMIT 1`);
    if (teacherUsers.length > 0) {
      await pool.query(`
        INSERT IGNORE INTO materials (class_id, title, description, type, content, uploaded_by) VALUES
        (?, 'Introduction to Algebra', 'Basic algebra concepts and operations', 'text', 'Algebra is a branch of mathematics dealing with symbols and the rules for manipulating those symbols...', ?),
        (?, 'Quadratic Equations', 'Solving quadratic equations using various methods', 'text', 'A quadratic equation is a second-order polynomial equation in a single variable x: ax² + bx + c = 0...', ?)
      `, [classes[0].id, teacherUsers[0].id, classes[0].id, teacherUsers[0].id]);

      // Seed assignments
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 7);
      const dueDate = tomorrow.toISOString().slice(0, 19).replace('T', ' ');

      await pool.query(`
        INSERT IGNORE INTO assignments (class_id, title, description, due_date, max_score, created_by) VALUES
        (?, 'Problem Set 1: Linear Equations', 'Solve the following linear equations and show your work...', ?, 100, ?),
        (?, 'Quiz 1: Algebra Basics', 'Answer all questions about basic algebra concepts', ?, 50, ?)
      `, [classes[0].id, dueDate, teacherUsers[0].id, classes[0].id, dueDate, teacherUsers[0].id]);
    }
  }

  console.log('✅ Database seeded successfully');
  console.log('\n📋 Test Accounts:');
  console.log('  Admin:   admin@school.edu / password123');
  console.log('  Teacher: teacher1@school.edu / password123');
  console.log('  Student: student1@school.edu / password123');

  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
