import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error(
    'Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local (see .env.example).',
  )
}

export const supabase = createClient<Database>(url, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Magic-link and OAuth both land back here with credentials in the URL;
    // let the client consume them before the app reads the session.
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})

/** Where Supabase sends the browser back after magic link / OAuth. */
export const authRedirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`
