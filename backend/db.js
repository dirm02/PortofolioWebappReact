const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database and backup paths
const DB_DIR = process.env.NODE_ENV === 'production' ? '/tmp' : __dirname;
const DB_FILE = path.join(DB_DIR, 'visitors.db');
const BACKUP_FILE = path.join(DB_DIR, 'visitors_backup.json');

console.log('Database path:', DB_FILE);
console.log('Backup file path:', BACKUP_FILE);

// Ensure database directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Initialize file-based database
console.log('Initializing SQLite database');
const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Database initialized successfully');
  }
});

// Promisify database operations
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  console.log('Running SQL:', sql, 'with params:', params);
  db.run(sql, params, function(err) {
    if (err) {
      console.error('SQL Error:', err);
      reject(err);
    } else {
      console.log('SQL Success - lastID:', this.lastID, 'changes:', this.changes);
      resolve(this);
    }
  });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  console.log('Getting SQL:', sql, 'with params:', params);
  db.get(sql, params, (err, row) => {
    if (err) {
      console.error('SQL Error:', err);
      reject(err);
    } else {
      console.log('SQL Result:', row);
      resolve(row);
    }
  });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  console.log('Getting All SQL:', sql, 'with params:', params);
  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('SQL Error:', err);
      reject(err);
    } else {
      console.log('SQL Results count:', rows?.length);
      resolve(rows);
    }
  });
});

// Initialize tables
console.log('Starting database initialization');
db.serialize(() => {
  console.log('Creating tables...');
  db.run(`CREATE TABLE visitors (
    ip TEXT PRIMARY KEY,
    first_visit INTEGER,
    last_visit INTEGER,
    visit_count INTEGER DEFAULT 1
  )`, [], (err) => {
    if (err) console.error('Error creating visitors table:', err);
    else console.log('Visitors table created successfully');
  });

  db.run(`CREATE TABLE stats (
    key TEXT PRIMARY KEY,
    value INTEGER
  )`, [], (err) => {
    if (err) console.error('Error creating stats table:', err);
    else console.log('Stats table created successfully');
  });

  // Load backup data if exists
  try {
    if (fs.existsSync(BACKUP_FILE)) {
      console.log('Found backup file, loading data...');
      const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
      console.log('Backup data:', backup);
      
      // Restore total views
      db.run('INSERT INTO stats (key, value) VALUES (?, ?)', ['total_views', backup.totalViews || 0], (err) => {
        if (err) console.error('Error restoring total views:', err);
        else console.log('Total views restored:', backup.totalViews || 0);
      });
      
      // Restore visitors
      if (backup.visitors && Object.keys(backup.visitors).length > 0) {
        console.log('Restoring visitor records...');
        const stmt = db.prepare('INSERT INTO visitors (ip, first_visit, last_visit, visit_count) VALUES (?, ?, ?, ?)');
        for (const [ip, data] of Object.entries(backup.visitors)) {
          stmt.run(ip, data.first_visit, data.last_visit, data.visit_count, (err) => {
            if (err) console.error('Error restoring visitor:', ip, err);
          });
        }
        stmt.finalize();
        console.log('Visitor records restored');
      }
      
      console.log('Backup restored successfully');
    } else {
      console.log('No backup file found, initializing with zero counts');
      db.run('INSERT INTO stats (key, value) VALUES (?, ?)', ['total_views', 0], (err) => {
        if (err) console.error('Error initializing total views:', err);
        else console.log('Total views initialized to 0');
      });
    }
  } catch (err) {
    console.error('Error during backup restore:', err);
    console.error(err.stack);
    db.run('INSERT INTO stats (key, value) VALUES (?, ?)', ['total_views', 0], (err) => {
      if (err) console.error('Error initializing total views after failed restore:', err);
      else console.log('Total views initialized to 0 after failed restore');
    });
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