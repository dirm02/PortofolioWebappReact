const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

// Enable CORS
app.use(cors());
app.use(express.json());

// Path to store the visitors data
const VISITORS_FILE = path.join(__dirname, 'visitors.json');

// Load existing visitors from file or initialize empty set
let visitors = new Set();
try {
  if (fs.existsSync(VISITORS_FILE)) {
    const data = fs.readFileSync(VISITORS_FILE, 'utf8');
    visitors = new Set(JSON.parse(data));
  }
} catch (error) {
  console.error('Error loading visitors file:', error);
}

// Save visitors to file
const saveVisitors = () => {
  try {
    fs.writeFileSync(VISITORS_FILE, JSON.stringify([...visitors]));
  } catch (error) {
    console.error('Error saving visitors file:', error);
  }
};

// Route to get current view count
app.get('/api/views', (req, res) => {
  res.json({ views: visitors.size });
});

// Route to increment view count
app.post('/api/views', (req, res) => {
  const clientIP = req.headers['x-forwarded-for'] || 
                  req.connection.remoteAddress || 
                  req.socket.remoteAddress;
                  
  // Add IP if it's new
  if (!visitors.has(clientIP)) {
    visitors.add(clientIP);
    saveVisitors(); // Save to file when we get a new visitor
  }
  
  res.json({ views: visitors.size });
});

// Route to get current stats
app.get('/api/stats', (req, res) => {
  res.json({
    uniqueVisitors: visitors.size,
    lastUpdated: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
