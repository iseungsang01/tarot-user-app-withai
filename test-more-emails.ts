import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function runTest() {
  const emails = [
    'test@test.com',
    'admin@test.com',
    'test@tarot-app.com',
    'admin@tarot-app.com',
    '010-1234-5678@tarot-app.com',
    '010-1234-5678@test.com'
  ];
  const passwords = ['1234', '123456', 'password'];

  for (const email of emails) {
    for (const pwd of passwords) {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
      console.log(`${email} / ${pwd}: ${error ? error.message : 'SUCCESS'}`);
    }
  }
}
runTest();