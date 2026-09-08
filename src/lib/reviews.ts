import { supabase } from './supabase'
import type { CardInsert, CardRow, ReviewRating, TemplateRow } from './database.types'
import { gradeCard, newCardScheduling, type Grade, type Scheduling } from './fsrs'
import { INTEGRITY_WINDOW } from './integrity'

export type DueQuery = {
  /**
   * Restrict to one deck. Left undefined, the queue spans every deck — per
   * CLAUDE.md, JACK IN starts a session across every due card, not one deck
   * at a time. Kept optional so per-deck study can be added later without
   * changing this query's shape.
   */
  deckId?: string
  limit?: number
  now?: Date
}

/** A due card plus enough of its template to know how to render it. */
export type DueCard = CardRow & { templates: Pick<TemplateRow, 'name'> | null }

/** Cards whose `due` has passed, soonest first. New cards default to due now. */
export async function fetchDueCards({
  deckId,
  limit = 100,
  now = new Date(),
}: DueQuery = {}): Promise<DueCard[]> {
  let query = supabase
    .from('cards')
    .select('*, templates(name)')
    .lte('due', now.toISOString())
    .order('due', { ascending: true })
    .limit(limit)

  if (deckId) query = query.eq('deck_id', deckId)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/**
 * The most recent ratings, newest first — the window the INTEG readout is
 * computed from (see `src/lib/integrity.ts`).
 */
export async function fetchRecentRatings(
  limit: number = INTEGRITY_WINDOW,
): Promise<ReviewRating[]> {
  const { data, error } = await supabase
    .from('review_logs')
    .select('rating')
    .order('reviewed_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map((row) => row.rating)
}

/** The QUEUE readout — how many cards are due, without fetching them. */
export async function countDueCards({
  deckId,
  now = new Date(),
}: Omit<DueQuery, 'limit'> = {}): Promise<number> {
  let query = supabase
    .from('cards')
    .select('id', { count: 'exact', head: true })
    .lte('due', now.toISOString())

  if (deckId) query = query.eq('deck_id', deckId)

  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

/**
 * Grade a card and persist the result.
 *
 * The scheduling maths runs here in the client, but the two writes it produces
 * — the card's new state and its review log — go through the `record_review`
 * function so they land in one transaction. A graded card is never left
 * without its log.
 */
export async function submitReview(
  card: Scheduling & { id: string },
  grade: Grade,
  now: Date = new Date(),
): Promise<CardRow> {
  const { scheduling, log } = gradeCard(card, grade, now)

  const { data, error } = await supabase.rpc('record_review', {
    p_card_id: card.id,
    p_scheduling: scheduling,
    p_log: log,
  })

  if (error) throw error
  return data
}

/** Build a card insert with fresh FSRS state. Used by manual and AI creation. */
export function buildNewCard(
  fields: Omit<CardInsert, keyof Scheduling>,
  now: Date = new Date(),
): CardInsert {
  return { ...fields, ...newCardScheduling(now) }
}
