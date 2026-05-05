import { authService } from './src/services/authService.js';

async function testRegistration() {
  const phone = '010-8888-8888';
  const password = '1234'; // 4 chars
  
  console.log(`Registering ${phone} with password ${password}...`);
  const result = await authService.register(phone, password, 'Tester');
  console.log('Result:', JSON.stringify(result, null, 2));
}

testRegistration();
