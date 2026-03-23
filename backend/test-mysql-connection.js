const mysql = require('mysql2/promise');

async function testConnection() {
  console.log('Testing MySQL connection...\n');
  
  const password = '1q2w3E*';
  
  // Test 1: Connect without specifying database first
  console.log('Test 1: Trying to connect to MySQL server (without database)...');
  try {
    const connection1 = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: password
    });
    console.log('✅ SUCCESS: Connected to MySQL server!');
    
    // Check if institute database exists
    const [databases] = await connection1.execute('SHOW DATABASES');
    const dbExists = databases.some(db => db.Database === 'institute');
    
    if (dbExists) {
      console.log('✅ Database "institute" exists');
    } else {
      console.log('⚠️  Database "institute" does NOT exist');
      console.log('Available databases:', databases.map(db => db.Database).join(', '));
    }
    
    await connection1.end();
    
    // Test 2: Try connecting to institute database
    if (dbExists) {
      console.log('\nTest 2: Trying to connect to "institute" database...');
      try {
        const connection2 = await mysql.createConnection({
          host: 'localhost',
          user: 'root',
          password: password,
          database: 'institute'
        });
        console.log('✅ SUCCESS: Connected to "institute" database!');
        await connection2.end();
        return password;
      } catch (error) {
        console.log('❌ Failed to connect to database:', error.message);
        console.log('Error code:', error.code);
      }
    }
    
    return password;
  } catch (error) {
    console.log('❌ Failed:', error.message);
    console.log('Error code:', error.code);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n⚠️  Password is incorrect or user does not have permission.');
      console.log('Possible solutions:');
      console.log('1. Verify the password is correct');
      console.log('2. Reset MySQL root password');
      console.log('3. Grant permissions: GRANT ALL PRIVILEGES ON *.* TO \'root\'@\'localhost\';');
    }
    
    return null;
  }
}

testConnection().then(password => {
  if (password !== null) {
    console.log('\n📝 Update your .env file with:');
    console.log(`DB_PASSWORD=${password}`);
  }
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
