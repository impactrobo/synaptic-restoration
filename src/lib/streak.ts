/**
 * Consecutive-day review streak (title screen's STREAK readout). Not in
 * schema.sql or CLAUDE.md — reasonable default: counts backward from today
 * (or yesterday, if today has no review yet — the streak isn't broken until
 * a full day is skipped) through unbroken calendar days with >=1 review.
 * Days are the viewer's local calendar day, not UTC.
 */

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta)
}

function dayKey(d: Date): string {
  return startOfDay(d).toISOString()
}

export function computeStreak(reviewedAtIso: readonly string[], now: Date = new Date()): number {
  if (reviewedAtIso.length === 0) return 0

  const days = new Set(reviewedAtIso.map((iso) => dayKey(new Date(iso))))
  let cursor = startOfDay(now)

  if (!days.has(dayKey(cursor))) {
    // No review yet today — that's fine, check whether yesterday still
    // carries an active streak forward.
    cursor = addDays(cursor, -1)
    if (!days.has(dayKey(cursor))) return 0
  }

  let streak = 1
  let day = addDays(cursor, -1)
  while (days.has(dayKey(day))) {
    streak += 1
    day = addDays(day, -1)
  }
  return streak
}
