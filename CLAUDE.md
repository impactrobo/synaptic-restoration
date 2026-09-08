# CLAUDE.md

Synaptic Restoration System — a custom SRS app (Anki's function, cyberpunk
"neural training" theme) with AI-assisted card generation.

Full design history and rationale: see `PROJECT_BRIEF.md`. Read it when you
need the "why" behind a decision below — this file is just the "what."

## Tech stack

- React + Vite + TypeScript
- Tailwind v4 via `@tailwindcss/vite` (NOT `postcss`/`init -p` — deprecated
  in v4, don't suggest it)
- Supabase: Postgres + Row Level Security + Auth (email/password, magic
  link, Google OAuth all enabled)
- Using Supabase's new publishable/secret key system, not legacy
  anon/service_role
- Scheduling algorithm: FSRS via `ts-fsrs` (not SM-2)
- AI generation: Claude API called from a Supabase Edge Function only —
  key never touches the client
- Target: web-based PWA, phone + desktop browser

## Status

Scaffold, Tailwind, Supabase project, auth providers, and `schema.sql` are
done. Nothing from the schema/auth setup is wired into the app yet. Build
in this order:

1. Supabase client instance (`src/lib/supabase.ts`)
2. Auth screen (sign up/in via all three methods)
3. FSRS engine wired to `cards` table scheduling columns
4. Review screen (real data, ported interaction model — see below)
5. Home/title screen
6. AI card generation (Edge Function)
7. Flexible note templates UI, cloze, TTS, binary rating mode

Post-MVP (don't build yet, just don't design against): explain-this-card,
adaptive related-card suggestions, manual card creation UI, xlsx/csv
export-import, review heatmap, sibling burying, filtered study, bulk
browser, load forecasting, image occlusion, audio recording, own-API
exposure. Future/stretch: template builder, alternate theme packs.

## Database (`schema.sql` at project root)

- `templates`: seeds 5 built-in types (basic, cloze, basic_audio,
  cloze_audio, reverse), `fields` JSON per type, extensible later
- `cards`: `content` JSONB (shape driven by `template_id`), FSRS columns
  named to match `ts-fsrs` directly (`due`, `stability`, `difficulty`,
  `elapsed_days`, `scheduled_days`, `reps`, `lapses`, `state`,
  `last_review`), `sibling_group_id` (reverse pairs + future burying),
  `source` (`manual`/`ai`/`import`)
- `review_logs`: one row per rating, indexed for recent-rating-per-card
  and per-day-count queries
- Every table has RLS scoped to `auth.uid()`

## Card generation flow

Input (concept/word/snippet) → multi-select card type(s) → one generation
call returns one card object per type (Reverse returns two records) →
**required editable preview before save, never auto-commit** → same
template schema validates both AI output and manual card creation.

## Aesthetic direction (don't deviate without asking)

Cyberpunk "neural training" theme — Evangelion (dominant, clinical/
terminal look), Cyberpunk: Edgerunners (palette), Metalheart, The Matrix.
Palette: acid green, violet/purple, cyan-white, dark void background,
amber reserved for warnings only.

Exact copy to reuse, don't reinvent:
- Ratings: **REJECT** (Again) / **STRAIN** (Hard) / **SYNC** (Good) /
  **ABSORB** (Easy), each with an R-0x code
- Readouts: QUEUE (due), CHAIN (streak), INTEG (integrity % — drops on
  miss, climbs on hit; green >60%, orange ≤60%, red ≤30%, flashing ≤15%)
- Cards are "encrypted"/"decrypted", not flipped
- Home: "JACK IN" / "DECK BUILDER" / "OPTIONS"
- Long-response warning: hazard-stripe bar + triangle glyph after a
  configurable threshold (15s/60s/off), header shows live "LATENCY Ns"
- Integrity hitting 0 → full-screen "CONNECTION LOST" glitch overlay,
  locked at 0 until 3 consecutive correct answers ("RELINK n/3")
- **Binary log mode** (settings toggle, not on review screen): hides
  Hard/Easy, shows only Again/Good
- **Calm interface** (separate settings toggle): kills chain/combo system
  and all red/orange/shake/flash/hazard feedback entirely; correct answer
  = one green edge-glow around the app boundary, nothing else; REJECT/
  STRAIN relabel to **RETRY/REACH** in this mode

Throwaway React prototypes exist exploring this (not in the real
codebase — reference for interaction/copy only, don't import directly).

## Open questions (ask before deciding)

- Is INTEG a real measured retention rate from `review_logs`, or flavor?
- Should a miss in calm mode get any neutral acknowledgment, or nothing?
- Start review: one deck at a time, or all due cards across every deck?
- Per-deck color: hardcoded or user-picked at creation?
