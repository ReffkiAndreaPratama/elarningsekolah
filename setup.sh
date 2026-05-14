#!/bin/bash
# EduTrack Setup Script

echo "🎓 Setting up EduTrack School E-Learning Platform..."

# Backend setup
echo "📦 Installing backend dependencies..."
cd backend
npm install

# Create .env if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ Created backend/.env — please edit with your MySQL credentials"
fi

# Frontend setup
echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit backend/.env with your MySQL credentials"
echo "2. Run: cd backend && npm run db:migrate"
echo "3. Run: cd backend && npm run db:seed"
echo "4. Start backend: cd backend && npm run dev"
echo "5. Start frontend: cd frontend && npm run dev"
echo ""
echo "Demo accounts:"
echo "  Admin:   admin@school.edu / password123"
echo "  Teacher: teacher1@school.edu / password123"
echo "  Student: student1@school.edu / password123"
