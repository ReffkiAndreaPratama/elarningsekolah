require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  console.log('🔄 Running migrations...');

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'school_elearning'}\``);
  await connection.query(`USE \`${process.env.DB_NAME || 'school_elearning'}\``);

  const schema = `
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role ENUM('admin', 'teacher', 'student') NOT NULL DEFAULT 'student',
      avatar VARCHAR(500) DEFAULT NULL,
      phone VARCHAR(20) DEFAULT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_email (email),
      INDEX idx_role (role)
    );

    -- Classes table
    CREATE TABLE IF NOT EXISTS classes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      teacher_id INT NOT NULL,
      room VARCHAR(100) DEFAULT NULL,
      grade_level VARCHAR(50) DEFAULT NULL,
      school_year VARCHAR(20) DEFAULT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_teacher (teacher_id)
    );

    -- Class enrollments (students in classes)
    CREATE TABLE IF NOT EXISTS enrollments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      class_id INT NOT NULL,
      enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_enrollment (student_id, class_id),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      INDEX idx_student (student_id),
      INDEX idx_class (class_id)
    );

    -- Schedules table
    CREATE TABLE IF NOT EXISTS schedules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      class_id INT NOT NULL,
      day_of_week ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      room VARCHAR(100) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      INDEX idx_class_day (class_id, day_of_week)
    );

    -- Class sessions (individual class meetings)
    CREATE TABLE IF NOT EXISTS class_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      class_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      session_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      qr_token VARCHAR(255) DEFAULT NULL,
      qr_expires_at TIMESTAMP DEFAULT NULL,
      qr_generated_at TIMESTAMP DEFAULT NULL,
      status ENUM('scheduled','active','completed','cancelled') DEFAULT 'scheduled',
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id),
      INDEX idx_class_date (class_id, session_date),
      INDEX idx_qr_token (qr_token)
    );

    -- Attendance records
    CREATE TABLE IF NOT EXISTS attendance (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      session_id INT NOT NULL,
      class_id INT NOT NULL,
      status ENUM('present','late','absent') DEFAULT 'absent',
      method ENUM('qr','gps','manual') DEFAULT 'manual',
      gps_lat DECIMAL(10, 8) DEFAULT NULL,
      gps_lng DECIMAL(11, 8) DEFAULT NULL,
      gps_distance DECIMAL(10, 2) DEFAULT NULL,
      gps_valid BOOLEAN DEFAULT FALSE,
      qr_valid BOOLEAN DEFAULT FALSE,
      marked_at TIMESTAMP DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_attendance (student_id, session_id),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      INDEX idx_student_session (student_id, session_id),
      INDEX idx_class_session (class_id, session_id)
    );

    -- Materials table
    CREATE TABLE IF NOT EXISTS materials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      class_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      type ENUM('pdf','video','text','link','image') NOT NULL DEFAULT 'text',
      file_path VARCHAR(500) DEFAULT NULL,
      file_name VARCHAR(255) DEFAULT NULL,
      file_size INT DEFAULT NULL,
      content TEXT DEFAULT NULL,
      url VARCHAR(500) DEFAULT NULL,
      uploaded_by INT NOT NULL,
      is_published BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id),
      INDEX idx_class (class_id)
    );

    -- Assignments table
    CREATE TABLE IF NOT EXISTS assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      class_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      due_date DATETIME NOT NULL,
      max_score INT DEFAULT 100,
      attachment_path VARCHAR(500) DEFAULT NULL,
      created_by INT NOT NULL,
      is_published BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id),
      INDEX idx_class (class_id),
      INDEX idx_due_date (due_date)
    );

    -- Assignment submissions
    CREATE TABLE IF NOT EXISTS submissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      assignment_id INT NOT NULL,
      student_id INT NOT NULL,
      content TEXT DEFAULT NULL,
      file_path VARCHAR(500) DEFAULT NULL,
      file_name VARCHAR(255) DEFAULT NULL,
      score INT DEFAULT NULL,
      feedback TEXT DEFAULT NULL,
      status ENUM('submitted','graded','late') DEFAULT 'submitted',
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      graded_at TIMESTAMP DEFAULT NULL,
      graded_by INT DEFAULT NULL,
      UNIQUE KEY unique_submission (assignment_id, student_id),
      FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (graded_by) REFERENCES users(id),
      INDEX idx_assignment (assignment_id),
      INDEX idx_student (student_id)
    );

    -- Notifications table
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type ENUM('info','success','warning','error') DEFAULT 'info',
      is_read BOOLEAN DEFAULT FALSE,
      link VARCHAR(500) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_read (user_id, is_read)
    );

    -- Announcements table
    CREATE TABLE IF NOT EXISTS announcements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      class_id INT DEFAULT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      created_by INT NOT NULL,
      is_global BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id),
      INDEX idx_class (class_id)
    );
  `;

  await connection.query(schema);
  console.log('✅ Migrations completed successfully');
  await connection.end();
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
