
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xihjcudjazmpazcbghfn.supabase.co';
const supabaseAnonKey = 'sb_publishable_l5LoS2fxzLBtdKCC1XMP1Q_svEYubj6';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
