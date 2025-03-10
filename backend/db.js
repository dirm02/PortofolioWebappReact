import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create SQLite database file in the backend directory
const dbPath = path.join(__dirname, 'portfolio.sqlite');
console.log(`Using SQLite database at: ${dbPath}`);

// Initialize SQLite database
const db = new sqlite3.Database(dbPath);

// Promisify SQLite methods for async/await usage
db.runAsync = promisify(db.run.bind(db));
db.getAsync = promisify(db.get.bind(db));
db.allAsync = promisify(db.all.bind(db));

// Initialize database
async function initializeDatabase() {
  try {
    console.log('Initializing SQLite database...');
    
    // Create visitors table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS visitors (
        ip TEXT PRIMARY KEY,
        first_visit INTEGER,
        last_visit INTEGER,
        visit_count INTEGER DEFAULT 1
      )
    `);
    console.log('Visitors table ready');

    // Create stats table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS stats (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
    console.log('Stats table ready');

    // Initialize stats if they don't exist
    const statsKeys = ['browsers', 'os', 'countries', 'referrers', 'viewCount'];
    for (const key of statsKeys) {
      const exists = await db.getAsync('SELECT value FROM stats WHERE key = ?', [key]);
      if (!exists) {
        const defaultValue = key === 'viewCount' ? '0' : '{}';
        await db.runAsync('INSERT INTO stats (key, value) VALUES (?, ?)', [key, defaultValue]);
      }
    }

    console.log('SQLite database initialized successfully');
  } catch (error) {
    console.error('Error initializing SQLite database:', error);
    console.log('Stack trace:', error.stack);
    throw error;
  }
}

/**
 * Record a visit from an IP address
 * @param {string} ip - The IP address of the visitor
 * @param {Object} visitInfo - Optional information about the visit
 * @returns {Promise<Object>} - Stats about the visitor
 */
async function recordVisit(ip, visitInfo = {}) {
  try {
    const now = Date.now();
    const { browser = 'Unknown', os = 'Unknown', country = 'Unknown', referrer = 'Direct' } = visitInfo;
    
    // Update or insert visitor record
    const visitor = await db.getAsync('SELECT * FROM visitors WHERE ip = ?', [ip]);
    
    if (visitor) {
      // Update existing visitor
      await db.runAsync(
        'UPDATE visitors SET last_visit = ?, visit_count = visit_count + 1 WHERE ip = ?',
        [now, ip]
      );
    } else {
      // Insert new visitor
      await db.runAsync(
        'INSERT INTO visitors (ip, first_visit, last_visit, visit_count) VALUES (?, ?, ?, 1)',
        [ip, now, now]
      );
    }

    // Update stats
    await updateStats('browsers', browser);
    await updateStats('os', os);
    await updateStats('countries', country);
    await updateStats('referrers', referrer);
    
    // Increment view count
    await incrementViewCount();

    return {
      ip,
      visits: visitor ? visitor.visit_count + 1 : 1,
      firstVisit: visitor ? visitor.first_visit : now,
      lastVisit: now
    };
  } catch (error) {
    console.error('Error recording visit:', error);
    return { error: 'Failed to record visit' };
  }
}

/**
 * Helper function to update stats counters
 */
async function updateStats(statKey, itemKey) {
  try {
    // Get current stats
    const result = await db.getAsync('SELECT value FROM stats WHERE key = ?', [statKey]);
    let stats = result ? JSON.parse(result.value) : {};
    
    // Update counter
    stats[itemKey] = (stats[itemKey] || 0) + 1;
    
    // Save back to database
    await db.runAsync(
      'UPDATE stats SET value = ? WHERE key = ?',
      [JSON.stringify(stats), statKey]
    );
  } catch (error) {
    console.error(`Error updating ${statKey} stats:`, error);
  }
}

/**
 * Helper function to increment the view count
 */
async function incrementViewCount() {
  try {
    await db.runAsync(
      'UPDATE stats SET value = CAST((CAST(value AS INTEGER) + 1) AS TEXT) WHERE key = ?',
      ['viewCount']
    );
  } catch (error) {
    console.error('Error incrementing view count:', error);
  }
}

/**
 * Get all statistics
 * @returns {Promise<Object>} - All statistics
 */
async function getStats() {
  try {
    const allStats = await db.allAsync('SELECT key, value FROM stats');
    const result = {};
    
    for (const row of allStats) {
      if (row.key === 'viewCount') {
        result[row.key] = parseInt(row.value, 10);
      } else {
        result[row.key] = JSON.parse(row.value);
      }
    }
    
    // Get visitor count
    const visitorCount = await db.getAsync('SELECT COUNT(*) as count FROM visitors');
    result.visitorCount = visitorCount.count;
    
    return result;
  } catch (error) {
    console.error('Error getting stats:', error);
    return { error: 'Failed to get stats' };
  }
}

/**
 * Get the total view count
 * @returns {Promise<number>} - The total view count
 */
async function getTotalViewCount() {
  try {
    const result = await db.getAsync('SELECT value FROM stats WHERE key = ?', ['viewCount']);
    return result ? parseInt(result.value, 10) : 0;
  } catch (error) {
    console.error('Error getting total view count:', error);
    return 0;
  }
}

export { initializeDatabase, recordVisit, getStats, getTotalViewCount }; 