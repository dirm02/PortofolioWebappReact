const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Backup file path
const BACKUP_FILE = path.join(__dirname, 'visitors_backup.json');

// Initialize database in memory
const db = new sqlite3.Database(':memory:');

// Promisify database operations
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve(this);
  });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

// Initialize tables
db.serialize(() => {
  db.run(`CREATE TABLE visitors (
    ip TEXT PRIMARY KEY,
    first_visit INTEGER,
    last_visit INTEGER,
    visit_count INTEGER DEFAULT 1
  )`);

  db.run(`CREATE TABLE stats (
    key TEXT PRIMARY KEY,
    value INTEGER
  )`);

  // Load backup data if exists
  try {
    if (fs.existsSync(BACKUP_FILE)) {
      console.log('Loading backup data...');
      const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
      
      // Restore total views
      db.run('INSERT INTO stats (key, value) VALUES (?, ?)', ['total_views', backup.totalViews || 0]);
      
      // Restore visitors
      const stmt = db.prepare('INSERT INTO visitors (ip, first_visit, last_visit, visit_count) VALUES (?, ?, ?, ?)');
      for (const [ip, data] of Object.entries(backup.visitors || {})) {
        stmt.run(ip, data.first_visit, data.last_visit, data.visit_count);
      }
      stmt.finalize();
      
      console.log('Backup restored:', {
        totalViews: backup.totalViews,
        visitorCount: Object.keys(backup.visitors || {}).length
      });
    } else {
      // Initialize stats if no backup
      db.run('INSERT INTO stats (key, value) VALUES (?, ?)', ['total_views', 0]);
    }
  } catch (err) {
    console.error('Error loading backup:', err);
    // Initialize stats if backup fails
    db.run('INSERT INTO stats (key, value) VALUES (?, ?)', ['total_views', 0]);
  }
});

// Save backup every 5 minutes
setInterval(async () => {
  try {
    const stats = await dbGet(`
      SELECT 
        (SELECT value FROM stats WHERE key = 'total_views') as total_views,
        COUNT(*) as unique_visitors,
        MAX(last_visit) as last_visit
      FROM visitors
    `);
    
    const rows = await dbAll('SELECT * FROM visitors');
    const visitors = {};
    
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
    console.log('Backup saved:', {
      totalViews: backup.totalViews,
      visitorCount: Object.keys(visitors).length
    });
  } catch (err) {
    console.error('Error saving backup:', err);
  }
}, 5 * 60 * 1000);

async function recordVisit(ip) {
  const now = Date.now();
  const visitor = await dbGet('SELECT * FROM visitors WHERE ip = ?', [ip]);
  
  if (!visitor) {
    // New visitor
    await dbRun('INSERT INTO visitors (ip, first_visit, last_visit, visit_count) VALUES (?, ?, ?, 1)', [ip, now, now]);
    await dbRun('UPDATE stats SET value = value + 1 WHERE key = ?', ['total_views']);
    return true;
  } else {
    // Returning visitor
    const hoursSinceLastVisit = (now - visitor.last_visit) / (1000 * 60 * 60);
    if (hoursSinceLastVisit >= 24) {
      await dbRun('UPDATE visitors SET last_visit = ?, visit_count = visit_count + 1 WHERE ip = ?', [now, ip]);
      await dbRun('UPDATE stats SET value = value + 1 WHERE key = ?', ['total_views']);
      return true;
    }
    return false;
  }
}

async function getStats() {
  const stats = await dbGet(`
    SELECT 
      (SELECT value FROM stats WHERE key = 'total_views') as total_views,
      COUNT(*) as unique_visitors,
      MAX(last_visit) as last_visit
    FROM visitors
  `);
  
  return {
    totalViews: stats.total_views || 0,
    uniqueVisitors: stats.unique_visitors || 0,
    lastVisit: stats.last_visit ? new Date(stats.last_visit).toISOString() : null
  };
}

async function getTotalViewCount() {
  const result = await dbGet('SELECT value FROM stats WHERE key = ?', ['total_views']);
  return result ? result.value : 0;
}

// Handle process termination
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, saving final backup...');
  try {
    const stats = await getStats();
    const rows = await dbAll('SELECT * FROM visitors');
    const visitors = {};
    
    for (const row of rows) {
      visitors[row.ip] = {
        first_visit: row.first_visit,
        last_visit: row.last_visit,
        visit_count: row.visit_count
      };
    }
    
    const backup = {
      totalViews: stats.totalViews,
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