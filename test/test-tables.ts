import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function runTest() {
  const { data, error } = await supabase.from('login_attempt_tracker').select('*').limit(1);
  console.log('login_attempt_tracker:', error ? error.message : 'EXISTS');
  
  const { data: d2, error: e2 } = await supabase.from('customer_password_audit_logs').select('*').limit(1);
  console.log('customer_password_audit_logs:', e2 ? e2.message : 'EXISTS');
}

runTest();