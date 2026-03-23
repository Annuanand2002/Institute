const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'institute',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Test connection
pool.getConnection()
  .then(connection => {
    console.log('✅ Database connected successfully');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Database connection error:', err.message);
    console.error('Error code:', err.code);
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n⚠️  Access denied. Possible issues:');
      console.error('1. Password is incorrect');
      console.error('2. User does not have permission');
      console.error('3. MySQL authentication plugin issue');
      console.error('\nTry running: npm run test-mysql');
    }
  });

module.exports = pool;
