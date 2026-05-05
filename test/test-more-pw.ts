import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function runTest() {
  const email = '01012345678@tarot-app.com';
  const passwords = ['123412', '12341234', '123456', '01012345678', '010-1234-5678', '01012345678@tarot-app.com'];

  for (const pwd of passwords) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    console.log(`Password ${pwd}: ${error ? error.message : 'SUCCESS'}`);
  }
}
runTest();