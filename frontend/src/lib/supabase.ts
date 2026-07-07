// import { createClient } from '@supabase/supabase-js';

// const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
// const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

// export const supabase = createClient(
//   SUPABASE_URL,
//   SUPABASE_ANON_KEY
// );

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

