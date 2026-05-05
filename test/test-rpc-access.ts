import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function runTest() {
  const { data, error } = await supabase.rpc('delete_my_account', {
    p_id: 'f1abae08-342d-4cc1-b13f-e99e0c9b4ff8'
  });
  console.log('Delete account result:', data, error);
}

runTest();
