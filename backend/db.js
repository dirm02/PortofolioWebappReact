const Database = require('better-sqlite3');
const path = require('path');

// Initialize database
const db = new Database(path.join(__dirname, 'visitors.db'), { verbose: console.log });

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS visitors (
    ip TEXT PRIMARY KEY,
    first_visit INTEGER,
    last_visit INTEGER,
    visit_count INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS stats (
    key TEXT PRIMARY KEY,
    value INTEGER
  );
`);

// Initialize total_views if it doesn't exist
const initStats = db.prepare('INSERT OR IGNORE INTO stats (key, value) VALUES (?, ?)');
initStats.run('total_views', 0);

// Prepare statements
const getVisitor = db.prepare('SELECT * FROM visitors WHERE ip = ?');
const insertVisitor = db.prepare(`
  INSERT INTO visitors (ip, first_visit, last_visit, visit_count)
  VALUES (?, ?, ?, 1)
`);
const updateVisitor = db.prepare(`
  UPDATE visitors 
  SET last_visit = ?, visit_count = visit_count + 1
  WHERE ip = ?
`);
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

module.exports = {
  recordVisit,
  getStats,
  getTotalViewCount
}; 