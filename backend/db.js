import pg from 'pg';
const { Pool } = pg;

// Create a new pool using the DATABASE_URL environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Render's PostgreSQL
  }
});

// Test database connection
pool.on('connect', () => {
  console.log('PostgreSQL connection established');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

// Initialize database
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    console.log('Initializing PostgreSQL database...');
    console.log('Database URL:', process.env.DATABASE_URL ? 'Present' : 'Missing');

    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS visitors (
        ip TEXT PRIMARY KEY,
        first_visit BIGINT,
        last_visit BIGINT,
        visit_count INTEGER DEFAULT 1
      )
    `);
    console.log('Visitors table ready');

    await client.query(`
      CREATE TABLE IF NOT EXISTS stats (
        key TEXT PRIMARY KEY,
        value INTEGER
      )
    `);
    console.log('Stats table ready');

    // Initialize total_views if it doesn't exist
    const result = await client.query(
      'INSERT INTO stats (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING RETURNING value',
      ['total_views', 0]
    );
    
    if (result.rowCount > 0) {
      console.log('Initialized total_views with 0');
    } else {
      const current = await client.query('SELECT value FROM stats WHERE key = $1', ['total_views']);
      console.log('Current total_views:', current.rows[0]?.value || 0);
    }

    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
    console.error('Stack trace:', err.stack);
    throw err;
  } finally {
    client.release();
  }
}

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
      console.log('New visitor recorded:', { ip, timestamp: new Date(now).toISOString() });
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
        console.log('Returning visitor updated:', { ip, hoursSinceLastVisit: Math.floor(hoursSinceLastVisit) });
      } else {
        console.log('Recent visitor, not counting:', { ip, hoursSinceLastVisit: Math.floor(hoursSinceLastVisit) });
      }
    }

    // Commit transaction
    await client.query('COMMIT');
    return incremented;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error recording visit:', err);
    console.error('Stack trace:', err.stack);
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
    const response = {
      totalViews: parseInt(stats.total_views) || 0,
      uniqueVisitors: parseInt(stats.unique_visitors) || 0,
      lastVisit: stats.last_visit ? new Date(parseInt(stats.last_visit)).toISOString() : null
    };
    console.log('Current stats:', response);
    return response;
  } catch (err) {
    console.error('Error getting stats:', err);
    console.error('Stack trace:', err.stack);
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
    const count = result.rows[0]?.value || 0;
    console.log('Current total views:', count);
    return count;
  } catch (err) {
    console.error('Error getting total view count:', err);
    console.error('Stack trace:', err.stack);
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
export {
  recordVisit,
  getStats,
  getTotalViewCount,
  initializeDatabase
}; 