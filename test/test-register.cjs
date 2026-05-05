require('dotenv').config();
const { authService } = require('../src/services/authService.js');

async function testRegistration() {
  const phone = '010-0000-0000';
  const password = '1234'; 
  
  console.log(`Registering ${phone} with password ${password}...`);
  const result = await authService.register(phone, password, 'TestUser');
  console.log('Result:', JSON.stringify(result, null, 2));
}

testRegistration();
