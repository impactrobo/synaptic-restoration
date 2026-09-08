# Synaptic Restoration System — Project Brief

A custom Spaced Repetition System (SRS) app — Anki's function, with a
cyberpunk/neuro-training aesthetic and AI-assisted card generation.

## Status so far

- Vite + React + TypeScript scaffold created, running locally
- Tailwind v4 installed via `@tailwindcss/vite` (NOT the old `postcss`/`init -p` route — that's deprecated in v4)
- `@supabase/supabase-js` and `ts-fsrs` installed
- GitHub repo connected, `.env.local` gitignored
- Supabase project created (`synaptic-restoration`), using the new
  **publishable/secret key system**, not the legacy anon/service_role keys
- Auth configured: email+password, magic link, and Google OAuth all enabled
  in Supabase (Authentication → Providers)
- Database schema written and ready to run — see `schema.sql` (attached
  separately / in this repo) — covers `decks`, `templates`, `cards`,
  `review_logs`, all with Row Level Security scoped to `auth.uid()`
- Several React UI prototypes built as throwaway artifacts (not yet in the
  real codebase) exploring the review-screen interaction model — see
  "Aesthetic direction" below for what they landed on

## Not yet done (pick up here)

1. Create the actual Supabase client instance in the app (`src/lib/supabase.ts`)
2. Build the auth screen (sign up / sign in via all three methods)
3. Wire the FSRS engine (`ts-fsrs`) to the `cards` table's scheduling columns
4. Build the real review screen component (port the prototype's interaction
   model — see below — into the actual app, connected to real data)
5. Build the home/title screen (port the prototype)
6. AI card generation (Supabase Edge Function calling the Claude API)

## Tech stack

- Frontend: React + Vite + TypeScript, Tailwind v4 (via `@tailwindcss/vite`)
- Backend/DB/Auth: Supabase (Postgres + Row Level Security + Auth)
- Scheduling algorithm: FSRS via `ts-fsrs` (not SM-2 — chosen from the start)
- AI generation: Claude API, called from a Supabase Edge Function (server-side
  only — API key never touches the client)
- Deployment target: web-based PWA, usable on both phone and desktop browser

## Database schema

Full SQL in `schema.sql`. Key design points:
- `templates` table seeds 5 built-in card types: `basic`, `cloze`,
  `basic_audio`, `cloze_audio`, `reverse` — each with a `fields` JSON
  describing its shape, so a future user-facing "template builder" can add
  more without a schema change
- `cards.content` is JSONB, shape driven by the card's `template_id`
- `cards` has FSRS columns (`due`, `stability`, `difficulty`, `elapsed_days`,
  `scheduled_days`, `reps`, `lapses`, `state`, `last_review`) named to match
  `ts-fsrs` conventions directly
- `cards.sibling_group_id` handles both reverse-card pairs (front↔back
  auto-generated twins) and future sibling-burying
- `cards.source` tracks `manual` / `ai` / `import` provenance
- `review_logs` is one row per rating, indexed for two future features:
  per-card recent-rating lookups (mastery/struggle triggers) and per-day
  counts (review heatmap)
- Every table has RLS: a user only ever sees their own rows

## Card generation flow (design, not yet built)

1. User inputs a concept/word/snippet
2. User multi-selects which card type(s) to generate (Basic, Cloze,
   Basic+audio, Cloze+audio, Reverse) — can select more than one at once
3. One generation call returns one card object per selected type (Reverse
   returns two card records — front→back and back→front)
4. **Required gate:** generated cards are shown in an editable preview
   before anything is saved to a deck — never auto-commit
5. Manual card creation (no AI) uses the same template system, so the form
   UI and the AI output validate against the same schema

Card-count is a user-facing slider, capped server-side (e.g. 30/request) to
bound token spend. Output must be strict JSON matching the template's
`fields` shape — validate and reject/re-prompt on mismatch, don't silently
fail.

## Export/import (post-MVP, scoped)

- Both `.xlsx` and `.csv` supported
- Single file, mixed card types distinguished by a `type` column (union of
  all template fields as the header row; unused columns blank per row)
- Imported rows go through the same preview/edit/confirm flow as AI
  generation — never a silent bulk-insert

## Post-MVP AI features (scoped, not built)

- **"Explain this card"** — text-only (no voice), one-shot Claude call
  from the review screen, reuses the generation Edge Function pattern
- **Adaptive related-card suggestions** — a free, DB-only query detects a
  trigger (e.g. N consecutive same rating on one card: mastered → suggest
  advanced/next-step cards; struggling → suggest easier/prerequisite
  cards). Detection must cost nothing; the AI call only fires if the user
  clicks the resulting "suggested cards" label — never automatically.

## Full build priority order

1. Supabase schema + auth/RLS *(done — schema.sql ready to run)*
2. FSRS engine (`ts-fsrs`)
3. React/Vite/Tailwind PWA shell *(scaffold done, shell UI not built)*
4. Review screen (see Aesthetic direction — prototypes exist, not integrated)
5. AI card generation
6. Flexible note templates (schema supports this — UI not built)
7. Cloze deletion
8. TTS (browser `SpeechSynthesis` first)
9. Right/wrong mode (binary Again/Good toggle — see UI notes below)

Post-MVP: explain-this-card, related-card suggestions, manual card
creation UI, export/import, review heatmap, sibling burying, tag-based
filtered study, bulk card browser, load forecasting, image occlusion,
audio recording/pronunciation scoring, own-API exposure (AnkiConnect-style).

Future/stretch: custom template builder (user-defined fields + rich text),
alternate UI theme packs (plant/pet-growth streak theme, Slay the
Spire-style combat deck-builder theme).

## Aesthetic direction (IMPORTANT — this evolved significantly)

**Final direction: cyberpunk "neural training" theme, fully replacing an
earlier Balatro-inspired concept.** App name idea: **"Synaptic Restoration
System."** References: Evangelion (dominant — clinical/terminal look),
Cyberpunk: Edgerunners (color palette), Metalheart, The Matrix. Sci-fi
language is leaned into hard and consistently:

- Cards are "encrypted"/"decrypted", not flipped
- Ratings: **REJECT** (Again) / **STRAIN** (Hard) / **SYNC** (Good) /
  **ABSORB** (Easy), each with an R-0x code
- Review readouts: QUEUE (due count), CHAIN (streak), INTEG (integrity %,
  a retention-style stat that drops on misses, climbs on hits)
- Title/home screen: "JACK IN" (start review), "DECK BUILDER", "OPTIONS"
- Color palette: acid green, violet/purple, cyan-white, amber flare
  reserved for warnings only — dark void background throughout
- **Long-response warning:** after a configurable threshold (15s/60s/off)
  staring at an unanswered card, a glowing yellow-orange hazard-stripe bar
  slides in along the top of the card with a hazard-triangle glyph, header
  switches to a live "LATENCY Ns" readout
- **Integrity color tiers:** green above 60%, orange at 60% and below, red
  at 30% and below, flashing at 15% and below
- **Connection Lost state:** integrity hitting 0 triggers a full-screen
  glitch overlay ("CONNECTION LOST" / "SIGNAL FAILURE"), locks integrity at
  0, and requires 3 consecutive correct answers in a row to "relink"
  (tracked via a RELINK n/3 readout) before normal scoring resumes
- **Binary log mode** (the "right/wrong" MVP item): a settings toggle,
  NOT on the main review screen, that hides Hard/Easy and shows only
  Again/Good
- **Calm interface option** (accessibility/comfort mode, distinct from
  binary log mode): disables the entire chain/combo system, all red/
  orange/shake/flash feedback, and the hazard warning entirely. A correct
  answer instead shows one green edge-glow around the app's outer
  boundary and nothing else. In this mode the negative ratings relabel
  from REJECT/STRAIN to **RETRY/REACH** (softer framing — describes what
  happens next rather than judging the miss)

Several throwaway React artifacts were built exploring this (review
screen with all of the above, a title screen with a rotating hex/core
counter). None of that code is in the real repo yet — it's reference for
the interaction model and copy, not a component to import directly.

## Open questions / not yet decided

- Whether "INTEG" (integrity %) is purely decorative flavor or should be a
  real measured retention rate computed from `review_logs`
- Whether a missed card in calm mode should get *any* neutral
  acknowledgment, or genuinely nothing (currently: nothing)
- Start review button behavior: default to one deck at a time, or all due
  cards across every deck at once
- Per-deck color: currently hardcoded in prototypes, worth letting users
  pick one at deck-creation time
