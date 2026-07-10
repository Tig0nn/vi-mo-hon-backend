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
| `savings` | integer | Initialized to `0` |
| `knowledge` | integer | Initialized to `0` |

The current repository does not select an `id`, `wealth`, `created_at`, or `updated_at` field from `user_progress`; this document does not assert their presence, absence, type, generated status, or nullability.

## Expense and game persistence

Run `supabase/migrations/20260710_expense_challenge_persistence.sql` once through the Supabase SQL Editor before using this slice against the live project. It is idempotent and never drops, truncates, or deletes data.

The migration adds only these columns when absent:

- `challenges.difficulty text not null default 'easy'`
- `challenges.discipline_reward integer not null default 5`

It reuses these existing tables:

| Table | Backend use |
| --- | --- |
| `expenses` | Quick expense records; `spent_at` maps to API `occurredAt`, and `raw_text` maps to API `text`. Currency is computed as `VND`. |
| `challenges` | Seeded MVP definition (`challenge-1`) and rewards. |
| `user_challenges` | Per-user status and completion time, keyed by `(user_id, challenge_id)`. |
| `bosses` | Seeded `impulse-boss` definition. |
| `user_boss_progress` | Per-user boss HP/status, keyed by `(user_id, boss_id)`. |

`ensure_default_game_state_v1(text)` lazily creates missing progress, challenge, and boss rows without resetting existing state. `record_expense_and_add_xp_v1(...)` inserts one expense and awards XP atomically. `complete_challenge_v1(text, text)` locks the user challenge row and atomically marks completion, awards progress, and damages the linked boss. All three functions use a safe `search_path`; execution is revoked from `PUBLIC`, `anon`, and `authenticated`, then granted only to `service_role`.

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
