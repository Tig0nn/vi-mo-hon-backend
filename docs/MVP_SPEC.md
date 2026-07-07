# Spec: Vi Mo Hon Backend MVP

## Objective

Vi Mo Hon is an AI-powered financial habit coach that helps young Vietnamese users reduce impulsive spending and purchase regret.

It is not a normal expense tracker, not a banking app, and not a full game. The goal of this backend project is to build a small, testable Express.js backend for the behavior-change financial coaching MVP.

## Tech Stack

- Backend: Express.js
- Database: Supabase/PostgreSQL
- API style: REST API
- AI integration: AI APIs must be called from the backend only. The frontend must not call AI providers directly.

## Implementation Scope

Build only the backend MVP vertical slice first:

```text
health check -> environment config -> mock profile -> quick expense input -> XP progression -> initial boss state -> dashboard
```

After this slice works, add:

- Anti-Regret Coach
- Reflection

## Demo Strategy

For the first local development phase, the backend can use mock data to build and verify the vertical slice quickly.

Before sending the app demo to 5 external testers, persistence should be migrated to Supabase/PostgreSQL so tester data is not lost between server restarts.

Authentication is not required for the first demo. Use simple test user IDs:

- test-user-1
- test-user-2
- test-user-3
- test-user-4
- test-user-5

Each tester should use one assigned test user ID.

## Out of Scope for MVP

- Bank connection or e-wallet integration
- Investment simulation or full financial planning engine
- Marketplace, social network, or leaderboard
- Multiplayer boss or complex game combat
- Payment subscription
- OCR receipt scanner or advanced AI prediction

## Project Structure

Current structure:

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

Planned structure as the MVP grows:

```text
src/
+-- config/        # env.js, supabase.js
+-- controllers/   # health, profile, expense, coach, reflection, challenge, dashboard
+-- data/          # mock repositories first, Supabase repositories later
+-- middlewares/   # error.middleware.js, notFound.middleware.js
+-- routes/        # health, profile, expense, coach, reflection, challenge, dashboard
+-- services/      # expense, progression, boss, coach, dashboard
+-- validators/    # expense, coach, profile
+-- utils/         # parseMoneyText.js, response.js
```

## Core MVP APIs

- `GET /api/health`
- `GET /api/profile/:userId`
- `POST /api/profile`
- `PATCH /api/profile/:userId`
- `POST /api/expenses/quick-input`
- `GET /api/expenses?userId=mock-user`
- `GET /api/dashboard/:userId`

Later slices:

- `POST /api/coach/anti-regret`
- `PATCH /api/coach/urges/:urgeId`
- `POST /api/reflections`
- `GET /api/reflections?userId=mock-user`
- `GET /api/challenges?userId=mock-user`
- `POST /api/challenges/:challengeId/complete`

Challenge completion is not part of the first backend slice.

## Implementation Order

1. Health check + response helper + notFound middleware + error middleware
2. Environment config
3. Mock profile
4. Quick expense input
5. XP progression
6. Initial boss state
7. Dashboard
8. Supabase persistence for demo testers
9. Anti-Regret Coach
10. Reflection
11. Challenges

## Implementation Rules

1. Do not implement everything at once. Start with a clean backend vertical slice.
2. Keep code modular: routes -> controllers -> services.
3. Use centralized response helpers.
4. Add error middleware and not-found middleware early.
5. Keep AI Coach mock/rule-based first if AI key is not ready.
6. Do not let frontend call AI directly.
7. Avoid over-engineering the game system. Boss is only a gamification layer, not complex combat.
8. Prioritize working backend APIs over business strategy or full product design.
9. Use `mock-user` for local development. Use assigned `test-user-*` IDs for external demo testing.
10. Validate request bodies and query params at API boundaries.
11. Mock data must be isolated in a data/repository layer, not hard-coded inside controllers.
12. Services should be written so mock storage can later be replaced by Supabase with minimal route/controller changes.
13. Before external demo testing, use Supabase persistence instead of in-memory mock data.
14. For the 5-user demo, use assigned test user IDs instead of full authentication.

## Response Format

Success:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Resource not found",
  "errors": {}
}
```

## MVP Acceptance Criteria

- Backend starts with `npm run dev`.
- `GET /api/health` returns a valid JSON health response.
- Mock profile can be created/read/updated.
- Quick expense input creates an expense and updates user progression.
- Dashboard returns profile summary, recent expenses, XP state, and initial boss state.
- API docs match implemented endpoint behavior.
