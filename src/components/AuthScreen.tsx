import { useState } from 'react'
import type { ButtonHTMLAttributes, FormEvent, InputHTMLAttributes, ReactNode } from 'react'
import { authRedirectTo, supabase } from '../lib/supabase'

type Mode = 'signin' | 'signup'
type Channel = 'passphrase' | 'token' | 'google'
type Tone = 'ok' | 'warn' | 'err'
type Status = { tone: Tone; text: string }

const TONE_CLASS: Record<Tone, string> = {
  ok: 'border-acid/60 text-acid',
  warn: 'border-flare/60 text-flare',
  err: 'border-blood/60 text-blood',
}

const TONE_PREFIX: Record<Tone, string> = {
  ok: 'OK // ',
  warn: 'HOLD // ',
  err: 'ERR // ',
}

function Field({
  id,
  label,
  hint,
  children,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  hint?: string
  children?: ReactNode
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="flex items-baseline justify-between text-[9px] tracking-[0.2em] text-dim">
        {label}
        {hint ? <span className="text-steel">{hint}</span> : null}
      </span>
      <span className="mt-1.5 flex items-stretch border border-steel bg-plate focus-within:border-violet">
        <input
          id={id}
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm tracking-[0.08em] text-bone placeholder:text-steel focus:outline-none"
          {...props}
        />
        {children}
      </span>
    </label>
  )
}

function ActionButton({
  label,
  hint,
  edge,
  fill,
  pending,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  hint: string
  edge: string
  fill: string
  pending?: boolean
}) {
  return (
    <button
      className={`notch relative flex w-full items-center justify-between overflow-hidden border-2 px-4 py-3 transition-transform duration-100 active:translate-x-1 disabled:opacity-40 ${edge} ${fill}`}
      disabled={disabled || pending}
      {...props}
    >
      <span className="text-sm font-bold tracking-[0.22em] text-bone">
        {pending ? 'WORKING' : label}
      </span>
      <span className="text-[9px] tracking-[0.15em] opacity-70">{hint}</span>
      {pending ? (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden">
          <span className="sweep block h-full w-1/4 bg-cyan" />
        </span>
      ) : null}
    </button>
  )
}

