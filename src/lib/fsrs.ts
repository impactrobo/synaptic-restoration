import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FsrsCard,
  type Grade,
  type ReviewLog as FsrsReviewLog,
} from 'ts-fsrs'
import type { CardRow, CardState, ReviewRating } from './database.types'

export { Rating, State }
export type { Grade }

/**
 * The subset of a card row FSRS cares about. Taking the narrow shape means the
 * scheduler can be exercised without a full row (previews, tests, new cards).
 */
export type Scheduling = Pick<
  CardRow,
  | 'due'
  | 'stability'
  | 'difficulty'
  | 'elapsed_days'
  | 'scheduled_days'
  | 'learning_steps'
  | 'reps'
  | 'lapses'
  | 'state'
  | 'last_review'
>

/** What `review_logs` needs; the values describe the card *before* the review. */
export type ReviewLogPayload = {
  rating: ReviewRating
  state: CardState
  elapsed_days: number
  scheduled_days: number
  reviewed_at: string
}

export const FSRS_PARAMETERS = generatorParameters({
  // Spreads due dates so a big import doesn't come back as one giant pile on
  // the same day. Anki does this by default; ts-fsrs does not.
  enable_fuzz: true,
})

export const scheduler = fsrs(FSRS_PARAMETERS)

/** The four gradeable ratings, in REJECT / STRAIN / SYNC / ABSORB order. */
export const GRADES = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const

// ---------------------------------------------------------------------------
// Row <-> ts-fsrs mapping
// ---------------------------------------------------------------------------

export function toFsrsCard(row: Scheduling): FsrsCard {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  }
}

export function toScheduling(card: FsrsCard): Scheduling {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as CardState,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  }
}

function toReviewLogPayload(log: FsrsReviewLog): ReviewLogPayload {
  return {
    rating: log.rating as ReviewRating,
    state: log.state as CardState,
    elapsed_days: log.elapsed_days,
    scheduled_days: log.scheduled_days,
    reviewed_at: log.review.toISOString(),
  }
}

/** Scheduling columns for a brand-new card, ready to spread into an insert. */
export function newCardScheduling(now: Date = new Date()): Scheduling {
  return toScheduling(createEmptyCard(now))
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

export type GradeOutcome = {
  scheduling: Scheduling
  log: ReviewLogPayload
}

/**
 * Apply a rating. Returns the card's next scheduling state plus the log row
 * describing the review that produced it — persist both together.
 */
export function gradeCard(
  row: Scheduling,
  grade: Grade,
  now: Date = new Date(),
): GradeOutcome {
  const { card, log } = scheduler.next(toFsrsCard(row), now, grade)
  return { scheduling: toScheduling(card), log: toReviewLogPayload(log) }
}

/**
 * What each button would do, without committing. Drives the interval hints
 * under REJECT / STRAIN / SYNC / ABSORB on the review screen.
 */
export function previewIntervals(
  row: Scheduling,
  now: Date = new Date(),
): Record<Grade, { due: Date; label: string }> {
  const preview = scheduler.repeat(toFsrsCard(row), now)
  const out = {} as Record<Grade, { due: Date; label: string }>

  for (const grade of GRADES) {
    const due = preview[grade].card.due
    out[grade] = { due, label: formatInterval(now, due) }
  }
  return out
}

/** Probability the card is still recalled right now, 0-1. */
export function retrievability(row: Scheduling, now: Date = new Date()): number {
  return scheduler.get_retrievability(toFsrsCard(row), now, false)
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const MONTH = 30 * DAY
const YEAR = 365 * DAY

/**
 * Compact interval text for the rating buttons: `<1m`, `10m`, `2h`, `6d`,
 * `3mo`, `1.4y`. The review screen adds its own `T+` / `RESYNC` framing.
 */
export function formatInterval(from: Date, to: Date): string {
  const ms = to.getTime() - from.getTime()
  if (ms < MINUTE) return '<1m'
  if (ms < HOUR) return `${Math.round(ms / MINUTE)}m`
  if (ms < DAY) return `${Math.round(ms / HOUR)}h`
  if (ms < MONTH) return `${Math.round(ms / DAY)}d`
  if (ms < YEAR) return `${Math.round(ms / MONTH)}mo`

  const years = ms / YEAR
  return `${years < 10 ? years.toFixed(1) : Math.round(years)}y`
}
