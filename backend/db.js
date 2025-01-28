const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Backup file path
const BACKUP_FILE = path.join(__dirname, 'visitors_backup.json');

// Initialize database in memory for Render free tier
const db = new Database(':memory:', { verbose: console.log });

// Create tables
db.exec(`
  CREATE TABLE visitors (
    ip TEXT PRIMARY KEY,
    first_visit INTEGER,
    last_visit INTEGER,
    visit_count INTEGER DEFAULT 1
  );

  CREATE TABLE stats (
    key TEXT PRIMARY KEY,
    value INTEGER
  );
`);

// Load backup data if exists
try {
  if (fs.existsSync(BACKUP_FILE)) {
    console.log('Loading backup data...');
    const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
    
    // Restore total views
    db.prepare('INSERT INTO stats (key, value) VALUES (?, ?)').run('total_views', backup.totalViews || 0);
    
    // Restore visitors
    const insertVisitor = db.prepare('INSERT INTO visitors (ip, first_visit, last_visit, visit_count) VALUES (?, ?, ?, ?)');
    for (const [ip, data] of Object.entries(backup.visitors || {})) {
      insertVisitor.run(ip, data.first_visit, data.last_visit, data.visit_count);
    }
    
    console.log('Backup restored:', {
      totalViews: backup.totalViews,
      visitorCount: Object.keys(backup.visitors || {}).length
    });
  } else {
    // Initialize stats if no backup
    db.prepare('INSERT INTO stats (key, value) VALUES (?, ?)').run('total_views', 0);
  }
} catch (err) {
  console.error('Error loading backup:', err);
  // Initialize stats if backup fails
  db.prepare('INSERT INTO stats (key, value) VALUES (?, ?)').run('total_views', 0);
}

// Save backup every 5 minutes
setInterval(() => {
  try {
    const stats = getAllStats.get();
    const visitors = {};
    
    // Get all visitors
    const rows = db.prepare('SELECT * FROM visitors').all();
    for (const row of rows) {
      visitors[row.ip] = {
        first_visit: row.first_visit,
        last_visit: row.last_visit,
        visit_count: row.visit_count
      };
    }
    
    // Save backup
    const backup = {
      totalViews: stats.total_views || 0,
      visitors,
      lastUpdated: new Date().toISOString()
    };
    
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2));
    console.log('Backup saved:', {
      totalViews: backup.totalViews,
      visitorCount: Object.keys(visitors).length
    });
  } catch (err) {
    console.error('Error saving backup:', err);
  }
}, 5 * 60 * 1000); // Every 5 minutes

// Prepare statements
const getVisitor = db.prepare('SELECT * FROM visitors WHERE ip = ?');
const insertVisitor = db.prepare('INSERT INTO visitors (ip, first_visit, last_visit, visit_count) VALUES (?, ?, ?, 1)');
const updateVisitor = db.prepare('UPDATE visitors SET last_visit = ?, visit_count = visit_count + 1 WHERE ip = ?');
const getTotalViews = db.prepare('SELECT value FROM stats WHERE key = ?');
const incrementTotalViews = db.prepare('UPDATE stats SET value = value + 1 WHERE key = ?');
const getAllStats = db.prepare(`
  SELECT 
    (SELECT value FROM stats WHERE key = 'total_views') as total_views,
    COUNT(*) as unique_visitors,
    MAX(last_visit) as last_visit
  FROM visitors
`);

function recordVisit(ip) {
  const now = Date.now();
  const visitor = getVisitor.get(ip);
  
  if (!visitor) {
    // New visitor
    insertVisitor.run(ip, now, now);
    incrementTotalViews.run('total_views');
    return true;
  } else {
    // Returning visitor
    const hoursSinceLastVisit = (now - visitor.last_visit) / (1000 * 60 * 60);
    if (hoursSinceLastVisit >= 24) {
      updateVisitor.run(now, ip);
      incrementTotalViews.run('total_views');
      return true;
    }
    return false;
  }
}

function getStats() {
  const stats = getAllStats.get();
  return {
    totalViews: stats.total_views || 0,
    uniqueVisitors: stats.unique_visitors || 0,
    lastVisit: stats.last_visit ? new Date(stats.last_visit).toISOString() : null
  };
}

function getTotalViewCount() {
  const result = getTotalViews.get('total_views');
  return result ? result.value : 0;
}

// Handle process termination
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, saving final backup...');
  try {
    const stats = getAllStats.get();
    const visitors = {};
    const rows = db.prepare('SELECT * FROM visitors').all();
    for (const row of rows) {
      visitors[row.ip] = {
        first_visit: row.first_visit,
        last_visit: row.last_visit,
        visit_count: row.visit_count
      };
    }
    const backup = {
      totalViews: stats.total_views || 0,
      visitors,
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2));
    console.log('Final backup saved');
  } catch (err) {
    console.error('Error saving final backup:', err);
  }
  process.exit(0);
});

module.exports = {
  recordVisit,
  getStats,
  getTotalViewCount
}; 