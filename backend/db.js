const { Pool } = require('pg');
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

// Create a new pool using the DATABASE_URL environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Render's PostgreSQL
  }
});

// Initialize database
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    console.log('Initializing PostgreSQL database...');

    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS visitors (
        ip TEXT PRIMARY KEY,
        first_visit BIGINT,
        last_visit BIGINT,
        visit_count INTEGER DEFAULT 1
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS stats (
        key TEXT PRIMARY KEY,
        value INTEGER
      )
    `);

    // Initialize total_views if it doesn't exist
    await client.query(
      'INSERT INTO stats (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
      ['total_views', 0]
    );

    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Initialize the database when the module is imported
initializeDatabase().catch(console.error);

// Promisify database operations
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  console.log('Running SQL:', sql, 'with params:', params);
  pool.query(sql, params, (err, result) => {
    if (err) {
      console.error('SQL Error:', err);
      reject(err);
    } else {
      console.log('SQL Success - lastID:', result.rows[0]?.lastID, 'changes:', result.rows[0]?.rowCount);
      resolve(result.rows[0]);
    }
  });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  console.log('Getting SQL:', sql, 'with params:', params);
  pool.query(sql, params, (err, result) => {
    if (err) {
      console.error('SQL Error:', err);
      reject(err);
    } else {
      console.log('SQL Result:', result.rows[0]);
      resolve(result.rows[0]);
    }
  });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  console.log('Getting All SQL:', sql, 'with params:', params);
  pool.query(sql, params, (err, result) => {
    if (err) {
      console.error('SQL Error:', err);
      reject(err);
    } else {
      console.log('SQL Results count:', result.rows?.length);
      resolve(result.rows);
    }
  });
});

// Initialize tables
console.log('Starting database initialization');
pool.query(`
  CREATE TABLE IF NOT EXISTS visitors (
    ip TEXT PRIMARY KEY,
    first_visit BIGINT,
    last_visit BIGINT,
    visit_count INTEGER DEFAULT 1
  )
`);

pool.query(`
  CREATE TABLE IF NOT EXISTS stats (
    key TEXT PRIMARY KEY,
    value INTEGER
  )
`);

// Load backup data if exists
try {
  if (fs.existsSync(BACKUP_FILE)) {
    console.log('Found backup file, loading data...');
    const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
    console.log('Backup data:', backup);
    
    // Restore total views
    await dbRun('UPDATE stats SET value = $1 WHERE key = $2', [backup.totalViews || 0, 'total_views']);
    
    // Restore visitors
    if (backup.visitors && Object.keys(backup.visitors).length > 0) {
      console.log('Restoring visitor records...');
      const stmt = await pool.query('INSERT INTO visitors (ip, first_visit, last_visit, visit_count) VALUES ($1, $2, $3, $4)');
      for (const [ip, data] of Object.entries(backup.visitors)) {
        stmt.rows.push(await dbRun('INSERT INTO visitors (ip, first_visit, last_visit, visit_count) VALUES ($1, $2, $3, $4)', [ip, data.first_visit, data.last_visit, data.visit_count]));
      }
      console.log('Visitor records restored');
    }
    
    console.log('Backup restored successfully');
  } else {
    console.log('No backup file found, initializing with zero counts');
    await dbRun('UPDATE stats SET value = $1 WHERE key = $2', [0, 'total_views']);
  }
} catch (err) {
  console.error('Error during backup restore:', err);
  console.error(err.stack);
  await dbRun('UPDATE stats SET value = $1 WHERE key = $2', [0, 'total_views']);
}

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
  const client = await pool.connect();
  try {
    const now = Date.now();
    
    // Start transaction
    await client.query('BEGIN');

    // Check if visitor exists
    const visitorResult = await client.query(
      'SELECT * FROM visitors WHERE ip = $1',
      [ip]
    );

    let incremented = false;
    if (!visitorResult.rows[0]) {
      // New visitor
      await client.query(
        'INSERT INTO visitors (ip, first_visit, last_visit, visit_count) VALUES ($1, $2, $3, 1)',
        [ip, now, now]
      );
      await client.query(
        'UPDATE stats SET value = value + 1 WHERE key = $1',
        ['total_views']
      );
      incremented = true;
    } else {
      const visitor = visitorResult.rows[0];
      const hoursSinceLastVisit = (now - parseInt(visitor.last_visit)) / (1000 * 60 * 60);
      
      if (hoursSinceLastVisit >= 24) {
        // Update returning visitor after 24 hours
        await client.query(
          'UPDATE visitors SET last_visit = $1, visit_count = visit_count + 1 WHERE ip = $2',
          [now, ip]
        );
        await client.query(
          'UPDATE stats SET value = value + 1 WHERE key = $1',
          ['total_views']
        );
        incremented = true;
      }
    }

    // Commit transaction
    await client.query('COMMIT');
    return incremented;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error recording visit:', err);
    throw err;
  } finally {
    client.release();
  }
}

async function getStats() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        (SELECT value FROM stats WHERE key = 'total_views') as total_views,
        COUNT(*) as unique_visitors,
        MAX(last_visit) as last_visit
      FROM visitors
    `);
    
    const stats = result.rows[0];
    return {
      totalViews: parseInt(stats.total_views) || 0,
      uniqueVisitors: parseInt(stats.unique_visitors) || 0,
      lastVisit: stats.last_visit ? new Date(parseInt(stats.last_visit)).toISOString() : null
    };
  } catch (err) {
    console.error('Error getting stats:', err);
    throw err;
  } finally {
    client.release();
  }
}

async function getTotalViewCount() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT value FROM stats WHERE key = $1',
      ['total_views']
    );
    return result.rows[0]?.value || 0;
  } catch (err) {
    console.error('Error getting total view count:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Handle process termination
process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal');
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});

// Export functions
module.exports = {
  recordVisit,
  getStats,
  getTotalViewCount,
  initializeDatabase
}; 