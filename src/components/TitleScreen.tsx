import { useEffect, useRef, useState } from 'react'
import { useSession } from '../hooks/useSession'
import { computeIntegrity, integrityTier } from '../lib/integrity'
import { countDueCards, countTotalReviews, fetchRecentRatings, fetchReviewDays } from '../lib/reviews'
import { computeStreak } from '../lib/streak'
import { supabase } from '../lib/supabase'

type Stats = {
  due: number
  totalEvents: number
  integrity: number
  streak: number
}

const TIER_TEXT_CLASS = {
  nominal: 'text-cyan',
  warn: 'text-flare',
  critical: 'text-blood',
} as const

/** Eases a counter from 0 to `target` over ~1.1s — ported from the prototype's count-up. */
function useCountUp(target: number) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    let raf: number
    const start = performance.now()
    const duration = 1100

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])

  return value
}

function MenuButton({
  label,
  hint,
  edgeClass,
  fillClass,
  onClick,
}: {
  label: string
  hint: string
  edgeClass: string
  fillClass: string
  onClick: () => void
}) {
  const [down, setDown] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      className={`notch flex w-full items-center justify-between border-2 px-4 py-3.5 transition-transform duration-100 ${edgeClass} ${fillClass}`}
      style={{ transform: down ? 'translateX(4px)' : 'translateX(0)' }}
    >
      <span className="text-[19px] font-bold tracking-[0.15em] text-bone">{label}</span>
      <span className={`text-[10px] tracking-[0.1em] ${edgeClass.replace('border-', 'text-')}`}>{hint}</span>
    </button>
  )
}

/**
 * Title/home screen — ports reference/srs-title-screen.jsx onto real data.
 * Two prototype colors don't survive the port: magenta isn't in CLAUDE.md's
 * palette (acid/violet/cyan/void, amber warnings-only) so the second ring
 * and the hex frame become violet; the hex frame itself was amber
 * (decorative, not a warning), which the same rule rules out too.
 */
export default function TitleScreen({ onJackIn }: { onJackIn: () => void }) {
  const { session } = useSession()
  const [stats, setStats] = useState<Stats | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const noteTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    let active = true
    Promise.all([countDueCards(), countTotalReviews(), fetchRecentRatings(), fetchReviewDays()])
      .then(([due, totalEvents, recentRatings, reviewDays]) => {
        if (!active) return
        setStats({
          due,
          totalEvents,
          integrity: computeIntegrity(recentRatings),
          streak: computeStreak(reviewDays),
        })
      })
      .catch(() => {
        if (active) setStats({ due: 0, totalEvents: 0, integrity: 100, streak: 0 })
      })
    return () => {
      active = false
    }
  }, [])

  const recallEvents = useCountUp(stats?.totalEvents ?? 0)
  const integrity = stats?.integrity ?? 100
  const tier = integrityTier(integrity)

  const ping = (message: string) => {
    setNote(message)
    window.clearTimeout(noteTimer.current)
    noteTimer.current = window.setTimeout(() => setNote(null), 1300)
  }

  const jackInHint = stats === null ? '···' : stats.due > 0 ? `${stats.due} DUE` : 'QUEUE CLEAR'

  return (
    <div className="relative min-h-dvh overflow-hidden bg-void px-4 py-5">
      <div className="gridfield" />
      <div className="scanlines" />

      <div className="relative mx-auto max-w-[420px]">
        <header className="flex justify-between text-[10px] tracking-[0.15em] text-dim">
          <span>
            <span className="blink text-cyan">●</span> LINK STABLE
          </span>
          <span>SRS v0.1.0 // NODE-01</span>
        </header>

        <div className="mt-7 text-center">
          <div className="text-[10px] tracking-[0.6em] text-violet">SYNAPTIC</div>
          <div
            className="mt-0.5 text-[46px] font-extrabold leading-[0.92] tracking-tight text-bone"
            style={{ textShadow: '2px 0 var(--color-violet), -2px 0 var(--color-cyan)' }}
          >
            RESTORATION
          </div>
          <div className="mt-1 text-[22px] font-bold tracking-[0.6em] text-bone">SYSTEM</div>
        </div>

        <div className="relative my-4 h-[220px]">
          <svg viewBox="0 0 220 220" className="absolute inset-0 h-full w-full">
            <g className="ring-spin" style={{ transformOrigin: '110px 110px' }}>
              <circle cx="110" cy="110" r="96" fill="none" stroke="var(--color-steel)" strokeWidth="1" />
              <circle
                cx="110"
                cy="110"
                r="96"
                fill="none"
                stroke="var(--color-cyan)"
                strokeWidth="2"
                strokeDasharray="34 26 8 40"
                opacity="0.85"
              />
            </g>
            <g className="ring-spin-reverse" style={{ transformOrigin: '110px 110px' }}>
              <circle
                cx="110"
                cy="110"
                r="78"
                fill="none"
                stroke="var(--color-violet)"
                strokeWidth="1.5"
                strokeDasharray="4 14"
                opacity="0.7"
              />
            </g>
            <polygon
              points="110,32 178,71 178,149 110,188 42,149 42,71"
              fill="var(--color-void)"
              stroke="var(--color-violet)"
              strokeWidth="2"
            />
            <polygon
              points="110,44 168,77 168,143 110,176 52,143 52,77"
              fill="none"
              stroke="var(--color-steel)"
              strokeWidth="1"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[9px] tracking-[0.3em] text-violet">TOTAL RECALL EVENTS</div>
            <div className="text-[44px] font-extrabold leading-tight tracking-tight text-bone">
              {recallEvents.toLocaleString()}
            </div>
            <div className={`breathe mt-1 text-[10px] tracking-[0.2em] ${TIER_TEXT_CLASS[tier]}`}>
              NEURAL INTEGRITY {integrity}%
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <MenuButton
            label="JACK IN"
            hint={jackInHint}
            edgeClass="border-cyan"
            fillClass="bg-cyan/10"
            onClick={onJackIn}
          />
          <MenuButton
            label="DECK BUILDER"
            hint="FORGE"
            edgeClass="border-violet"
            fillClass="bg-violet/10"
            onClick={() => ping('DECK BUILDER — MODULE OFFLINE')}
          />
          <MenuButton
            label="OPTIONS"
            hint="CONFIG"
            edgeClass="border-steel"
            fillClass="bg-plate"
            onClick={() => ping('OPTIONS — MODULE OFFLINE')}
          />
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-steel pt-2.5 text-[10px] tracking-[0.15em] text-dim">
          <span className="truncate">
            OPERATOR / {(session?.user.email ?? 'UNIDENTIFIED').toUpperCase()}
          </span>
          <span className="shrink-0 text-acid">STREAK {String(stats?.streak ?? 0).padStart(2, '0')}</span>
        </div>

        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="mt-2 w-full border border-steel px-3 py-2 text-[9px] tracking-[0.2em] text-dim hover:text-bone"
        >
          DISCONNECT
        </button>
      </div>

      {note ? (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 border-2 border-cyan bg-panel px-5 py-2.5 text-[12px] tracking-[0.15em] text-bone">
          {note}
        </div>
      ) : null}
    </div>
  )
}
