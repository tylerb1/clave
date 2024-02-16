import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPA_URL
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPA_KEY
export const sb = createClient(supabaseUrl, supabaseAnonKey)