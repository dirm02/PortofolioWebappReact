import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { recordVisit, getStats, getTotalViewCount, initializeDatabase } from './db.js';

const app = express();

// Load environment variables
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const ALLOWED_ORIGINS = ['https://onlineprofile613dee.netlify.app', 'http://localhost:3000'];

// Log environment information
console.log('Environment:', {
  NODE_ENV,
  PORT
});

// CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if(!origin) return callback(null, true);
    if(ALLOWED_ORIGINS.indexOf(origin) === -1) {
      var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Cache-Control', 'Pragma'],
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json());

// Routes
app.get('/api/views', async (req, res) => {
  console.log('GET /api/views called');
  try {
    const count = await getTotalViewCount();
    console.log('Current view count:', count);
    res.json({ views: count });
  } catch (err) {
    console.error('Error getting view count:', err);
    res.status(500).json({ error: 'Failed to get view count' });
  }
});

app.post('/api/views', async (req, res) => {
  console.log('POST /api/views called');
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    console.log('Visitor IP:', ip);
    
    const incremented = await recordVisit(ip);
    console.log('Visit recorded, incremented:', incremented);
    
    const count = await getTotalViewCount();
    console.log('New view count:', count);
    
    res.json({ views: count, incremented });
  } catch (err) {
    console.error('Error recording visit:', err);
    console.error(err.stack);
    res.status(500).json({ error: 'Failed to record visit' });
  }
});

app.get('/api/stats', async (req, res) => {
  console.log('GET /api/stats called');
  try {
    const stats = await getStats();
    console.log('Current stats:', stats);
    res.json({
      ...stats,
      environment: NODE_ENV
    });
  } catch (err) {
    console.error('Error getting stats:', err);
    console.error(err.stack);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('Health check called');
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV
  });
});

// Start server after database is initialized
async function startServer() {
  try {
    console.log('Initializing database...');
    await initializeDatabase();
    console.log('Database initialized successfully');

    app.listen(PORT, () => {
      console.log(`Server is running in ${NODE_ENV} mode on port ${PORT}`);
      console.log('Allowed origins:', ALLOWED_ORIGINS);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    console.error('Stack trace:', err.stack);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});

startServer();
