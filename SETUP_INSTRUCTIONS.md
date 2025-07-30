# AutoCare Pro - Complete Setup Instructions

## 🎉 Your Application is Now Fully Functional!

The AutoCare Pro application has been successfully set up with complete backend and frontend integration, including user authentication, database initialization, and all core features.

## 🚀 Quick Start

Both servers are currently running:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/api/v1
- **Health Check**: http://localhost:3001/health

## 📋 What's Been Set Up

### ✅ Backend (Node.js + Express + MongoDB)
- Complete REST API with authentication
- MongoDB database with sample data
- JWT-based authentication system
- User and admin role management
- Vehicle management system
- Service request handling
- Real-time features with Socket.io
- File upload capabilities
- Comprehensive error handling

### ✅ Frontend (React + Vite + Tailwind CSS)
- Modern React application with Vite
- Beautiful UI with Tailwind CSS and Radix UI
- Authentication context and protected routes
- User and admin dashboards
- Vehicle management interface
- Service request system
- Real-time updates
- Responsive design

### ✅ Database (MongoDB)
- Initialized with sample data
- 5 admin users
- 1 regular user
- Sample vehicles and service requests
- 2 branch locations
- 2 service trucks

## 🔐 Login Credentials

### Regular User
- **Email**: john.doe@example.com
- **Password**: password123

### Admin Users
Choose any of these admin emails:
- emmanuel.evian@autocare.com
- ibrahim.mohamud@autocare.com
- joel.nganga@autocare.com
- patience.karanja@autocare.com
- joyrose.kinuthia@autocare.com

**Admin Password**: autocarpro12k@12k.wwc

## 🛠 Manual Setup (if needed)

### Prerequisites
- Node.js 18+
- MongoDB 7.0+
- npm or yarn

### 1. Environment Variables

**Backend (.env)**:
```env
MONGODB_URI=mongodb://localhost:27017/autocare-pro
JWT_SECRET=your-super-secret-jwt-key-change-in-production-2024
JWT_EXPIRES_IN=24h
PORT=3001
NODE_ENV=development
API_VERSION=v1
SOCKET_CORS_ORIGIN=http://localhost:5173
ADMIN_PASSWORD=autocarpro12k@12k.wwc
```

**Frontend (.env)**:
```env
VITE_API_URL=http://localhost:3001/api/v1
VITE_SOCKET_URL=http://localhost:3001
VITE_APP_NAME=AutoCare Pro
VITE_APP_VERSION=1.0.0
```

### 2. Installation & Setup

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Start MongoDB (if not running)
sudo systemctl start mongod
# OR
mongod --dbpath /data/db --bind_ip_all

# Initialize database
cd backend && node scripts/init-database.js

# Start backend server
cd backend && npm run dev

# Start frontend server (in new terminal)
cd frontend && npm run dev
```

## 🌟 Features Available

### User Features
- ✅ User registration and login
- ✅ Vehicle management (add, edit, view)
- ✅ Service request creation
- ✅ Service history tracking
- ✅ Real-time status updates
- ✅ User profile management
- ✅ Dashboard with analytics

### Admin Features
- ✅ Admin login with special credentials
- ✅ Manage all service requests
- ✅ Update request status
- ✅ View all users and vehicles
- ✅ Analytics dashboard
- ✅ Branch and truck management
- ✅ Real-time system monitoring

### Technical Features
- ✅ JWT authentication
- ✅ Role-based access control
- ✅ Real-time Socket.io integration
- ✅ File upload support
- ✅ Comprehensive API validation
- ✅ Error handling and logging
- ✅ Responsive design
- ✅ Modern UI components

## 🧪 Testing the Application

### 1. User Registration Flow
1. Go to http://localhost:5173
2. Click "Register" 
3. Fill out the registration form
4. Login with new credentials

### 2. Admin Access
1. Go to http://localhost:5173/login
2. Use admin credentials
3. Access admin dashboard at /admin

### 3. API Testing
```bash
# Test health endpoint
curl http://localhost:3001/health

# Test user login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john.doe@example.com","password":"password123"}'

# Test admin login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"emmanuel.evian@autocare.com","password":"autocarpro12k@12k.wwc"}'
```

## 📁 Project Structure

```
autocare-pro/
├── backend/
│   ├── src/
│   │   ├── models/          # Database models
│   │   ├── routes/          # API routes
│   │   └── middleware/      # Express middleware
│   ├── scripts/             # Database initialization
│   ├── .env                 # Environment variables
│   └── server.js            # Main server file
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── contexts/        # React contexts
│   │   ├── pages/           # Page components
│   │   ├── services/        # API services
│   │   └── lib/             # Utilities
│   ├── .env                 # Environment variables
│   └── package.json
└── README.md
```

## 🔧 Development Commands

### Backend
```bash
npm run dev          # Start development server
npm start           # Start production server
npm run init-db     # Initialize database
```

### Frontend
```bash
npm run dev         # Start development server
npm run build       # Build for production
npm run preview     # Preview production build
```

## 🚨 Troubleshooting

### MongoDB Connection Issues
```bash
# Check if MongoDB is running
ps aux | grep mongod

# Start MongoDB manually
mongod --dbpath /data/db --bind_ip_all

# Check logs
tail -f /var/log/mongodb/mongod.log
```

### Port Conflicts
- Frontend (5173): Check for other Vite/React apps
- Backend (3001): Check for other Node.js apps
- MongoDB (27017): Check for other MongoDB instances

### Common Issues
1. **CORS errors**: Check environment variables match
2. **Auth failures**: Verify JWT secret consistency
3. **Database errors**: Ensure MongoDB is running and accessible

## 🎯 Next Steps

The application is fully functional! You can now:

1. **Customize the UI**: Modify components in `frontend/src/components/`
2. **Add new features**: Extend API routes and React components
3. **Deploy to production**: Set up proper environment variables
4. **Add more services**: Extend the service types and features
5. **Integrate payments**: Add Stripe integration (code ready)
6. **Add notifications**: Extend the real-time system

## 📞 Support

For issues or questions:
1. Check the application logs
2. Verify environment variables
3. Ensure all services are running
4. Check the browser console for frontend issues

---

🎉 **Congratulations! Your AutoCare Pro application is fully operational!**