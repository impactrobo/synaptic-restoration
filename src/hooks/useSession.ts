import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

/**
 * Supabase bounces magic-link and OAuth returns back to the app with either
 * `?code=...` (PKCE) or `#access_token=...` (implicit) attached, and errors in
 * the same places. We surface the error once, then scrub the URL so a refresh
 * doesn't replay a spent credential.
 */
function readAndClearUrlError(): string | null {
  const url = new URL(window.location.href)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const message =
    url.searchParams.get('error_description') ??
    url.searchParams.get('error') ??
    hash.get('error_description') ??
    hash.get('error')

  if (!message) return null

  for (const key of ['error', 'error_code', 'error_description']) {
    url.searchParams.delete(key)
    hash.delete(key)
  }
  url.hash = hash.toString() ? `#${hash}` : ''
  window.history.replaceState({}, '', url.toString())

  return message
}

function clearAuthCredentialsFromUrl() {
  const url = new URL(window.location.href)
  let changed = false

  for (const key of ['code', 'state']) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key)
      changed = true
    }
  }
  if (url.hash.includes('access_token')) {
    url.hash = ''
    changed = true
  }
  if (changed) window.history.replaceState({}, '', url.toString())
}

const initialUrlError = readAndClearUrlError()

export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    // getSession() resolves only after detectSessionInUrl has redeemed any
    // credential in the URL, so it is safe to scrub afterwards.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
      clearAuthCredentialsFromUrl()
    })

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  return { session, loading, urlError: initialUrlError }
}
