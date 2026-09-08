import { supabase } from './supabase'
import type { CardInsert, CardRow } from './database.types'
import { gradeCard, newCardScheduling, type Grade, type Scheduling } from './fsrs'

export type DueQuery = {
  /**
   * Restrict to one deck. Left undefined, the queue spans every deck — the
   * "one deck at a time vs. everything due" question is still open, so both
   * shapes stay available to the caller.
   */
  deckId?: string
  limit?: number
  now?: Date
}

/** Cards whose `due` has passed, soonest first. New cards default to due now. */
export async function fetchDueCards({
  deckId,
  limit = 100,
  now = new Date(),
}: DueQuery = {}): Promise<CardRow[]> {
  let query = supabase
    .from('cards')
    .select('*')
    .lte('due', now.toISOString())
    .order('due', { ascending: true })
    .limit(limit)

  if (deckId) query = query.eq('deck_id', deckId)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
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
