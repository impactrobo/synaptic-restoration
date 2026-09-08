import type { ReviewRating } from './database.types'

/** How many recent ratings the rolling INTEG readout looks back over. */
export const INTEGRITY_WINDOW = 20

/**
 * INTEG — % of the last `INTEGRITY_WINDOW` graded reviews that weren't
 * Again. Real, computed from history, not decorative (see CLAUDE.md).
 * A fresh operator with no history starts at full integrity.
 */
export function computeIntegrity(recentRatings: ReviewRating[]): number {
  if (recentRatings.length === 0) return 100
  const hits = recentRatings.filter((rating) => rating > 1).length
  return Math.round((hits / recentRatings.length) * 100)
}

export type IntegrityTier = 'nominal' | 'warn' | 'critical'

/** green >60%, orange <=60%, red <=30% — per CLAUDE.md's aesthetic spec. */
export function integrityTier(pct: number): IntegrityTier {
  if (pct <= 30) return 'critical'
  if (pct <= 60) return 'warn'
  return 'nominal'
}

/** <=15% additionally flashes. */
export function integrityFlashing(pct: number): boolean {
  return pct <= 15
}

/**
 * Push a new rating into the rolling window, oldest-drops-off. Ratings
 * arrive newest-first (matching `fetchRecentRatings`'s query order).
 */
export function pushRating(
  recentRatings: ReviewRating[],
  rating: ReviewRating,
): ReviewRating[] {
  return [rating, ...recentRatings].slice(0, INTEGRITY_WINDOW)
}
