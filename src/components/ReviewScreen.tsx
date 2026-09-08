import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReviewSettings } from '../hooks/useReviewSettings'
import { useSession } from '../hooks/useSession'
import { FSRSVersion, Rating, type Grade } from '../lib/fsrs'
import {
  computeIntegrity,
  integrityFlashing,
  integrityTier,
  pushRating,
  type IntegrityTier,
} from '../lib/integrity'
import { fetchDueCards, fetchRecentRatings, submitReview, type DueCard } from '../lib/reviews'
import { previewIntervals } from '../lib/fsrs'
import type { ReviewRating } from '../lib/database.types'

const GRADES: readonly Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]

/**
 * Rating copy + color per CLAUDE.md. Hard/STRAIN deliberately does NOT use
 * amber — CLAUDE.md reserves amber for warnings only (the hazard bar, the
 * INTEG warn tier), so Hard is violet instead of the prototype's amber.
 */
const RATING_META: Record<
  Grade,
  {
    label: string
    calmLabel?: string
    code: string
    edgeClass: string
    fillClass: string
    textClass: string
    calmEdgeClass: string
    calmFillClass: string
    calmTextClass: string
  }
> = {
  [Rating.Again]: {
    label: 'REJECT',
    calmLabel: 'RETRY',
    code: 'R-01',
    edgeClass: 'border-blood',
    fillClass: 'bg-blood/10',
    textClass: 'text-blood',
    calmEdgeClass: 'border-steel',
    calmFillClass: 'bg-plate',
    calmTextClass: 'text-dim',
  },
  [Rating.Hard]: {
    label: 'STRAIN',
    calmLabel: 'REACH',
    code: 'R-02',
    edgeClass: 'border-violet',
    fillClass: 'bg-violet/10',
    textClass: 'text-violet',
    calmEdgeClass: 'border-steel',
    calmFillClass: 'bg-plate',
    calmTextClass: 'text-dim',
  },
  [Rating.Good]: {
    label: 'SYNC',
    code: 'R-03',
    edgeClass: 'border-acid',
    fillClass: 'bg-acid/10',
    textClass: 'text-acid',
    calmEdgeClass: 'border-acid',
    calmFillClass: 'bg-acid/10',
    calmTextClass: 'text-acid',
  },
  [Rating.Easy]: {
    label: 'ABSORB',
    code: 'R-04',
    edgeClass: 'border-cyan',
    fillClass: 'bg-cyan/10',
    textClass: 'text-cyan',
    calmEdgeClass: 'border-cyan',
    calmFillClass: 'bg-cyan/10',
    calmTextClass: 'text-cyan',
  },
}

const TIER_TEXT_CLASS: Record<IntegrityTier, string> = {
  nominal: 'text-acid',
  warn: 'text-flare',
  critical: 'text-blood',
}

const TIER_BORDER_CLASS: Record<IntegrityTier, string> = {
  nominal: 'border-t-acid',
  warn: 'border-t-flare',
  critical: 'border-t-blood',
}

/** Fires `active` for `durationMs`; bump the returned token to retrigger a CSS animation mid-flight. */
function useTimedEffect(durationMs: number) {
  const [token, setToken] = useState(0)
  const timer = useRef<number | undefined>(undefined)

  const fire = useCallback(() => setToken((t) => t + 1), [])

  useEffect(() => {
    if (token === 0) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToken(0), durationMs)
    return () => window.clearTimeout(timer.current)
  }, [token, durationMs])

  return [token, fire] as const
}

function textField(card: DueCard, key: string): string {
  const value = card.content[key]
  if (typeof value === 'string') return value
  return value == null ? '' : String(value)
}

type Pop = { id: number; text: string; textClass: string }

