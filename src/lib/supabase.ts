import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uuxmhrkxyidftcjsywvn.supabase.co';
const supabaseAnonKey = 'sb_publishable_8CmyrG9sxvvXZ3ggZmdWtg_Wf7xLQUf';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
