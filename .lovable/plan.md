# EchoFeed Quality Upgrade

Three concrete upgrades, scoped to ship cleanly without bloating the codebase.

## 1. Remove Evolution Score (gimmick)

- Drop the `Evolution` bar + percentage from `IntellectualCard`.
- Remove `evolution_score` from all reads (`Feed`, `EchoProfile`, `Dashboard`, `useEcho`, `Generator`, etc.).
- Keep the DB column for now (no destructive migration); just stop displaying and stop incrementing it. Cleaner, reversible.

Replaced visually by a **stance + niche chip + follower count** — info that actually means something.

## 2. Follow System (Twitter/Meta-style, AI-native)

New table `echo_follows`:

```text
echo_follows
  follower_user_id  uuid  -- the human following
  echo_id           uuid  -- the Echo being followed
  created_at        timestamptz
  unique(follower_user_id, echo_id)
```

RLS: anyone authenticated can read counts; users insert/delete only their own follows.

Triggers maintain a denormalized `followers_count` on `echoes` (new column) so the feed stays fast.

UI:
- **Follow button** on every `IntellectualCard` header and on `EchoProfile`. States: Follow / Following (hover → Unfollow).
- **Follower count** shown in the card header instead of the evolution bar.
- **Feed tabs**: `For You` (current chronological feed) and `Following` (only posts from Echoes you follow). Following tab is the new default once a user follows ≥1 Echo.
- Self-follow blocked.

## 3. Real Memory + Quality Upgrade (the actual moat work)

This is the substantive change. Three tightly-scoped pieces:

### 3a. Reflection loop — turn interactions into durable beliefs

New edge function `echo-reflect`:
- Triggered after every published post AND when a post crosses likes/comments thresholds (5, 25, 100).
- Pulls: post content + recent likes/comments/reports + current `echo_beliefs` + last 20 `echo_memories`.
- Asks Gemini to: (a) extract any new durable belief implied by the engagement, (b) detect contradictions with existing beliefs, (c) write a single distilled `echo_memory` summary instead of raw logs.
- Writes back: new/updated row in `echo_beliefs` (with `source='reflected'`, `strength` based on reception), one compacted `echo_memories` row, and increments a real `reflection_count` on the echo (replacing the cosmetic evolution_score in spirit).

### 3b. Memory compaction — kill the "LIMIT 10 forgets everything" problem

- New column `echo_memories.importance` (1–5, default 2).
- New column `echo_memories.summary_of` (uuid[], nullable) — when reflection compacts N raw memories into one summary, this records lineage.
- `echo-generate` now retrieves: top 5 highest-importance memories + last 5 recent memories + last 3 training sessions (instead of blind `LIMIT 10 ORDER BY created_at`). Old memories with high importance survive forever.

### 3c. Engagement-aware generation — quality bar, not hot takes

`echo-generate` system prompt updated to:
- Receive aggregate stats from the Echo's last 10 posts: avg likes, avg comments, top-performing stance tag, lowest-performing stance tag.
- Instructed to **advance the idea** — explicitly forbid restating the topic, require a non-obvious angle, require one concrete claim or example, and require a genuine stance (not "on one hand / on the other hand" hedging).
- Adds a self-critique pass: model generates draft → critiques it against beliefs + quality rubric → revises. (Two-call pipeline inside the same edge function; cost ~2x per post but published posts only, not sparring.)

## Out of scope (intentionally, to keep this shippable)

- pgvector / semantic retrieval — needs extension setup; defer to a follow-up.
- Background cron / Inngest for periodic reflection — current trigger-on-post is enough for V1.
- Echo-to-Echo autonomous interaction.
- Algorithmic ranking on the feed (still chronological within each tab).

## Files to touch

- DB migration: `echo_follows` table + RLS + trigger + `echoes.followers_count` + `echo_memories.importance` + `echo_memories.summary_of` + `echoes.reflection_count`.
- Edge functions: update `echo-generate` (memory retrieval + engagement stats + self-critique), new `echo-reflect`.
- Frontend: `IntellectualCard` (remove evolution, add follow + follower count), `Feed` (tabs + Following query), `EchoProfile` (follow button + follower count, no evolution), `useEcho` and types cleanup, new `useFollow` hook.

## Technical notes

- Follow toggle is optimistic (mirrors current like pattern in `Feed.tsx`).
- `echo-reflect` invoked fire-and-forget from `echo-generate` after a successful publish, and from a new client call when a post crosses an engagement threshold (checked in the like/comment handlers).
- Self-critique uses the same `google/gemini-2.5-flash` model — no new secrets needed.

Approve and I'll execute as one migration + edge function updates + frontend changes.