function Readout({
  label,
  value,
  colorClass,
  borderClass,
  punchActive,
  critical,
}: {
  label: string
  value: string
  colorClass: string
  borderClass: string
  punchActive?: boolean
  critical?: boolean
}) {
  return (
    <div
      className={`flex-1 border border-steel border-t-2 bg-panel px-2.5 py-1.5 transition-transform duration-150 ${borderClass}`}
      style={{ transform: punchActive ? 'scale(1.05)' : 'scale(1)' }}
    >
      <div className="text-[9px] tracking-[0.2em] text-dim">{label}</div>
      <div
        className={`text-[22px] font-bold leading-tight ${colorClass} ${critical ? 'crit-flash' : ''}`}
      >
        {value}
      </div>
    </div>
  )
}

function HazardBar() {
  return (
    <div className="hazard-bar">
      <div className="hazard-stripes" />
      <svg viewBox="0 0 40 36" className="absolute left-1/2 top-0.5 h-7 w-[30px] -translate-x-1/2">
        <polygon
          points="20,3 37,33 3,33"
          fill="var(--color-void)"
          stroke="var(--color-flare)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <polygon
          points="20,11 30,29 10,29"
          fill="none"
          stroke="#ff7a2f"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <rect x="18.6" y="15" width="2.8" height="8" rx="1.4" fill="var(--color-flare)" />
        <circle cx="20" cy="26" r="1.7" fill="var(--color-flare)" />
      </svg>
    </div>
  )
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; queue: DueCard[]; recentRatings: ReviewRating[] }

export default function ReviewScreen({ onExit }: { onExit: () => void }) {
  const { session } = useSession()
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    let active = true
    Promise.all([fetchDueCards(), fetchRecentRatings()])
      .then(([queue, recentRatings]) => {
        if (active) setLoad({ kind: 'ready', queue, recentRatings })
      })
      .catch((error: Error) => {
        if (active) setLoad({ kind: 'error', message: error.message })
      })
    return () => {
      active = false
    }
  }, [])

  if (load.kind === 'loading') return <StatusScreen text="ESTABLISHING QUEUE..." pulse />
  if (load.kind === 'error') {
    return (
      <StatusScreen text={`QUEUE FETCH FAILED — ${load.message.toUpperCase()}`} tone="err" onExit={onExit} />
    )
  }

  return <ActiveSession initialQueue={load.queue} initialRatings={load.recentRatings} onExit={onExit} operatorLabel={session?.user.email ?? 'UNIDENTIFIED'} />
}

function StatusScreen({
  text,
  pulse,
  tone = 'ok',
  onExit,
}: {
  text: string
  pulse?: boolean
  tone?: 'ok' | 'err'
  onExit?: () => void
}) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center gap-4 overflow-hidden bg-void px-4">
      <div className="scanlines" />
      <div
        className={`relative text-center text-[10px] tracking-[0.3em] ${pulse ? 'breathe' : ''} ${tone === 'err' ? 'text-blood' : 'text-violet'}`}
      >
        {text}
      </div>
      {onExit ? (
        <button
          type="button"
          onClick={onExit}
          className="notch relative border-2 border-steel bg-plate px-5 py-2.5 text-[10px] tracking-[0.2em] text-dim hover:text-bone"
        >
          RETURN
        </button>
      ) : null}
    </div>
  )
}

