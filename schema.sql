-- ============================================================
-- Synaptic Restoration System — Initial Schema
-- Run this in Supabase: Dashboard → SQL Editor → New query
-- ============================================================

-- ------------------------------------------------------------
-- DECKS
-- ------------------------------------------------------------
create table decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text default '#4FD3A0',
  created_at timestamptz not null default now()
);

alter table decks enable row level security;

create policy "Users manage their own decks"
  on decks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- TEMPLATES
-- Built-in templates (user_id null) ship with the app.
-- User-authored templates (future template builder) have user_id set.
-- fields jsonb describes each field: [{ "key": "front", "type": "text" }, ...]
-- ------------------------------------------------------------
create table templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  fields jsonb not null,
  is_builtin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table templates enable row level security;

create policy "Users see builtin + their own templates"
  on templates for select
  using (is_builtin = true or auth.uid() = user_id);

create policy "Users manage their own templates"
  on templates for insert
  with check (auth.uid() = user_id);

create policy "Users update their own templates"
  on templates for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete their own templates"
  on templates for delete
  using (auth.uid() = user_id);

-- Seed the MVP built-in templates
insert into templates (name, fields, is_builtin) values
  ('basic', '[{"key":"front","type":"text"},{"key":"back","type":"text"},{"key":"hint","type":"text","optional":true}]', true),
  ('cloze', '[{"key":"text","type":"cloze"},{"key":"hint","type":"text","optional":true}]', true),
  ('basic_audio', '[{"key":"front","type":"text"},{"key":"back","type":"text"},{"key":"audio_front","type":"audio","optional":true},{"key":"audio_back","type":"audio","optional":true}]', true),
  ('cloze_audio', '[{"key":"text","type":"cloze"},{"key":"audio","type":"audio","optional":true}]', true),
  ('reverse', '[{"key":"front","type":"text"},{"key":"back","type":"text"}]', true);

-- ------------------------------------------------------------
-- CARDS
-- Holds both the content (template-driven) and current FSRS
-- scheduling state. FSRS field names follow ts-fsrs conventions
-- so the library's output can be written straight into a row.
-- ------------------------------------------------------------
create table cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references decks(id) on delete cascade,
  template_id uuid not null references templates(id),

  -- content (shape depends on template.fields)
  content jsonb not null,
  tags text[] not null default '{}',

  -- generation provenance
  source text not null default 'manual' check (source in ('manual', 'ai', 'import')),

  -- reverse-card / sibling grouping (used for burying + reverse pairs)
  sibling_group_id uuid,

  -- FSRS scheduling state
  due timestamptz not null default now(),
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  elapsed_days integer not null default 0,
  scheduled_days integer not null default 0,
  -- index of the (re)learning step the card sits on; ts-fsrs round-trips this
  learning_steps integer not null default 0,
  reps integer not null default 0,
  lapses integer not null default 0,
  state smallint not null default 0, -- 0=New 1=Learning 2=Review 3=Relearning
  last_review timestamptz,

  created_at timestamptz not null default now()
);

alter table cards enable row level security;

create policy "Users manage their own cards"
  on cards for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Fast "what's due" queries per deck
create index cards_due_idx on cards (user_id, deck_id, due);
create index cards_sibling_idx on cards (sibling_group_id);

-- ------------------------------------------------------------
-- REVIEW LOGS
-- One row per review event. This is what FSRS parameter
-- optimization and the review heatmap will both read from.
-- ------------------------------------------------------------
create table review_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references cards(id) on delete cascade,

  rating smallint not null check (rating between 1 and 4), -- 1=Again 2=Hard 3=Good 4=Easy
  state smallint not null, -- card state at time of review
  elapsed_days integer not null,
  scheduled_days integer not null,

  reviewed_at timestamptz not null default now()
);

alter table review_logs enable row level security;

create policy "Users manage their own review logs"
  on review_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Fast lookups for "last N ratings for this card" (mastery/struggle triggers)
-- and for the heatmap (per-day counts)
create index review_logs_card_idx on review_logs (card_id, reviewed_at desc);
create index review_logs_user_day_idx on review_logs (user_id, reviewed_at);

-- ------------------------------------------------------------
-- REVIEW RECORDING
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
