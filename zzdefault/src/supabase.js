// supabase.js

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY,
  {
    auth: {
      persistSession: true,      // mantém o login salvo entre visitas
      autoRefreshToken: true,    // renova o token sozinho
      detectSessionInUrl: false, // não usamos links de confirmação por enquanto
    },
  }
)

export default supabase