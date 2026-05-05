import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runTest() {
  const phone = '010-1234-5678';
  const email = `${phone.replace(/\D/g, '')}@tarot-app.com`;
  
  const passwordsToTry = ['123456', '000000', '12341234', 'password', '12345678', 'admin123'];

  for (const pwd of passwordsToTry) {
    console.log(`Attempting login with password: ${pwd}`);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pwd,
    });

    if (error) {
      console.log(`Failed: ${error.message}`);
    } else {
      console.log(`Success with password: ${pwd}`);
      return;
    }
  }
}

runTest();
