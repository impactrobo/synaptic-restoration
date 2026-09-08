-- ============================================================
-- 0001 — FSRS scheduling corrections
-- Run this in Supabase: Dashboard → SQL Editor → New query.
-- Only needed if you already ran the original schema.sql; a fresh
-- schema.sql run now includes everything below.
-- ============================================================

-- ------------------------------------------------------------
-- 1. learning_steps
-- ts-fsrs v5's Card carries a learning_steps counter — the index of the
-- (re)learning step the card currently sits on. It is round-tripped through
-- every next() call, so if it is not persisted, a card in Learning or
-- Relearning restarts at step 0 on every page load and the short-term
-- steps never advance.
-- ------------------------------------------------------------
alter table cards
  add column if not exists learning_steps integer not null default 0;

-- ------------------------------------------------------------
-- 2. stability / difficulty precision
-- FSRS feeds these back into itself on every review, so rounding them to
-- real's ~7 significant digits compounds. double precision matches what
-- the library actually computes.
-- ------------------------------------------------------------
alter table cards
  alter column stability type double precision,
  alter column difficulty type double precision;

-- ------------------------------------------------------------
-- 3. record_review()
-- A review is two writes: the card's new scheduling state, and the log row
-- that the heatmap and future FSRS parameter optimization read from. Doing
-- them as separate client calls can leave a graded card with no log (or a
-- log for a card that never moved). This wraps both in one transaction.
--
-- SECURITY INVOKER (the default) so RLS still applies: the update is scoped
-- to auth.uid(), and a card belonging to someone else matches no row, which
-- raises and rolls back the log insert with it.
-- ------------------------------------------------------------
create or replace function record_review(
  p_card_id uuid,
  p_scheduling jsonb,
  p_log jsonb
)
returns cards
language plpgsql
set search_path = public, pg_temp
as $$
declare
  updated cards;
begin
  insert into review_logs (
    user_id, card_id, rating, state, elapsed_days, scheduled_days, reviewed_at
  )
  values (
    auth.uid(),
    p_card_id,
    (p_log ->> 'rating')::smallint,
    (p_log ->> 'state')::smallint,
    (p_log ->> 'elapsed_days')::integer,
    (p_log ->> 'scheduled_days')::integer,
    coalesce((p_log ->> 'reviewed_at')::timestamptz, now())
  );

  update cards set
    due            = (p_scheduling ->> 'due')::timestamptz,
    stability      = (p_scheduling ->> 'stability')::double precision,
    difficulty     = (p_scheduling ->> 'difficulty')::double precision,
    elapsed_days   = (p_scheduling ->> 'elapsed_days')::integer,
    scheduled_days = (p_scheduling ->> 'scheduled_days')::integer,
    learning_steps = (p_scheduling ->> 'learning_steps')::integer,
    reps           = (p_scheduling ->> 'reps')::integer,
    lapses         = (p_scheduling ->> 'lapses')::integer,
    state          = (p_scheduling ->> 'state')::smallint,
    last_review    = (p_scheduling ->> 'last_review')::timestamptz
  where id = p_card_id
    and user_id = auth.uid()
  returning * into updated;

  if updated is null then
    raise exception 'card % not found for the current operator', p_card_id;
  end if;

  return updated;
end;
$$;
