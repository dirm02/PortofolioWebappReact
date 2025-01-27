require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const app = express();

// Load environment variables
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const ALLOWED_ORIGINS = ['https://onlineprofile613dee.netlify.app'];

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || ALLOWED_ORIGINS.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Origin not allowed:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Cache-Control', 'Pragma'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Store visitors in a JSON file
const visitorsFile = path.join(__dirname, 'visitors.json');

// Store visitors in memory and persist to environment
let totalViews = parseInt(process.env.TOTAL_VIEWS) || 0;
let visitors = new Map();
let isStarting = true;

// Function to update environment variable
async function updateEnvVar() {
  if (process.env.RENDER_EXTERNAL_URL) {
    console.log('Updating TOTAL_VIEWS environment variable:', totalViews);
    // Note: In Render, you'll need to manually update this through the dashboard
    // This log helps you know what value to set
  }
}

// Startup health check
async function checkHealth() {
  try {
    console.log('Performing startup health check...');
    const response = await fetch(process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`);
    if (response.ok) {
      console.log('Server is healthy');
      isStarting = false;
    }
  } catch (err) {
    console.log('Server is still starting up...');
  }
}

// Check health every 10 seconds during startup
const healthCheckInterval = setInterval(() => {
  if (!isStarting) {
    clearInterval(healthCheckInterval);
  } else {
    checkHealth();
  }
}, 10000);

// Load existing data
try {
  console.log('=== Loading Visitor Data ===');
  console.log('Initial total views from env:', totalViews);
  console.log('Visitors file path:', visitorsFile);
  
  if (fs.existsSync(visitorsFile)) {
    const fileContent = fs.readFileSync(visitorsFile);
    console.log('File exists, size:', fileContent.length, 'bytes');
    
    const data = JSON.parse(fileContent);
    console.log('Parsed data:', {
      totalViews: data.totalViews,
      visitorCount: Object.keys(data.visitors || {}).length,
      lastUpdated: data.lastUpdated
    });
    
    // Use the larger value between file and environment variable
    totalViews = Math.max(totalViews, data.totalViews || 0);
    visitors = new Map(Object.entries(data.visitors || {}));
  } else {
    console.log('No existing visitors file found, using env value:', totalViews);
    visitors = new Map();
    saveVisitors(); // Create initial file
  }
} catch (err) {
  console.error('Error reading visitors file:', err);
  console.error('Stack:', err.stack);
  console.error('Current directory:', __dirname);
  console.log('Falling back to env value:', totalViews);
}

// Save visitors to file
function saveVisitors() {
  try {
    console.log('=== Saving Visitor Data ===');
    const data = {
      totalViews,
      visitors: Object.fromEntries(visitors),
      lastUpdated: new Date().toISOString()
    };
    console.log('Data to save:', {
      totalViews: data.totalViews,
      visitorCount: Object.keys(data.visitors).length,
      lastUpdated: data.lastUpdated
    });
    
    fs.writeFileSync(visitorsFile, JSON.stringify(data, null, 2));
    console.log('Data saved successfully');
    
    // Verify the save
    const savedContent = fs.readFileSync(visitorsFile, 'utf8');
    const savedData = JSON.parse(savedContent);
    console.log('Verified saved data:', {
      totalViews: savedData.totalViews,
      visitorCount: Object.keys(savedData.visitors).length,
      lastUpdated: savedData.lastUpdated
    });
  } catch (err) {
    console.error('Error saving visitors:', err);
    console.error('Stack:', err.stack);
    console.error('Attempted to save to:', visitorsFile);
  }
}

// Routes
app.get('/api/views', (req, res) => {
  console.log('=== GET /api/views called ===');
  console.log('Server status:', isStarting ? 'starting up' : 'ready');
  console.log('Current total views:', totalViews);
  console.log('Number of unique visitors:', visitors.size);
  
  // If server is still starting up, return cached value
  if (isStarting) {
    console.log('Server is still starting, returning environment value');
    return res.json({ views: totalViews, status: 'warming_up' });
  }
  
  res.json({ views: totalViews, status: 'ready' });
});

app.post('/api/views', (req, res) => {
  console.log('POST /api/views called');
  console.log('Client IP:', req.headers['x-forwarded-for'] || req.socket.remoteAddress);
  console.log('Origin:', req.headers.origin);
  
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  const lastVisit = visitors.get(ip)?.lastVisit || 0;
  
  // Only count as a new view if:
  // 1. This IP hasn't been seen before, or
  // 2. It's been more than 24 hours since their last visit
  if (!visitors.has(ip) || (now - lastVisit) > 24 * 60 * 60 * 1000) {
    console.log('New visit detected - incrementing count');
    totalViews++;
    visitors.set(ip, {
      firstVisit: visitors.get(ip)?.firstVisit || now,
      lastVisit: now,
      visits: (visitors.get(ip)?.visits || 0) + 1
    });
    saveVisitors();
  } else {
    console.log('Returning visitor within 24 hours - not incrementing count');
  }
  
  console.log('Current total views:', totalViews);
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