function ActiveSession({
  initialQueue,
  initialRatings,
  onExit,
  operatorLabel,
}: {
  initialQueue: DueCard[]
  initialRatings: ReviewRating[]
  onExit: () => void
  operatorLabel: string
}) {
  const [settings] = useReviewSettings()
  const [queue] = useState(initialQueue)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [recentRatings, setRecentRatings] = useState(initialRatings)
  const [chain, setChain] = useState(0)
  const initialIntegrity = useMemo(() => computeIntegrity(initialRatings), [initialRatings])
  const [lost, setLost] = useState(initialIntegrity === 0)
  const [recovery, setRecovery] = useState(0)
  const [pressedGrade, setPressedGrade] = useState<Grade | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pops, setPops] = useState<Pop[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [cardShownAt, setCardShownAt] = useState(() => new Date())
  const popIdRef = useRef(0)

  const [alarmToken, fireAlarm] = useTimedEffect(520)
  const [glowToken, fireGlow] = useTimedEffect(700)
  const [lostFlashToken, fireLostFlash] = useTimedEffect(1600)
  const [punchToken, firePunch] = useTimedEffect(150)

  const currentCard = queue[index] ?? null
  const sessionDone = index >= queue.length
  const integrity = computeIntegrity(recentRatings)
  const tier = integrityTier(integrity)
  const flashing = integrityFlashing(integrity)
  const queueRemaining = Math.max(queue.length - index, 0)

  const intervals = useMemo(
    () => (currentCard ? previewIntervals(currentCard, cardShownAt) : null),
    [currentCard, cardShownAt],
  )

  // Restarts whenever `resetClock` is called (card advances, or flips —
  // staring too long at either face should trip the hazard warning).
  const resetClock = useCallback(() => {
    setElapsed(0)
    setCardShownAt(new Date())
  }, [])

  useEffect(() => {
    if (sessionDone) return
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => window.clearInterval(t)
  }, [sessionDone])

  const addPop = useCallback((text: string, textClass: string) => {
    const id = popIdRef.current++
    setPops((p) => [...p, { id, text, textClass }])
    window.setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 850)
  }, [])

  const overtime = !settings.calmMode && settings.hazardThreshold > 0 && elapsed >= settings.hazardThreshold
  const visibleGrades: readonly Grade[] = settings.binaryMode ? [Rating.Again, Rating.Good] : GRADES

  async function rate(grade: Grade) {
    if (pending || !currentCard) return

    const snapshot = { chain, recovery, lost, recentRatings }
    setPressedGrade(grade)
    window.setTimeout(() => setPressedGrade(null), 110)

    const nextRatings = pushRating(recentRatings, grade as ReviewRating)
    const nextIntegrity = computeIntegrity(nextRatings)
    const wasLost = lost

    if (grade === Rating.Again) {
      setChain(0)
      setRecovery(0)
      if (!wasLost && nextIntegrity === 0) {
        setLost(true)
        if (!settings.calmMode) fireLostFlash()
      }
      if (!settings.calmMode) {
        fireAlarm()
        addPop(wasLost ? 'NO SIGNAL' : 'SYNC LOST', 'text-blood')
      }
      // Calm mode: no acknowledgment on a miss — see CLAUDE.md open questions.
    } else {
      const nextChain = chain + 1
      setChain(nextChain)
      if (wasLost) {
        const r = recovery + 1
        if (r >= 3) {
          setRecovery(0)
          setLost(false)
          if (settings.calmMode) fireGlow()
          else addPop('LINK RESTORED', 'text-acid')
        } else {
          setRecovery(r)
          if (settings.calmMode) fireGlow()
          else addPop(`RELINK ${r}/3`, 'text-cyan')
        }
      } else if (settings.calmMode) {
        fireGlow()
      } else {
        firePunch()
        addPop(nextChain % 5 === 0 ? `CHAIN ×${nextChain}` : '+1 TRACE', RATING_META[grade].textClass)
      }
    }

    setRecentRatings(nextRatings)
    setPending(true)
    setError(null)

    try {
      await submitReview(currentCard, grade)
      setFlipped(false)
      setIndex((i) => i + 1)
      resetClock()
    } catch (err) {
      // Persistence failed — undo the optimistic session feedback and let them retry.
      setChain(snapshot.chain)
      setRecovery(snapshot.recovery)
      setLost(snapshot.lost)
      setRecentRatings(snapshot.recentRatings)
      setError(err instanceof Error ? err.message.toUpperCase() : 'REVIEW NOT SAVED — RETRY')
    } finally {
      setPending(false)
    }
  }

  if (sessionDone) {
    return (
      <StatusScreen
        text={
          queue.length === 0
            ? 'NO SIGNALS PENDING — QUEUE CLEAR'
            : `QUEUE CLEARED — ${index} NODE${index === 1 ? '' : 'S'} DECRYPTED`
        }
        onExit={onExit}
      />
    )
  }

  const cardTopClass = settings.calmMode
    ? flipped
      ? 'border-t-acid'
      : 'border-t-steel'
    : flipped
      ? 'border-t-acid'
      : 'border-t-violet'

  const statusDotClass = settings.calmMode
    ? 'text-acid'
    : lost
      ? 'text-blood'
      : alarmToken > 0
        ? 'text-blood'
        : 'text-acid'

  const statusText = settings.calmMode ? 'QUIET SESSION' : lost ? 'LINK SEVERED' : 'SESSION ACTIVE'

  return (
    <div className="relative min-h-dvh overflow-hidden bg-void px-3.5 py-3.5">
      <div className="scanlines" />
      {alarmToken > 0 ? <div key={alarmToken} className="alarm-flash" /> : null}
      {glowToken > 0 ? <div key={glowToken} className="edge-glow" /> : null}
      {lostFlashToken > 0 ? (
        <div key={lostFlashToken} className="lost-overlay">
          <div className="lost-bars" />
          <div className="lost-text relative">
            <div className="mb-2 text-[11px] tracking-[0.5em] text-blood">◤ SIGNAL FAILURE ◥</div>
            <div
              className="text-[30px] font-extrabold tracking-wide text-bone"
              style={{ textShadow: '2px 0 var(--color-blood), -2px 0 var(--color-cyan)' }}
            >
              CONNECTION LOST
            </div>
            <div className="mt-3 text-[10px] tracking-[0.25em] text-dim">
              3 CLEAN RECALLS TO RELINK
            </div>
          </div>
        </div>
      ) : null}

      <div className={`relative mx-auto max-w-[420px] ${alarmToken > 0 ? 'jolt' : ''}`}>
        {pops.map((p) => (
          <div
            key={p.id}
            className={`pop-rise pointer-events-none absolute left-1/2 top-0.5 z-10 text-[15px] font-bold tracking-[0.1em] ${p.textClass}`}
          >
            {p.text}
          </div>
        ))}

        <div className="flex items-center justify-between text-[9px] tracking-[0.2em] text-dim">
          <span>
            <span className={`blink ${statusDotClass}`}>■</span> {statusText}
          </span>
          <button
            type="button"
            onClick={onExit}
            className="border border-steel px-2.5 py-1 text-[9px] tracking-[0.2em] text-dim hover:text-cyan"
          >
            DISENGAGE
          </button>
        </div>

        <div className="mt-2.5 flex gap-1.5">
          <Readout label="QUEUE" value={String(queueRemaining)} colorClass="text-cyan" borderClass="border-t-cyan" />
          {settings.calmMode ? (
            <Readout label="DONE" value={String(index)} colorClass="text-acid" borderClass="border-t-acid" />
          ) : (
            <Readout
              label="CHAIN"
              value={String(chain)}
              colorClass="text-violet"
              borderClass="border-t-violet"
              punchActive={punchToken > 0}
            />
          )}
          {!settings.calmMode &&
            (lost ? (
              <Readout
                label="RELINK"
                value={`${recovery}/3`}
                colorClass="text-blood"
                borderClass="border-t-blood"
                critical
              />
            ) : (
              <Readout
                label="INTEG"
                value={`${integrity}%`}
                colorClass={TIER_TEXT_CLASS[tier]}
                borderClass={TIER_BORDER_CLASS[tier]}
                critical={flashing}
              />
            ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setFlipped((f) => !f)
            resetClock()
          }}
          className={`notch relative mt-3 flex min-h-[250px] w-full flex-col items-center justify-center border border-steel bg-panel ${overtime ? 'pt-11' : 'border-t-2 pt-5'} px-5 pb-5 ${cardTopClass}`}
          style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%)' }}
        >
          {overtime ? <HazardBar /> : null}

          <div
            className={`absolute left-2.5 text-[9px] tracking-[0.2em] text-dim ${overtime ? 'top-10' : 'top-2'}`}
          >
            NODE {String(index + 1).padStart(3, '0')}
          </div>
          <div
            className={`absolute right-2.5 text-[9px] tracking-[0.2em] ${
              overtime ? 'text-flare' : settings.calmMode ? 'text-dim' : flipped ? 'text-acid' : 'text-violet'
            } ${overtime ? 'top-10' : 'top-2'}`}
          >
            {overtime ? `LATENCY ${elapsed}s` : flipped ? 'DECRYPTED' : 'ENCRYPTED'}
          </div>

          <CardFace card={currentCard} flipped={flipped} />

          <div
            className={`absolute bottom-2.5 text-[9px] tracking-[0.2em] ${overtime ? 'text-flare' : 'text-dim'}`}
          >
            {overtime ? 'LONG RESPONSE DETECTED' : flipped ? 'LOG RECALL QUALITY' : 'TAP TO DECRYPT'}
          </div>
        </button>

        <div
          className={`relative mt-3 grid grid-cols-2 gap-1.5 transition-opacity duration-150 ${
            flipped ? 'opacity-100' : 'pointer-events-none opacity-30'
          }`}
        >
          {pending ? (
            <span className="pointer-events-none absolute inset-x-0 -top-1 h-0.5 overflow-hidden">
              <span className="sweep block h-full w-1/4 bg-cyan" />
            </span>
          ) : null}
          {visibleGrades.map((grade) => {
            const meta = RATING_META[grade]
            // Only Again/Hard carry a calmLabel — that's the "is this a negative rating" flag.
            const isNegative = Boolean(meta.calmLabel)
            const calm = settings.calmMode && isNegative
            const edgeClass = calm ? meta.calmEdgeClass : meta.edgeClass
            const fillClass = calm ? meta.calmFillClass : meta.fillClass
            const textClass = calm ? meta.calmTextClass : meta.textClass
            const label = settings.calmMode && meta.calmLabel ? meta.calmLabel : meta.label
            const sub = intervals
              ? grade === Rating.Again
                ? `RESYNC ${intervals[grade].label}`
                : `T+${intervals[grade].label}`
              : ''

            return (
              <button
                key={grade}
                type="button"
                disabled={pending}
                onClick={() => rate(grade)}
                className={`border border-steel border-l-[3px] ${edgeClass} ${fillClass} px-2.5 py-3 text-left transition-transform duration-100 disabled:opacity-60 ${
                  pressedGrade === grade ? 'translate-x-1.5' : ''
                }`}
              >
                <div className="text-[8px] tracking-[0.2em] text-dim">{meta.code}</div>
                <div className={`text-[15px] font-bold tracking-[0.15em] ${textClass}`}>{label}</div>
                <div className="mt-0.5 text-[9px] tracking-[0.1em] text-dim">{sub}</div>
              </button>
            )
          })}
        </div>

        {error ? (
          <p className="mt-2.5 border border-l-[3px] border-blood/60 bg-panel px-3 py-2 text-[10px] tracking-[0.1em] text-blood">
            ERR // {error}
          </p>
        ) : null}

        <div className="mt-3 flex justify-between border-t border-steel pt-2 text-[9px] tracking-[0.2em] text-dim">
          <span className="truncate">OPERATOR / {operatorLabel.toUpperCase()}</span>
          <span className="shrink-0">FSRS {FSRSVersion} // ADAPTIVE</span>
        </div>
      </div>
    </div>
  )
}

function CardFace({ card, flipped }: { card: DueCard | null; flipped: boolean }) {
  if (!card) return null

  if (card.templates?.name !== 'basic') {
    return (
      <div className="text-center text-[11px] leading-relaxed tracking-[0.1em] text-dim">
        UNSUPPORTED CARD TYPE
        <div className="mt-1 text-[9px] text-steel">
          {card.templates?.name ?? 'unknown'} — rendering lands with flexible templates
        </div>
      </div>
    )
  }

  if (!flipped) {
    return <div className="text-center text-[64px] font-bold leading-none text-bone">{textField(card, 'front')}</div>
  }

  const hint = textField(card, 'hint')
  return (
    <>
      <div className="text-center text-[26px] font-bold tracking-wide text-bone">{textField(card, 'back')}</div>
      {hint ? <div className="mt-2 text-center text-[13px] tracking-wide text-dim">{hint}</div> : null}
    </>
  )
}
