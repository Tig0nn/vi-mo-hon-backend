# Vi Mo Hon Backend

Express.js backend for the Vi Mo Hon demo MVP, an AI-assisted financial habit coach for young Vietnamese users. The backend focuses on behavior-change workflows first: profile personalization, quick expense input, AI Anti-Regret Coach, local reminders, challenges, XP/stats, boss progress, and dashboard.

## Tech Stack

- Node.js
- Express.js
- Supabase/PostgreSQL
- Zod for request validation
- Gemini API through backend-only integration

## Getting Started

Install dependencies:

```bash
npm install
```

Create local environment config:

```bash
cp .env.example .env
```

Run in development mode:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Run in normal mode:

```bash
npm start
```

## Supabase persistence migration

Profiles, progress, expenses, challenges, boss progress, and dashboard reads reuse the existing Supabase project and tables. No `pg`, `DATABASE_URL`, new database, or new Supabase project is required.

Before exercising expense, challenge, dashboard, or financial-lesson persistence against Supabase, run [20260710_expense_challenge_persistence.sql](supabase/migrations/20260710_expense_challenge_persistence.sql), [20260713000000_ordered_boss_challenges.sql](supabase/migrations/20260713000000_ordered_boss_challenges.sql), [20260713120000_challenge_rpc_ambiguity_hotfix.sql](supabase/migrations/20260713120000_challenge_rpc_ambiguity_hotfix.sql), [20260713150000_financial_lessons.sql](supabase/migrations/20260713150000_financial_lessons.sql), then [20260713180000_canonicalize_bubble_tea_boss.sql](supabase/migrations/20260713180000_canonicalize_bubble_tea_boss.sql) in the Supabase SQL Editor. The final hotfix transaction canonicalizes the Bubble Tea boss without changing its production `max_hp` or resetting user progress. Do not expose Supabase credentials to the client.

The backend still requires only:

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
```

The Expo client must continue calling this Express API, never Supabase directly.

The default server port is `3000`.

Environment variables are loaded and validated from `src/config/env.js`. `PORT`, `NODE_ENV`, and `GEMINI_MODEL` have safe defaults; Supabase, OpenAI, and Gemini keys can stay empty until those integration slices are used. If `GEMINI_API_KEY` is missing, the Anti-Regret Coach uses the rule-based fallback. Coach chat requires Gemini and returns an AI error instead of a fake response when Gemini is unavailable or returns invalid output.

In non-production environments, Anti-Regret Coach responses include `debug.provider` as either `gemini` or `fallback` so local testing can confirm which path generated the message. The API key is never returned.

## Current Endpoints

```http
GET /api/health
POST /api/profile
GET /api/profile/:userId
PATCH /api/profile/:userId
POST /api/expenses/quick-input
GET /api/expenses?userId=mock-user&page=1&pageSize=20
GET /api/challenges?userId=mock-user
POST /api/challenges/:challengeId/complete
GET /api/lessons?userId=mock-user&bossId=bubble-tea-monster
POST /api/lessons/:lessonId/complete
POST /api/coach/anti-regret
POST /api/coach/chat
GET /api/dashboard/:userId
```

Health response example:

```json
{
  "success": true,
  "message": "Server is healthy",
  "data": {
    "status": "ok",
    "timestamp": "2026-07-07T00:00:00.000Z"
  }
}
```

## Project Structure

```text
vi-mo-hon-backend/
+-- bin/
|   +-- www
+-- docs/
|   +-- API_CONTRACT.md
|   +-- DB_SCHEMA.md
|   +-- MVP_SPEC.md
+-- src/
|   +-- config/
|   +-- controllers/
|   +-- data/
|   +-- middlewares/
|   +-- routes/
|   +-- services/
|   +-- utils/
|   +-- validators/
+-- test/
+-- app.js
+-- package.json
+-- .env.example
```

Reflection remains a future/post-demo module.

## Documentation

- `docs/MVP_SPEC.md`: product and backend MVP scope
- `docs/API_CONTRACT.md`: request/response contract for MVP endpoints
- `docs/DB_SCHEMA.md`: planned Supabase/PostgreSQL tables

## Implementation Notes

- Keep AI calls on the backend only.
- The frontend must never call Gemini directly.
- Use a stable device-generated `userId`, stored locally by the client, for local development and MVP testing.
- Keep route handlers thin: routes -> controllers -> services.
- Keep mock data isolated in `src/data/`.
- Validate external input at API boundaries.
- Keep response shape consistent through `src/utils/response.js`.
- Keep environment parsing centralized in `src/config/env.js`.
