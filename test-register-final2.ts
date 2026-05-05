import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function runTest() {
  const phone = '010-8888-9999'; // A fresh number to avoid rate limits on 9999
  const password = '1234'; 
  const paddedPassword = password.length < 6 ? password.padEnd(6, '0') : password;
  const email = `${phone.replace(/\D/g, '')}@tarot-app.com`;

  console.log(`1. Registering ${phone} with auth.users...`);
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password: paddedPassword
  });

  if (authError) {
    console.log('Auth Error:', authError.message);
    return;
  }

  const newUserId = authData.user.id;
  console.log(`Auth success. UUID: ${newUserId}`);

  console.log(`2. Registering ${phone} with customers RPC...`);
  const { data: rpcData, error: rpcError } = await supabase.rpc('register_customer', {
    p_id: newUserId,
    p_phone: phone,
    p_password: paddedPassword,
    p_nickname: 'NewTestUser2'
  });

  console.log('RPC Result:', rpcData, rpcError);

  console.log(`3. Simulating login Customer RPC...`);
  const { data: loginData, error: loginError } = await supabase.rpc('login_customer', {
    p_phone: phone,
    p_password: paddedPassword,
  });

  console.log('Login RPC Result:', loginData, loginError);

  console.log(`4. Attempting final session login...`);
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
