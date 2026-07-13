# Database Schema

This document records the existing Supabase tables used by the backend persistence slices. The backend reuses them; it does not create a new database or Supabase project. Reflection remains out of scope.

API fields are camelCase and database columns are snake_case. Monetary values are VND integer amounts: `55000` means 55,000 VND. Until authentication exists, the backend uses text-based user IDs such as `mock-user` and assigned `test-user-*` values.

## `profiles`

The repository treats `user_id` as the profile key and upsert conflict target. It selects and writes only the columns below; it does not select an `id` or `currency` column. `currency: "VND"` in an API response is computed for compatibility, not persisted by this repository.

| Column | Database type / nullability | Current backend use |
| --- | --- | --- |
| `user_id` | text; non-null unique key | Profile key and upsert conflict target |
| `display_name` | text | Read and written |
| `monthly_budget` | integer | Read and written as VND amount |
| `main_goal` | text | Read and written stable goal code/text |
| `target_amount` | integer; nullable | Read and written target VND amount |
| `target_date` | date; nullable | Read and written target deadline |
| `triggers` | jsonb; nullable | Read and written as an array |
| `preferred_tone` | text; nullable | Read and written; API defaults missing values to `funny` |
| `created_at` | timestamptz | Read from Supabase |
| `updated_at` | timestamptz | Read and written by the repository |

No `profiles.id` column is selected by the repository. The API mapper therefore returns `user_id` as `id` unless a selected row eventually includes an `id` property. No `profiles.currency` column is selected or written.

## `user_progress`

Profile POST initializes this row once with an `upsert` on `user_id` using `ignoreDuplicates: true`, so repeated Profile POSTs do not reset progress. The repository reads only the following fields:

| Column | Database type / nullability | Current backend use |
| --- | --- | --- |
| `user_id` | text; non-null unique key | Progress lookup and upsert conflict target |
| `xp` | integer | Initialized to `0`, read into Profile API |
| `level` | integer | Initialized to `1`, read into Profile API |
| `discipline` | integer | Initialized to `0`, read into Profile API |
| `savings` | integer | Initialized to `0`, returned by Profile and Dashboard APIs |
| `knowledge` | integer | Initialized to `0`, increased by first-time lesson completion and returned by Profile and Dashboard APIs |

The current repository does not select an `id`, `wealth`, `created_at`, or `updated_at` field from `user_progress`; this document does not assert their presence, absence, type, generated status, or nullability. API `wealth` is computed as `discipline + savings + knowledge` and is not persisted.

## Financial lessons

Run `supabase/migrations/20260713150000_financial_lessons.sql` after the three existing persistence migrations. It adds short educational content linked to a Boss without changing challenge rewards.

### `financial_lessons`

| Column | Database type / nullability | Backend use |
| --- | --- | --- |
| `id` | text; primary key | Stable lesson identifier |
| `boss_id` | text; non-null FK to `bosses(id)` | Groups lessons under the existing Boss |
| `title`, `summary` | text; non-null | Lesson list presentation |
| `cards` | jsonb; non-empty array | Four ordered flashcards with `id`, `title`, and `body` |
| `question` | text; non-null | Final quiz question |
| `answers` | jsonb; non-empty array | Public answer IDs and labels |
| `correct_answer_id` | text; non-null | Read only inside the backend-only completion RPC; never returned by REST |
| `explanation` | text; non-null | Returned after checking an answer |
| `reward_xp` | integer; non-negative; default `20` | One-time XP reward |
| `knowledge_reward` | integer; non-negative; default `2` | One-time Knowledge reward |
| `sort_order` | positive integer | Unique ordering within a Boss |
| `is_active` | boolean; default `true` | Controls list/completion availability |
| `created_at`, `updated_at` | timestamptz | Audit timestamps |

The lesson migration seeds `bubble-tea-small-costs`, `bubble-tea-trigger`, and `bubble-tea-promotion`. The canonicalization hotfix links all three to production boss `bubble-tea-monster`.

### `user_lesson_progress`

| Column | Database type / nullability | Backend use |
| --- | --- | --- |
| `user_id` | text; non-null FK to `profiles(user_id)`; cascade delete | User side of the composite key |
| `lesson_id` | text; non-null FK to `financial_lessons(id)`; cascade delete | Lesson side of the composite key |
| `status` | text; `in_progress` or `completed` | Completion state |
| `selected_answer_id` | text; nullable | Last submitted answer ID |
| `completed_at` | timestamptz; nullable | First successful completion time |
| `created_at`, `updated_at` | timestamptz | Audit timestamps |

