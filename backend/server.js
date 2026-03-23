const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware (increase limit for organisation forms with base64 images)
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Import routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const coursesRoutes = require('./routes/courses');
const batchesRoutes = require('./routes/batches');
const transactionsRoutes = require('./routes/transactions');
const organisationsRoutes = require('./routes/organisations');
const userProfilesRoutes = require('./routes/user-profiles');

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to Institute Management System API',
    version: '1.0.0'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// Log all API requests (debug)
app.use('/api', (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('[API]', req.method, req.originalUrl);
  }
  next();
});

// API Routes (organisations early to avoid any route conflicts)
app.use('/api/auth', authRoutes);
// Explicit POST for user profile create (workaround for 404)
app.post('/api/auth/create-profile', (req, res, next) => {
  req.url = '/create-profile';
  req.baseUrl = '/api/auth';
  authRoutes(req, res, next);
});
// Explicit POST for organisation create (workaround for 404)
app.post('/api/organisations', (req, res, next) => {
  req.url = '/';
  req.baseUrl = '/api/organisations';
  organisationsRoutes(req, res, next);
});
app.post('/api/organisation', (req, res, next) => {
  req.url = '/';
  req.baseUrl = '/api/organisation';
  organisationsRoutes(req, res, next);
});
app.use('/api/organisations', organisationsRoutes);
app.use('/api/organisation', organisationsRoutes); // alias for GET, PUT, DELETE
app.post('/api/users', (req, res, next) => {
  req.url = '/';
  req.baseUrl = '/api/users';
  usersRoutes(req, res, next);
});
app.use('/api/users', usersRoutes);
app.post('/api/courses', (req, res, next) => {
  req.url = '/';
  req.baseUrl = '/api/courses';
  coursesRoutes(req, res, next);
});
app.use('/api/courses', coursesRoutes);
app.post('/api/batches', (req, res, next) => {
  req.url = '/';
  req.baseUrl = '/api/batches';
  batchesRoutes(req, res, next);
});
app.use('/api/batches', batchesRoutes);
app.post('/api/transactions', (req, res, next) => {
  req.url = '/';
  req.baseUrl = '/api/transactions';
  transactionsRoutes(req, res, next);
});
app.use('/api/transactions', transactionsRoutes);
app.use('/api/user-profiles', userProfilesRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: err.message 
  });
});

// 404 handler (log for debugging)
app.use((req, res) => {
  console.log('[404] Route not found:', req.method, req.originalUrl);
  res.status(404).json({ 
    error: 'Route not found' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
