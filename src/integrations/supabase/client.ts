import { createClient } from '@supabase/supabase-js';

// Vercel üzerindeki değişken isimlerinin tamamını güvenli şekilde yakalıyoruz
const supabaseUrl = 
  import.meta.env.VITE_SUPABASE_URL || 
  import.meta.env.SUPABASE_URL || 
  '';

const supabaseAnonKey = 
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  import.meta.env.SUPABASE_ANON_KEY || 
  '';

// İstemcinin çökmesini önlemek için fallback (varsayılan) kontrolü
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

export default supabase;
