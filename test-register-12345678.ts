import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function runTest() {
  const phone = '010-1234-5678';
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
    p_nickname: '테스트유저'
  });

  console.log('RPC Result:', rpcData, rpcError);
}

runTest();
