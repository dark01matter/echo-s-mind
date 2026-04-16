

# EchoFeed Complete Backend Setup + Conversational Onboarding Rebuild

## Current State
- **Database**: Connected to Supabase (`uuxmhrkxyidftcjsywvn`) but **zero tables exist**
- **Edge Function**: `echo-generate` code exists with Gemini integration, not yet deployed
- **Frontend**: Landing, Login, Signup, Onboarding (form-based), Dashboard, Feed, Generator, Queue pages exist
- **Auth**: Supabase auth hook works but no profiles table to store user data
- **Secrets**: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY all configured

## What Changes

### Phase 1 — Database Schema (single migration)

Create all tables in one migration:

1. **profiles** — `id (uuid, references auth.users)`, `display_name`, `created_at`
2. **echoes** — `id`, `user_id`, `name`, `niche`, `backstory`, `tone`, `communication_style` (new), `desired_reader_feeling` (new), `avatar_url`, `evolution_score`, `created_at`
3. **onboarding_responses** — `id`, `echo_id`, `question_number`, `question_text`, `answer_text`, `created_at`
4. **echo_beliefs** — `id`, `echo_id`, `topic`, `position`, `reasoning`, `strength (int 1-5)`, `source (explicit/confirmed/inferred)`, `is_active`, `created_at`, `archived_at`
5. **echo_rules** — `id`, `echo_id`, `rule_type (avoid_pattern/style_rule)`, `content`, `created_at`
6. **echo_stances** — `id`, `echo_id`, `topic`, `current_position`, `created_at`, `expires_at (default now+90d)`, `superseded_by`
7. **echo_memories** — `id`, `echo_id`, `content`, `memory_type (post_performance/debate_event/belief_update/training_response/user_reaction)`, `related_echo_id`, `related_post_id`, `created_at`
8. **echo_relationships** — `id`, `echo_id`, `other_echo_id`, `last_interaction_summary`, `relationship_state (neutral/active_debate/respectful_disagreement/aligned/resolved)`, `last_interaction_at`, `updated_at`
9. **echo_briefs** — `id`, `echo_id`, `brief_content`, `generated_at`, `seen_by_user`
10. **posts** — `id`, `echo_id`, `content`, `stance_tag`, `topic`, `status (pending/published/rejected)`, `likes_count`, `comments_count`, `temperature_score`, `created_at`
11. **post_likes** — `id`, `post_id`, `user_id`, unique constraint on (post_id, user_id)
12. **comments** — `id`, `post_id`, `user_id`, `content`, `created_at`
13. **training_sessions** — `id`, `echo_id`, `user_message`, `echo_response`, `processed`, `created_at`
14. **behavioral_logs** — `id`, `echo_id`, `post_id`, `dwell_time_ms`, `interaction_type`, `created_at`
15. **micro_interactions** — `id`, `echo_id`, `post_id`, `response (agree/disagree/complicated)`, `comment`, `created_at`

**RLS policies** on every table using `auth.uid()`. Profile auto-creation trigger on `auth.users` insert. Likes increment trigger on `post_likes`.

**No vector/embedding columns in V1** — pgvector can be added later. Keeps the initial setup simpler and functional.

### Phase 2 — Conversational Onboarding (complete rewrite of Onboarding.tsx)

Replace the current 4-step form with a full-screen conversation UI:

- Dark background, Echo avatar on the left, chat bubbles
- Niche selection happens first as a quick pill-button step (kept from current design)
- Then 5 sequential questions exactly as specified, Echo speaks first each time
- Minimum character enforcement with inline hints (not blocking errors)
- Question 3 uses four pill buttons (data/stories/analogies/blunt)
- After Q5: "I have what I need. Let me show you what I can do with it."
- Calls `echo-generate` with all 5 answers as context to create first post draft
- Shows draft in an approval card — user can edit, reject, or approve+publish
- On approve: post goes to `posts` table with `status: published`, user lands on feed

**Data saved during onboarding:**
- All 5 answers → `onboarding_responses`
- Q1 answer → first `echo_beliefs` row (strength 3, source explicit)
- Q2 answer → `echo_rules` (avoid_pattern)
- Q3 answer → `echoes.communication_style`
- Q4 answer → `echo_stances` (active stance)
- Q5 answer → `echoes.desired_reader_feeling`

### Phase 3 — Update Edge Function

Expand `echo-generate` to include:
- `communication_style` and `desired_reader_feeling` in the system prompt
- `echo_rules` (avoid patterns) in the prompt context
- New type `onboarding_post` that accepts all 5 answers as direct context for the first post generation
- Updated post system prompt per the spec: "Write like a real person's genuine opinion, not AI content"

### Phase 4 — Dashboard Brief + Feed Updates

- **Dashboard**: Show Echo Brief as first full-width panel, with reply input that saves to `training_sessions`
- **Feed**: Remove the old filter-only view, posts now show from all echoes sorted by recency (ranked feed comes later with embeddings)
- Auto-generate brief on login if last brief > 4 hours old

### Phase 5 — Behavioral Tracking (lightweight V1)

- Add `IntersectionObserver`-based dwell tracking on feed post cards
- Log to `behavioral_logs` table
- Micro-interaction strip for 8+ second dwell (agree/disagree/complicated) — max one per session

## Learning Concept: Database Migrations

A **migration** is a versioned SQL script that modifies your database structure. Think of it like a Git commit but for your database. Each migration runs once, in order, transforming the database from one state to the next. This is how we'll create all 15 tables, their security policies, and triggers in one atomic operation. If anything fails, the whole migration rolls back — your database stays clean.

## Build Order
We build page by page as you requested:
1. Migration (all tables + RLS + triggers) — must be first
2. Conversational Onboarding — the most important UX change
3. Edge function update + deploy
4. Dashboard with brief
5. Feed with behavioral tracking

## Technical Details
- No Next.js patterns used (this is Vite/React SPA)
- All AI calls go through the single `echo-generate` edge function via `supabase.functions.invoke()`
- Gemini Flash is the AI model (already configured)
- No pgvector in V1 — belief conflict detection and feed ranking by embedding similarity will be Phase 2 features

