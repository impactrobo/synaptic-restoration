/**
 * Hand-maintained mirror of `schema.sql`. Keep the two in step — if you add a
 * column there, add it here.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

/** 0=New 1=Learning 2=Review 3=Relearning — matches ts-fsrs `State`. */
export type CardState = 0 | 1 | 2 | 3

/** 1=Again 2=Hard 3=Good 4=Easy — matches ts-fsrs `Rating` minus Manual. */
export type ReviewRating = 1 | 2 | 3 | 4

export type CardSource = 'manual' | 'ai' | 'import'

/** A field descriptor from `templates.fields`. */
export type TemplateField = {
  key: string
  type: 'text' | 'cloze' | 'audio'
  optional?: boolean
}

export type DeckRow = {
  id: string
  user_id: string
  name: string
  color: string | null
  created_at: string
}

export type TemplateRow = {
  id: string
  user_id: string | null
  name: string
  fields: TemplateField[]
  is_builtin: boolean
  created_at: string
}

export type CardRow = {
  id: string
  user_id: string
  deck_id: string
  template_id: string
  content: Record<string, Json>
  tags: string[]
  source: CardSource
  sibling_group_id: string | null

  // FSRS scheduling state — names match ts-fsrs `Card` exactly.
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: CardState
  last_review: string | null

  created_at: string
}

export type ReviewLogRow = {
  id: string
  user_id: string
  card_id: string
  rating: ReviewRating
  state: CardState
  elapsed_days: number
  scheduled_days: number
  reviewed_at: string
}

/** Columns with a database default are optional on insert. */
type Insert<Row, Required extends keyof Row> = Pick<Row, Required> &
  Partial<Omit<Row, Required>>

export type DeckInsert = Insert<DeckRow, 'user_id' | 'name'>
export type TemplateInsert = Insert<TemplateRow, 'name' | 'fields'>
export type CardInsert = Insert<CardRow, 'user_id' | 'deck_id' | 'template_id' | 'content'>
export type ReviewLogInsert = Insert<
  ReviewLogRow,
  'user_id' | 'card_id' | 'rating' | 'state' | 'elapsed_days' | 'scheduled_days'
>

type Relationship = {
  foreignKeyName: string
  columns: string[]
  isOneToOne?: boolean
  referencedRelation: string
  referencedColumns: string[]
}

/**
 * `Relationships` is what lets PostgREST embeds (`select('*, decks(*)')`)
 * typecheck. Foreign keys into `auth.users` are left out — they aren't
 * embeddable from the public schema.
 */
type Table<Row, Ins, Rel extends Relationship[] = []> = {
  Row: Row
  Insert: Ins
  Update: Partial<Ins>
  Relationships: Rel
}

type CardRelationships = [
  {
    foreignKeyName: 'cards_deck_id_fkey'
    columns: ['deck_id']
    isOneToOne: false
    referencedRelation: 'decks'
    referencedColumns: ['id']
  },
  {
    foreignKeyName: 'cards_template_id_fkey'
    columns: ['template_id']
    isOneToOne: false
    referencedRelation: 'templates'
    referencedColumns: ['id']
  },
]

type ReviewLogRelationships = [
  {
    foreignKeyName: 'review_logs_card_id_fkey'
    columns: ['card_id']
    isOneToOne: false
    referencedRelation: 'cards'
    referencedColumns: ['id']
  },
]

export type Database = {
  public: {
    Tables: {
      decks: Table<DeckRow, DeckInsert>
      templates: Table<TemplateRow, TemplateInsert>
      cards: Table<CardRow, CardInsert, CardRelationships>
      review_logs: Table<ReviewLogRow, ReviewLogInsert, ReviewLogRelationships>
    }
    Views: Record<never, never>
    Functions: {
      record_review: {
        Args: {
          p_card_id: string
          p_scheduling: Json
          p_log: Json
        }
        Returns: CardRow
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}
