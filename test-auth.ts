import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runTest() {
  const phone = '010-1234-5678';
  const password = '1234';
  const email = `${phone.replace(/\D/g, '')}@tarot-app.com`;
  
  console.log(`Attempting login for: ${email}`);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('Supabase Auth Error:', error.message, error.code, error.status);
  } else {
    console.log('Success! Session:', !!data.session);
  }
}

runTest();
