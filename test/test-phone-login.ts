import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function runTest() {
  const phone = '010-1234-5678';
  
  const passwords = ['1234', '123456'];

  for (const pwd of passwords) {
    const { error } = await supabase.auth.signInWithPassword({ phone, password: pwd });
    console.log(`Phone login with ${pwd}: ${error ? error.message : 'SUCCESS'}`);
  }
}
runTest();