# Database Schema

This document defines the planned Supabase/PostgreSQL schema for the demo MVP. Use `mock-user` for local development and assigned `test-user-*` IDs for external demo testing until authentication is introduced.

The demo MVP stores profile personalization, quick expenses, Anti-Regret Coach urges, challenges, XP/stats, boss progress, and dashboard data. Local reminders remain part of the product demo scope but do not require backend reminder tables yet. Reflection is a future/post-demo feature only and is not required for the current demo schema.

## Conventions

- Primary keys use UUIDs.
- Timestamps use `timestamptz`.
- API response fields use camelCase.
- Database columns use snake_case.
- Money amounts are stored as integer minor units for VND, so `55000` means `55,000 VND`.
- Start with simple tables and add constraints as product behavior becomes stable.

## Demo User Strategy

Before authentication is introduced, the backend should use text-based user IDs.

For external demo testing, create or allow these user IDs:

- test-user-1
- test-user-2
- test-user-3
- test-user-4
- test-user-5

Do not use only `mock-user` for external testers because their data would overlap.

## Tables

## `profiles`

Stores one financial habit profile per user.

| Column            | Type          | Required | Notes                                                   |
| ----------------- | ------------- | -------- | ------------------------------------------------------- |
| `id`              | `uuid`        | yes      | Primary key                                             |
| `user_id`         | `text`        | yes      | Unique until auth exists                                |
| `display_name`    | `text`        | yes      | User-facing name                                        |
| `monthly_budget`  | `integer`     | yes      | VND amount                                              |
| `currency`        | `text`        | yes      | Default `VND`                                           |
| `level`           | `integer`     | yes      | Default `1`                                             |
| `xp`              | `integer`     | yes      | Default `0`                                             |
| `discipline`      | `integer`     | yes      | Default `0`                                             |
| `created_at`      | `timestamptz` | yes      | Default `now()`                                         |
| `updated_at`      | `timestamptz` | yes      | Default `now()`                                         |
| `main_goal`       | `text`        | no       | Example: save 20,000,000 VND                            |
| `common_triggers` | `jsonb`       | no       | Example: ["flash_sale", "stress", "friends"]            |
| `preferred_tone`  | `text`        | no       | `gentle`, `funny`, `sarcastic_light`, `strict_but_kind` |

Recommended indexes:

- Unique index on `user_id`

## `expenses`

Stores quick expense entries.

| Column        | Type          | Required | Notes                               |
| ------------- | ------------- | -------- | ----------------------------------- |
| `id`          | `uuid`        | yes      | Primary key                         |
| `user_id`     | `text`        | yes      | References `profiles.user_id` later |
| `text`        | `text`        | no       | Raw quick input                     |
| `amount`      | `integer`     | yes      | Positive VND amount                 |
| `currency`    | `text`        | yes      | Default `VND`                       |
| `category`    | `text`        | no       | Example: `FOOD_DRINK`               |
| `occurred_at` | `timestamptz` | yes      | Defaults to server time             |
| `created_at`  | `timestamptz` | yes      | Default `now()`                     |
| `updated_at`  | `timestamptz` | yes      | Default `now()`                     |

Recommended indexes:

- `(user_id, occurred_at desc)`
- `(user_id, category)`

## `spending_urges`

Stores planned purchases or buying urges before the user actually spends money.

| Column       | Type          | Required | Notes                                     |
| ------------ | ------------- | -------- | ----------------------------------------- |
| `id`         | `uuid`        | yes      | Primary key                               |
| `user_id`    | `text`        | yes      | Owner                                     |
| `item_name`  | `text`        | yes      | Item user wants to buy                    |
| `amount`     | `integer`     | no       | Planned amount in VND                     |
| `reason`     | `text`        | no       | Why the user wants it                     |
| `trigger`    | `text`        | no       | Example: `FLASH_SALE`, `FOMO`, `STRESS`   |
| `status`     | `text`        | yes      | `PENDING`, `BOUGHT`, `SKIPPED`, `DELAYED` |
| `created_at` | `timestamptz` | yes      | Default `now()`                           |
| `updated_at` | `timestamptz` | yes      | Default `now()`                           |

