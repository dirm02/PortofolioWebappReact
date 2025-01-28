require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();

// Load environment variables
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const ALLOWED_ORIGINS = ['https://onlineprofile613dee.netlify.app'];

// CORS configuration
app.use(cors({
  origin: 'https://onlineprofile613dee.netlify.app',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

app.use(express.json());

// Routes
app.get('/api/views', (req, res) => {
  console.log('=== GET /api/views called ===');
  const totalViews = db.getTotalViewCount();
  console.log('Current total views:', totalViews);
  res.json({ views: totalViews });
});

app.post('/api/views', (req, res) => {
  console.log('=== POST /api/views called ===');
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log('Client IP:', ip);
  
  const wasIncremented = db.recordVisit(ip);
  const totalViews = db.getTotalViewCount();
  
  console.log('View count incremented:', wasIncremented);
  console.log('Current total views:', totalViews);
  
  res.json({ views: totalViews });
});

app.get('/api/stats', (req, res) => {
  const stats = db.getStats();
  res.json({
    ...stats,
    environment: NODE_ENV
  });
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Portfolio backend is running',
    environment: NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Server is running in ${NODE_ENV} mode on port ${PORT}`);
  console.log('Allowed origins:', ALLOWED_ORIGINS);
});
