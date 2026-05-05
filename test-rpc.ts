import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runTest() {
  const phone = '010-1234-5678';
  const password = '1234';
  
  console.log(`Calling loginCustomer RPC (2 params) for: ${phone}`);
  const { data, error } = await supabase.rpc('login_customer', {
    p_phone: phone,
    p_password: password
  });

  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('RPC Success. Data:', JSON.stringify(data, null, 2));
  }
}

runTest();
