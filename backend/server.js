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
app.get('/api/views', async (req, res) => {
  try {
    const count = await db.getTotalViewCount();
    res.json({ views: count });
  } catch (err) {
    console.error('Error getting view count:', err);
    res.status(500).json({ error: 'Failed to get view count' });
  }
});

app.post('/api/views', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const incremented = await db.recordVisit(ip);
    const count = await db.getTotalViewCount();
    res.json({ views: count, incremented });
  } catch (err) {
    console.error('Error recording visit:', err);
    res.status(500).json({ error: 'Failed to record visit' });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json({
      ...stats,
      environment: NODE_ENV
    });
  } catch (err) {
    console.error('Error getting stats:', err);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server is running in ${NODE_ENV} mode on port ${PORT}`);
  console.log('Allowed origins:', ALLOWED_ORIGINS);
});
