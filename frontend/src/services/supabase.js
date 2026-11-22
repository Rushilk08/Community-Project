import { createClient } from '@supabase/supabase-js';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' && process.env ? process.env : {});

const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';
export const API_URL = env.VITE_API_URL || 'http://localhost:5000/api';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project-id') &&
  !supabaseAnonKey.includes('your-anon-key')
);

if (!isSupabaseConfigured) {
  console.warn(
    '[WorkSetu] Supabase environment variables are missing or placeholders. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env. Refer to .env.example.'
  );
}

// Fallback to valid URL structure if not provided to prevent client instantiation crashes
const validUrl = (supabaseUrl && supabaseUrl.startsWith('http')) 
  ? supabaseUrl 
  : 'https://placeholder.supabase.co';
const validKey = supabaseAnonKey || 'placeholder-anon-key';

export const supabase = createClient(validUrl, validKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export default supabase;
