import { useEffect, useState } from 'react'
import AuthScreen from './components/AuthScreen'
import ReviewScreen from './components/ReviewScreen'
import { useSession } from './hooks/useSession'
import { countDueCards } from './lib/reviews'
import { supabase } from './lib/supabase'

function Booting() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-void">
      <div className="scanlines" />
      <div className="breathe text-[10px] tracking-[0.4em] text-violet">
        RESTORING LINK...
      </div>
    </div>
  )
}

/** QUEUE readout on the home shell — also doubles as a smoke test for the schema. */
function Queue() {
  const [state, setState] = useState<
    { kind: 'loading' } | { kind: 'ok'; due: number } | { kind: 'err'; message: string }
  >({ kind: 'loading' })

  useEffect(() => {
    let active = true
    countDueCards()
      .then((due) => active && setState({ kind: 'ok', due }))
      .catch((error: Error) => active && setState({ kind: 'err', message: error.message }))
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="mt-3 border border-steel border-t-2 border-t-cyan bg-panel px-3 py-2">
      <div className="text-[9px] tracking-[0.2em] text-dim">QUEUE</div>
      {state.kind === 'err' ? (
        <div className="mt-0.5 text-[10px] leading-relaxed tracking-[0.1em] text-blood">
          {state.message}
        </div>
      ) : (
        <div className="text-[23px] font-bold leading-tight text-cyan">
          {state.kind === 'loading' ? '---' : String(state.due).padStart(3, '0')}
        </div>
      )}
    </div>
  )
}

/**
 * Placeholder home shell. The real title screen (build step 5) ports the
 * hex-ring prototype from reference/srs-title-screen.jsx — this is just
 * enough of an entry point for JACK IN to lead somewhere real.
 */
function Home({ onJackIn }: { onJackIn: () => void }) {
  const { session } = useSession()

  return (
    <div className="relative min-h-dvh overflow-hidden bg-void px-4 py-5">
      <div className="gridfield" />
      <div className="scanlines" />

      <div className="relative mx-auto max-w-[420px]">
        <header className="flex justify-between text-[9px] tracking-[0.18em] text-dim">
          <span>
            <span className="blink text-acid">●</span> LINK STABLE
          </span>
          <span>SRS v0.1.0 // NODE-01</span>
        </header>

        <div className="mt-8 border border-steel border-l-[3px] border-l-acid bg-panel p-4">
          <div className="text-[9px] tracking-[0.3em] text-acid">OPERATOR ONLINE</div>
          <div className="mt-2 break-all text-sm tracking-[0.08em] text-bone">
            {session?.user.email ?? session?.user.id}
          </div>
          <div className="mt-3 text-[10px] leading-relaxed tracking-[0.12em] text-dim">
            AUTH LAYER ACTIVE. SCHEDULER ONLINE.
          </div>
        </div>

        <Queue />

        <button
          type="button"
          onClick={onJackIn}
          className="notch mt-4 flex w-full items-center justify-between border-2 border-cyan bg-cyan/10 px-4 py-3 transition-transform duration-100 active:translate-x-1"
        >
          <span className="text-sm font-bold tracking-[0.22em] text-bone">JACK IN</span>
          <span className="text-[9px] tracking-[0.15em] text-cyan">START SESSION</span>
        </button>

        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="notch mt-2.5 flex w-full items-center justify-between border-2 border-steel bg-plate px-4 py-3 transition-transform duration-100 active:translate-x-1"
        >
          <span className="text-sm font-bold tracking-[0.22em] text-dim">DISCONNECT</span>
          <span className="text-[9px] tracking-[0.15em] text-steel">SIGN OUT</span>
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const { session, loading, urlError } = useSession()
  const [reviewing, setReviewing] = useState(false)

  if (loading) return <Booting />
  if (!session) return <AuthScreen urlError={urlError} />
  if (reviewing) return <ReviewScreen onExit={() => setReviewing(false)} />

  return <Home onJackIn={() => setReviewing(true)} />
}