export default function AuthScreen({ urlError }: { urlError?: string | null }) {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [reveal, setReveal] = useState(false)
  const [pending, setPending] = useState<Channel | null>(null)
  const [status, setStatus] = useState<Status | null>(
    urlError ? { tone: 'err', text: urlError } : null,
  )

  const busy = pending !== null

  const fail = (text: string) => setStatus({ tone: 'err', text })

  /** Every channel needs an address; the magic link reuses the field above. */
  const requireEmail = () => {
    const trimmed = email.trim()
    if (!trimmed) {
      fail('OPERATOR ID REQUIRED')
      return null
    }
    return trimmed
  }

  const handlePassphrase = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return

    const address = requireEmail()
    if (!address) return
    if (!password) return fail('PASSPHRASE REQUIRED')
    if (mode === 'signup' && password.length < 6) {
      return fail('PASSPHRASE TOO SHORT — 6 CHARACTERS MINIMUM')
    }

    setStatus(null)
    setPending('passphrase')

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({
        email: address,
        password,
      })
      setPending(null)
      // On success the session listener swaps this screen out; nothing to do here.
      if (error) fail(error.message)
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email: address,
      password,
      options: { emailRedirectTo: authRedirectTo },
    })
    setPending(null)

    if (error) return fail(error.message)
    if (data.session) return

    // No session means Supabase is holding the account until the address is
    // confirmed. It reports an already-registered address in this same shape
    // rather than erroring, so as not to leak which addresses exist.
    setPassword('')
    setStatus({
      tone: 'warn',
      text: `CONFIRMATION DISPATCHED TO ${address.toUpperCase()} — VERIFY TO ACTIVATE NODE`,
    })
  }

  const handleMagicLink = async () => {
    if (busy) return
    const address = requireEmail()
    if (!address) return

    setStatus(null)
    setPending('token')
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: authRedirectTo },
    })
    setPending(null)

    if (error) return fail(error.message)
    setStatus({
      tone: 'ok',
      text: `ACCESS TOKEN TRANSMITTED TO ${address.toUpperCase()} — CHECK MAIL RELAY`,
    })
  }

  const handleGoogle = async () => {
    if (busy) return
    setStatus(null)
    setPending('google')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: authRedirectTo },
    })
    // Success navigates the browser away, so only a failure lands here.
    if (error) {
      setPending(null)
      fail(error.message)
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-void px-4 py-5">
      <div className="gridfield" />
      <div className="scanlines" />

      <div className="relative mx-auto flex min-h-[calc(100dvh-40px)] max-w-[420px] flex-col">
        <header className="flex justify-between text-[9px] tracking-[0.18em] text-dim">
          <span>
            <span className="blink text-violet">●</span> AWAITING CREDENTIALS
          </span>
          <span>SRS v0.1.0 // NODE-01</span>
        </header>

        <div className="mt-7 text-center">
          <div className="text-[10px] tracking-[0.55em] text-violet">SYNAPTIC</div>
          <div
            className="mt-0.5 text-[42px] font-extrabold leading-[0.92] tracking-tight text-bone"
            style={{ textShadow: '2px 0 #a46bff, -2px 0 #5ee9ff' }}
          >
            RESTORATION
          </div>
          <div className="mt-1 text-[20px] font-bold tracking-[0.5em] text-bone">SYSTEM</div>
          <div className="breathe mt-3 text-[9px] tracking-[0.25em] text-cyan">
            IDENTIFY TO ACCESS YOUR LATTICE
          </div>
        </div>

        <div className="mt-7 border border-steel border-l-[3px] border-l-violet bg-panel">
          <div className="flex items-center justify-between border-b border-steel px-3.5 py-2.5">
            <span className="text-[9px] tracking-[0.3em] text-violet">
              OPERATOR AUTHENTICATION
            </span>
            <span className="text-[9px] tracking-[0.15em] text-steel">SEC//0x1</span>
          </div>

          <div className="grid grid-cols-2 border-b border-steel">
            {(
              [
                ['signin', 'AUTHENTICATE'],
                ['signup', 'ENROLL'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => {
                  setMode(value)
                  setStatus(null)
                }}
                className={`border-b-2 py-2.5 text-[10px] tracking-[0.25em] transition-colors ${
                  mode === value
                    ? 'border-b-cyan bg-cyan/5 text-cyan'
                    : 'border-b-transparent text-dim hover:text-bone'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handlePassphrase} className="space-y-3.5 p-3.5">
            <Field
              id="operator-id"
              label="OPERATOR ID"
              hint="EMAIL"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="operator@node"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Field
              id="passphrase"
              label="PASSPHRASE"
              hint={mode === 'signup' ? 'MIN 6 CHARS' : undefined}
              type={reveal ? 'text' : 'password'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            >
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                aria-label={reveal ? 'Hide passphrase' : 'Show passphrase'}
                className="shrink-0 border-l border-steel px-2.5 text-[9px] tracking-[0.15em] text-dim hover:text-cyan"
              >
                {reveal ? 'MASK' : 'REVEAL'}
              </button>
            </Field>

            <ActionButton
              type="submit"
              label={mode === 'signin' ? 'ESTABLISH LINK' : 'INITIALIZE OPERATOR'}
              hint={mode === 'signin' ? 'ENTER' : 'NEW NODE'}
              edge="border-acid"
              fill="bg-acid/10"
              pending={pending === 'passphrase'}
              disabled={busy}
            />
          </form>

          <div className="flex items-center gap-2.5 px-3.5">
            <span className="h-px flex-1 bg-steel" />
            <span className="text-[9px] tracking-[0.25em] text-dim">ALT CHANNELS</span>
            <span className="h-px flex-1 bg-steel" />
          </div>

          <div className="space-y-2.5 p-3.5">
            <ActionButton
              type="button"
              onClick={handleMagicLink}
              label="TRANSMIT ACCESS TOKEN"
              hint="NO PASSPHRASE"
              edge="border-cyan"
              fill="bg-cyan/10"
              pending={pending === 'token'}
              disabled={busy}
            />
            <ActionButton
              type="button"
              onClick={handleGoogle}
              label="LINK VIA GOOGLE"
              hint="OAUTH"
              edge="border-violet"
              fill="bg-violet/10"
              pending={pending === 'google'}
              disabled={busy}
            />
          </div>
        </div>

        <div aria-live="polite" className="mt-3.5">
          {status ? (
            <p
              className={`border border-l-[3px] bg-panel px-3 py-2.5 text-[10px] leading-relaxed tracking-[0.12em] ${TONE_CLASS[status.tone]}`}
            >
              <span className="opacity-60">{TONE_PREFIX[status.tone]}</span>
              {status.text}
            </p>
          ) : null}
        </div>

        <footer className="mt-auto flex justify-between border-t border-steel pt-2.5 text-[9px] tracking-[0.18em] text-dim">
          <span>OPERATOR / UNIDENTIFIED</span>
          <span className="text-steel">ROW-LEVEL SECURITY ACTIVE</span>
        </footer>
      </div>
    </div>
  )
}