`complete_financial_lesson_v1(text, text, text)` uses a transaction-scoped advisory lock for the user/lesson pair. It compares the submitted answer with database content, records incorrect attempts without reward, and atomically awards XP plus Knowledge only on the first correct completion. Execution is revoked from `PUBLIC`, `anon`, and `authenticated`, then granted only to `service_role`.

Both lesson tables have row-level security enabled with no client policies. Direct table access is revoked from `PUBLIC`, `anon`, and `authenticated`; the Express backend uses the service role, while clients continue to call only the REST API. This prevents `correct_answer_id` and per-user lesson progress from being read directly by a client.

## Expense and game persistence

Run the persistence, ordered-challenge, challenge RPC hotfix, financial lesson, and boss canonicalization migrations in timestamp order through the Supabase SQL Editor. The ordered-challenge migration preserves the existing composite primary key on `user_challenges` and does not drop tables. The RPC hotfixes use fully qualified table-column references, preventing PostgreSQL `42702` errors without changing their signatures.

The migration adds only these columns when absent:

- `challenges.difficulty text not null default 'easy'`
- `challenges.discipline_reward integer not null default 5`

It reuses these existing tables:

| Table | Backend use |
| --- | --- |
| `expenses` | Quick expense records; `spent_at` maps to API `occurredAt`, and `raw_text` maps to API `text`. Currency is computed as `VND`. |
| `challenges` | Seeded MVP definition (`challenge-1`) and rewards. |
| `user_challenges` | Per-user status and completion time, keyed by `(user_id, challenge_id)`. |
| `bosses` | Canonical `bubble-tea-monster` definition (`Quái Vật Trà Sữa`, `food_drink`); its production `max_hp` is preserved. |
| `user_boss_progress` | Per-user boss HP/status, keyed by `(user_id, boss_id)`. |

Ordered boss challenges add `challenges.sequence_order integer not null` (positive and unique per linked boss), `user_challenges.assigned_date date not null` in the `Asia/Ho_Chi_Minh` business timezone, and `user_boss_progress.started_at timestamptz not null default now()`. A partial unique index permits at most one active challenge per user.

`ensure_default_game_state_v1` preserves an existing active boss and initializes `bubble-tea-monster` when a canonical default row is needed. It keeps unfinished challenges active and assigns the lowest uncompleted sequence only after a new business day. `complete_challenge_v1` locks and updates challenge, XP, discipline, and boss HP atomically. Both RPCs accept an optional internal business date for deterministic tests; production defaults to `Asia/Ho_Chi_Minh`.

`20260713180000_canonicalize_bubble_tea_boss.sql` verifies the primary keys and partial unique indexes used by Boss and challenge progress before changing rows. Equivalent legacy challenges are matched to canonical challenges by stable title, with equal `sequence_order` preferred when more than one title match exists. Their `user_challenges` rows are merged on `(user_id, challenge_id)`; completed status wins and the earliest recorded completion time is retained. Unmatched legacy challenges are preserved and appended after the canonical Boss's current maximum sequence, preventing `(linked_boss_id, sequence_order)` collisions and duplicate content. When both legacy and canonical Boss progress rows exist for a user, the migration keeps the lower HP, preserves a defeated status, keeps the earlier `started_at`, and keeps the later `updated_at`.

`ensure_default_game_state_v1(text, date)` lazily creates missing progress, challenge, and boss rows without resetting existing state. `record_expense_and_add_xp_v1(...)` inserts one expense and awards XP atomically. `complete_challenge_v1(text, text, date)` locks the user's game state and atomically marks completion, awards progress, and damages the linked boss. All three functions use a safe `search_path`; execution is revoked from `PUBLIC`, `anon`, and `authenticated`, then granted only to `service_role`.

Dashboard monthly spending uses UTC calendar-month boundaries (`[UTC month start, next UTC month start)`) consistently.

## API-required fields versus nullable legacy columns

The next onboarding implementation must require positive `monthlyBudget` and `targetAmount`, a future `targetDate`, and at least one trigger. The existing profile database columns `monthly_budget`, `target_amount`, `target_date`, `triggers`, and `preferred_tone` may currently be nullable to preserve compatibility with incomplete/legacy profiles. Do not add `NOT NULL` constraints in this docs-only task; assess and handle legacy profiles before a future constraint migration.

## Planned Schema: Remote Push Notifications

Remote push notifications are a future final MVP milestone. Possible future tables include:

- `device_push_tokens`
- `notification_preferences`
- `notification_delivery_logs`

There is no notification migration and no production notification table in the current scope. The final schema will be decided when the dedicated push-notification milestone starts.

## Future / Post-demo

Reflection remains future/post-demo. When authentication is added, preserve the rule that Supabase service-role/secret keys stay in trusted backend environments and that frontend clients call the Express API rather than Supabase directly.
