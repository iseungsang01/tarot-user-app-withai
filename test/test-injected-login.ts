import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function runTest() {
  const phone = '010-1234-5678';
  const email = '01012345678@tarot-app.com';
  const password = '1234'; 
  const paddedPassword = password.length < 6 ? password.padEnd(6, '0') : password;

  console.log(`1. Simulating login Customer RPC...`);
  const { data: loginData, error: loginError } = await supabase.rpc('login_customer', {
    p_phone: phone,
    p_password: paddedPassword,
  });

  console.log('Login RPC Result:', loginData, loginError);

  console.log(`2. Attempting final session login...`);
  const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
    email,
    password: paddedPassword
  });

  if (sessionError) {
    console.error('Final session error:', sessionError.message);
  } else {
    console.log('Final Session Creation Success!');
    console.log('Session Access Token:', sessionData.session ? 'PRESENT' : 'MISSING');
  }
}

runTest();
