import { createClient } from '@supabase/supabase-js'

// Publishable keys are intended for browser clients. The secret key must never be placed here.
// The fallback makes static Neocities deployments work even when no .env file is available.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://zwirsurarahtisrhrfbr.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_SCWvl9tr3aPq1-gh4YSbfw_6Ne2bMKr'

export const supabaseConfigured = Boolean(url && key)
export const supabase = supabaseConfigured ? createClient(url, key) : null
