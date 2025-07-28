#!/bin/bash

echo "🚀 AutoCare Pro - Complete Setup Script"
echo "======================================="

# Check if MongoDB is running
echo "📊 Checking MongoDB status..."
if ! pgrep -x "mongod" > /dev/null; then
    echo "⚠️  MongoDB is not running. Please start MongoDB first:"
    echo "   sudo systemctl start mongod"
    echo "   OR"
    echo "   brew services start mongodb-community"
    exit 1
fi

echo "✅ MongoDB is running"

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd ..
npm install

# Create environment files if they don't exist
echo "🔧 Setting up environment variables..."

if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ Created backend .env file"
else
    echo "✅ Backend .env file already exists"
fi

if [ ! -f ".env.local" ]; then
    echo "VITE_API_URL=http://localhost:3001" > .env.local
    echo "VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here" >> .env.local
    echo "✅ Created frontend .env.local file"
else
    echo "✅ Frontend .env.local file already exists"
fi

# Initialize database (optional)
echo "🗄️  Initializing database..."
cd backend
npm run init-db 2>/dev/null || echo "Database initialization skipped (optional)"

echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "🚦 To start the application:"
echo ""
echo "1. Start Backend (Terminal 1):"
echo "   cd backend && npm start"
echo ""
echo "2. Start Frontend (Terminal 2):"
echo "   npm run dev"
echo ""
echo "3. Access the application:"
echo "   Frontend: http://localhost:5173"
echo "   Backend API: http://localhost:3001"
echo ""
echo "📋 Features Implemented:"
echo "✅ Admin Messaging with real-time delivery"
echo "✅ Broadcast to all admins via Socket.IO"
echo "✅ Stripe payment integration"
echo "✅ Google Maps location sharing"
echo "✅ Add Pickup Truck feature"
echo "✅ Epic intro animation"
echo ""
echo "🔑 API Keys Required:"
echo "- Update STRIPE_SECRET_KEY in backend/.env"
echo "- Update VITE_GOOGLE_MAPS_API_KEY in .env.local"
echo ""
echo "📖 For detailed documentation, see FEATURES_IMPLEMENTED.md"