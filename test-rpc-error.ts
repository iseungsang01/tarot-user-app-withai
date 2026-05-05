import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function runTest() {
  const phone = '010-1234-5678';
  const password = '1234'; 
  const paddedPassword = password.length < 6 ? password.padEnd(6, '0') : password;

  console.log(`Simulating login Customer RPC for ${phone}...`);
  const { data: loginData, error: loginError } = await supabase.rpc('login_customer', {
    p_phone: phone,
    p_password: paddedPassword,
  });

  console.log('Login RPC Result:', loginData, loginError);
  
  if (loginError) {
      console.error(loginError)
  }
}

runTest();
