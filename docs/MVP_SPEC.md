# Spec: Vi Mo Hon Backend MVP

## Objective

Vi Mo Hon is an AI-powered financial habit coach that helps young Vietnamese users reduce impulsive spending and purchase regret.

It is not a normal expense tracker, not a banking app, and not a full game. The goal of this backend project is to build a small, testable Express.js backend for the behavior-change financial coaching MVP.

## Tech Stack

- Backend: Express.js
- Database: Supabase/PostgreSQL
- API style: REST API
- AI integration: AI APIs must be called from the backend only. The frontend must not call AI providers, including Gemini, directly.

## Implementation Scope

Completed backend slices:

```text
Slice 1: health check -> environment config -> mock profile -> quick expense input -> XP progression -> initial boss state -> dashboard
Slice 2: challenge list -> challenge completion -> XP + discipline -> boss HP damage -> dashboard update
```

The demo MVP now focuses on:

- Quick expense input
- AI Anti-Regret Coach
- Profile personalization
- Local reminders
- Challenges
- XP/stats
- Boss progress
- Dashboard

Before the external demo, add:

- Supabase persistence for demo testers
- Anti-Regret Coach

Reflection is not part of the demo MVP. Do not implement a Reflection screen, Reflection API, recent reflections, or reflection reward for the demo.

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
- Post-purchase Reflection workflows

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

Planned structure as the demo MVP grows:

```text
src/
+-- config/        # env.js, supabase.js
+-- controllers/   # health, profile, expense, coach, challenge, dashboard
+-- data/          # mock repositories first, Supabase repositories later
+-- middlewares/   # error.middleware.js, notFound.middleware.js
+-- routes/        # health, profile, expense, coach, challenge, dashboard
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
- `GET /api/challenges?userId=mock-user`
- `POST /api/challenges/:challengeId/complete`
- `POST /api/coach/anti-regret`
- `PATCH /api/coach/urges/:urgeId`
- `GET /api/dashboard/:userId`

Future / Post-demo:

- `POST /api/reflections`
- `GET /api/reflections?userId=mock-user`

## Implementation Order

1. Health check + response helper + notFound middleware + error middleware
2. Environment config
3. Mock profile
4. Quick expense input
5. XP progression
6. Initial boss state
7. Dashboard
8. Challenge system
9. Supabase persistence for demo testers
10. Anti-Regret Coach
11. Local reminders
12. Deeper challenge systems

## Implementation Rules

1. Do not implement everything at once. Start with a clean backend vertical slice.
2. Keep code modular: routes -> controllers -> services.
3. Use centralized response helpers.
4. Add error middleware and not-found middleware early.
5. Keep the rule-based Anti-Regret Coach fallback if Gemini is not configured or fails.
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
- Challenge completion updates XP, discipline, boss HP, and active challenge state.
- Anti-Regret Coach returns profile-aware spending guidance for the demo behavior-change loop.
- Dashboard returns profile summary, recent expenses, XP state, discipline, boss state, and active challenges.
- API docs match implemented endpoint behavior.

## Future / Post-demo

Reflection can return after the demo as a post-purchase learning feature. It may include a Reflection screen, Reflection API, recent reflections, and reflection rewards, but none of those belong in the current demo MVP.
