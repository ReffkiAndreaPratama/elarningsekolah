# EduTrack — School E-Learning Platform

A full-featured school e-learning system with GPS + QR attendance, class management, and learning system.

## Tech Stack

- **Frontend**: React (Vite) + Tailwind CSS + React Query + Zustand
- **Backend**: Node.js (Express) + Socket.IO
- **Database**: MySQL
- **Realtime**: Socket.IO
- **Maps/GPS**: Browser Geolocation API
- **QR**: qrcode + html5-qrcode

## Features

- 🔐 Role-based auth (Admin / Teacher / Student)
- 🏫 Class management with enrollment
- 📚 Learning materials (PDF, video, text, links)
- 📝 Assignments with submission & grading
- 📅 Weekly schedule system
- 📍 GPS attendance validation (Haversine formula)
- 🔳 QR code attendance (time-limited, unique per session)
- 📊 Role-specific dashboards with analytics
- 🔔 Real-time updates via Socket.IO
- 📱 Mobile-responsive design

## Quick Start

### Prerequisites
- Node.js 18+
- MySQL 8+

### 1. Database Setup

```bash
# Create .env from example
cp backend/.env.example backend/.env
# Edit backend/.env with your MySQL credentials

# Install backend dependencies
cd backend
npm install

# Run migrations (creates DB + tables)
npm run db:migrate

# Seed demo data
npm run db:seed
```

### 2. Start Backend

```bash
cd backend
npm run dev
# API running at http://localhost:5000
```

### 3. Start Frontend

```bash
cd frontend
npm install
npm run dev
# App running at http://localhost:5173
```

## Demo Accounts

| Role    | Email                    | Password    |
|---------|--------------------------|-------------|
| Admin   | admin@school.edu         | password123 |
| Teacher | teacher1@school.edu      | password123 |
| Student | student1@school.edu      | password123 |

## GPS Configuration

Edit `backend/.env`:

```env
SCHOOL_LAT=14.5995        # School latitude
SCHOOL_LNG=120.9842       # School longitude  
SCHOOL_RADIUS_METERS=200  # Allowed radius in meters
```

## QR Code Configuration

```env
QR_EXPIRY_MINUTES=10  # QR expires after X minutes
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login |
| GET | /api/classes | List classes |
| POST | /api/attendance/sessions | Create session |
| POST | /api/attendance/sessions/:id/activate | Generate QR |
| POST | /api/attendance/qr | Mark attendance via QR |
| POST | /api/attendance/gps | Mark attendance via GPS |
| GET | /api/materials/:classId | Get materials |
| POST | /api/materials | Upload material |
| GET | /api/assignments/:classId | Get assignments |
| POST | /api/assignments/:id/submit | Submit assignment |
| GET | /api/dashboard | Dashboard data |

## Attendance Flow

### QR Attendance (Student)
1. Teacher activates session → QR generated (expires in 10 min)
2. Student opens "Scan QR" page
3. GPS location acquired automatically
4. Student scans QR code
5. System validates: QR token + expiry + GPS location + enrollment
6. Attendance marked as `present` or `late`

### GPS Attendance
1. Student submits GPS coordinates
2. Haversine formula calculates distance to school
3. If within radius → attendance marked
4. Basic spoofing detection applied

## Security Features

- JWT authentication with expiry
- Rate limiting on all endpoints
- GPS spoofing detection (precision check, bounds validation)
- QR token expiry (configurable)
- Role-based access control
- Helmet.js security headers
- Input validation with express-validator

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── database/     # Connection, migrations, seeds
│   │   ├── middleware/   # Auth, upload
│   │   ├── routes/       # API routes
│   │   ├── utils/        # GPS, QR, response helpers
│   │   └── server.js     # Express + Socket.IO server
│   └── uploads/          # File uploads
└── frontend/
    └── src/
        ├── components/   # Layout, Sidebar, Header
        ├── pages/        # All page components
        ├── store/        # Zustand auth store
        └── lib/          # API client, Socket.IO
```