## `boss_states`

Stores gamified progress for the current behavioral boss.

| Column       | Type          | Required | Notes                     |
| ------------ | ------------- | -------- | ------------------------- |
| `id`         | `uuid`        | yes      | Primary key               |
| `user_id`    | `text`        | yes      | One active state per user |
| `boss_id`    | `text`        | yes      | Example: `impulse-boss`   |
| `boss_name`  | `text`        | yes      | Example: `Impulse Boss`   |
| `current_hp` | `integer`     | yes      | Current HP                |
| `max_hp`     | `integer`     | yes      | Max HP                    |
| `status`     | `text`        | yes      | `ACTIVE`, `DEFEATED`      |
| `created_at` | `timestamptz` | yes      | Default `now()`           |
| `updated_at` | `timestamptz` | yes      | Default `now()`           |

Recommended indexes:

- Unique partial index for one active boss per `user_id`

## `xp_events`

Stores progression changes as an append-only log.

| Column        | Type          | Required | Notes                                |
| ------------- | ------------- | -------- | ------------------------------------ |
| `id`          | `uuid`        | yes      | Primary key                          |
| `user_id`     | `text`        | yes      | Owner                                |
| `source_type` | `text`        | yes      | `EXPENSE`, `SPENDING_URGE`, `CHALLENGE` |
| `source_id`   | `uuid`        | no       | Related entity id                    |
| `xp_delta`    | `integer`     | yes      | Can be positive or negative later    |
| `reason`      | `text`        | no       | Short explanation                    |
| `created_at`  | `timestamptz` | yes      | Default `now()`                      |

Recommended indexes:

- `(user_id, created_at desc)`

## `challenges`

Stores challenge definitions.

| Column        | Type          | Required | Notes                    |
| ------------- | ------------- | -------- | ------------------------ |
| `id`          | `uuid`        | yes      | Primary key              |
| `code`        | `text`        | yes      | Unique stable code       |
| `title`       | `text`        | yes      | User-facing title        |
| `description` | `text`        | yes      | User-facing description  |
| `xp_reward`   | `integer`     | yes      | XP granted on completion |
| `is_active`   | `boolean`     | yes      | Default `true`           |
| `created_at`  | `timestamptz` | yes      | Default `now()`          |

Recommended indexes:

- Unique index on `code`
- `is_active`

## `user_challenges`

Stores challenge assignment and completion state per user.

| Column         | Type          | Required | Notes                            |
| -------------- | ------------- | -------- | -------------------------------- |
| `id`           | `uuid`        | yes      | Primary key                      |
| `user_id`      | `text`        | yes      | Owner                            |
| `challenge_id` | `uuid`        | yes      | References `challenges.id`       |
| `status`       | `text`        | yes      | `ACTIVE`, `COMPLETED`, `EXPIRED` |
| `completed_at` | `timestamptz` | no       | Set on completion                |
| `created_at`   | `timestamptz` | yes      | Default `now()`                  |
| `updated_at`   | `timestamptz` | yes      | Default `now()`                  |

Recommended indexes:

- `(user_id, status)`
- Unique index on `(user_id, challenge_id)`

## Future Auth Notes

When authentication is added:

- Replace `text user_id` with Supabase auth user ids where appropriate.
- Add row-level security policies for every user-owned table.
- Ensure service-role keys are used only from trusted backend environments.
- Keep frontend clients away from AI provider keys and backend-only secrets.

## Future / Post-demo: Reflections

A future Reflection release may add a `reflections` table for short post-purchase learning notes and may add `REFLECTION` as an `xp_events.source_type`. Do not require those for the current demo MVP.
