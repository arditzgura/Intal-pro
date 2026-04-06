import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('⚠️  VITE_SUPABASE_URL ose VITE_SUPABASE_ANON_KEY mungon në .env.local');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
});

// Konverto username → email fake për Supabase Auth
export const usernameToEmail = (username: string) =>
  `${username.trim().toLowerCase()}@intal.app`;
