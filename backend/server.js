require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// Load environment variables
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? 
  process.env.ALLOWED_ORIGINS.split(',') : 
  ['http://localhost:3000', 'https://onlineprofile613dee.netlify.app'];

// CORS configuration
const corsOptions = {
  origin: ALLOWED_ORIGINS,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Store visitors in a JSON file
const visitorsFile = path.join(__dirname, 'visitors.json');

// Initialize visitors data
let totalViews = 0;
let visitors = new Map();

// Load existing data
try {
  if (fs.existsSync(visitorsFile)) {
    const data = JSON.parse(fs.readFileSync(visitorsFile));
    totalViews = data.totalViews || 0;
    visitors = new Map(Object.entries(data.visitors || {}));
  }
} catch (err) {
  console.error('Error reading visitors file:', err);
}

// Save visitors to file
function saveVisitors() {
  try {
    const data = {
      totalViews,
      visitors: Object.fromEntries(visitors),
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(visitorsFile, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving visitors:', err);
  }
}

// Routes
app.get('/api/views', (req, res) => {
  res.json({ views: totalViews });
});

app.post('/api/views', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  
  // If this IP hasn't been recorded before, increment total views
  if (!visitors.has(ip)) {
    totalViews++;
    visitors.set(ip, {
      firstVisit: now,
      lastVisit: now,
      visits: 1
    });
  } else {
    const visitorData = visitors.get(ip);
    visitorData.lastVisit = now;
    visitorData.visits++;
    visitors.set(ip, visitorData);
  }
  
  saveVisitors();
  res.json({ views: totalViews });
});

app.get('/api/stats', (req, res) => {
  res.json({
    totalViews,
    uniqueVisitors: visitors.size,
    lastUpdated: new Date().toISOString(),
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
