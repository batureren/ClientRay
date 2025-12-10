// createAdmin.js - Generate correct hash and create admin user
const bcrypt = require('bcrypt');

async function createAdminUser() {
  const password = 'admin123';
  const saltRounds = 12;
  
  try {
    // Generate the correct hash
    const hash = await bcrypt.hash(password, saltRounds);
    
    console.log('='.repeat(50));
    console.log('🔑 ADMIN USER CREATION');
    console.log('='.repeat(50));
    console.log(`Password: ${password}`);
    console.log(`Generated Hash: ${hash}`);
    console.log('');
    
    // Test the hash immediately
    const testResult = await bcrypt.compare(password, hash);
    console.log(`✅ Hash Test: ${testResult ? 'PASS' : 'FAIL'}`);
    console.log('');
    
    // SQL to insert/update admin user
    console.log('📝 SQL Commands:');
    console.log('');
    console.log('-- Delete existing admin user (if any)');
    console.log(`DELETE FROM users WHERE username = 'admin';`);
    console.log('');
    console.log('-- Insert new admin user');
    console.log(`INSERT INTO users (username, email, password_hash, first_name, last_name, role, is_active) VALUES ('admin', 'admin@example.com', '${hash}', 'Admin', 'User', 'admin', 1);`);
    console.log('');
    console.log('-- OR Update existing admin user');
    console.log(`UPDATE users SET password_hash = '${hash}' WHERE username = 'admin';`);
    console.log('');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createAdminUser();