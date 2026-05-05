import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function runTest() {
  const phone = '010-8888-8888';
  const password = '1234'; 
  const paddedPassword = password.length < 6 ? password.padEnd(6, '0') : password;
  const email = `${phone.replace(/\D/g, '')}@tarot-app.com`;

  console.log(`Simulating login Customer RPC...`);
  const { data: loginData, error: loginError } = await supabase.rpc('login_customer', {
    p_phone: phone,
    p_password: paddedPassword,
  });

  console.log('Login RPC Result:', loginData, loginError);

  console.log(`Attempting final session login...`);
  const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
    email,
    password: paddedPassword
  });

  if (sessionError) {
    console.error('Final session error:', sessionError.message);
  } else {
    console.log('Final Session Creation Success!');
  }
}

runTest();
