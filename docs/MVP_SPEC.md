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
Slice 1: health check -> environment config -> profile -> quick expense input -> XP progression -> initial boss state -> dashboard
Slice 2: challenge list -> challenge completion -> XP + discipline -> boss HP damage -> dashboard update
Slice 3: boss-linked one-minute lessons -> flashcards + quiz -> one-time XP + knowledge reward
```

The demo MVP now focuses on:

- Quick expense input
- AI Anti-Regret Coach
- Profile personalization
- Local reminders
- Backend-driven remote push notifications as the final MVP milestone
- Challenges
- XP/stats
- Boss progress
- Dashboard
- Short financial lessons linked to the active Boss

Current persistence is hybrid:

- Profiles: Supabase
- User-progress initialization: Supabase
- Expenses: mock
- Challenges: Supabase
- Financial lessons and per-user lesson progress: Supabase
- Boss progress: mock
- Dashboard: hybrid/mock aggregation
- Coach: hybrid; it reads the mock-synchronized profile and uses Gemini when configured, otherwise its Anti-Regret endpoint uses a rule-based fallback

Profile creation/upsert also mirrors the profile into the isolated mock store so the remaining mock-backed flows can use it. This is not a fallback for `GET /api/profile/:userId`, which reads Supabase and returns `404` when no profile exists.

Reflection is not part of the demo MVP. Do not implement a Reflection screen, Reflection API, recent reflections, or reflection reward for the demo.

## Demo Strategy

For the first local development phase, the backend can use mock data to build and verify the vertical slice quickly.

Profiles and their initial progress rows already persist in Supabase/PostgreSQL. The other demo flows remain mock-backed and therefore are not yet durable across restarts.

Authentication is not required for the first demo. On first launch, the client generates a stable device-scoped `userId` and stores it locally. It must reuse that same value after reloads and send it to the Express backend for every user-scoped request.

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
+-- data/          # mock storage for the current mock/hybrid modules
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
- `GET /api/lessons?userId=mock-user&bossId=bubble-tea-monster`
- `POST /api/lessons/:lessonId/complete`
- `POST /api/coach/anti-regret`
- `POST /api/coach/chat`
- `PATCH /api/coach/urges/:urgeId`
- `GET /api/dashboard/:userId`

Future / Post-demo:

- `POST /api/reflections`
- `GET /api/reflections?userId=mock-user`

## MVP Delivery Milestones

1. Onboarding and Profile
2. Expense and Dashboard persistence
3. Challenge and Boss persistence
4. Stable Anti-Regret Coach with fallback
5. Backend deployment and end-to-end testing
6. Backend remote push notifications
7. MVP testing with approximately 20 users

Remote push notifications are not implemented yet. They are the final backend milestone before the MVP opens to approximately 20 testers. Local reminders may continue to support development and testing.

The planned remote push capability may remind users to record expenses, prompt them about active challenges, send reminders appropriate to their goals and behavior, and re-engage them at the right time.

## Implementation Rules

1. Do not implement everything at once. Start with a clean backend vertical slice.
2. Keep code modular: routes -> controllers -> services.
3. Use centralized response helpers.
4. Add error middleware and not-found middleware early.
5. Keep the rule-based Anti-Regret Coach fallback if Gemini is not configured or fails.
6. Do not let frontend call AI directly.
7. Avoid over-engineering the game system. Boss is only a gamification layer, not complex combat.
8. Prioritize working backend APIs over business strategy or full product design.
9. Use a stable device-generated `userId` stored locally for development and MVP testing.
10. Validate request bodies and query params at API boundaries.
11. Mock data must be isolated in a data/repository layer, not hard-coded inside controllers.
12. Keep remaining mock storage isolated so it can later be replaced by Supabase with minimal route/controller changes.
13. Do not migrate Expense, Dashboard, Challenge, or Boss data unless a separate task requests it.
14. For the approximately 20-user MVP test, use stable device-generated user IDs instead of full authentication.

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
- Supabase-backed profile can be created/read/updated, and profile creation initializes Supabase `user_progress` without resetting an existing row.
- Quick expense input creates an expense and updates user progression.
- Challenge completion updates XP, discipline, boss HP, and active challenge state.
- Financial lessons return four short flashcards and a quiz without exposing the correct answer. A first correct completion awards XP and Knowledge exactly once; an incorrect answer awards nothing and can be retried.
- Anti-Regret Coach returns profile-aware spending guidance for the demo behavior-change loop.
- Dashboard returns profile summary, recent expenses, XP state, discipline, boss state, and active challenges.
- API docs match implemented endpoint behavior.

## Future / Post-demo

Reflection can return after the demo as a post-purchase learning feature. It may include a Reflection screen, Reflection API, recent reflections, and reflection rewards, but none of those belong in the current demo MVP.

## Onboarding MVP

### Required onboarding data

- `displayName`
- `mainGoal`
- `targetAmount`
- `targetDate`
- `monthlyBudget`
- `triggers`: at least one value
- `preferredTone`: the backend defaults this to `funny`; onboarding does not ask the user to choose it

Product validation requirements for the next implementation pass:

- `targetAmount` must be greater than 0.
- `monthlyBudget` must be greater than 0.
- `targetDate` must be a valid future date.
- `triggers` must not be empty.

`monthlyBudget` is the maximum the user plans to spend in a month. It is not monthly income, current balance, or total assets. `targetAmount` is the amount the user wants to save or achieve.

### Goal codes and presentation

The API and database may store stable goal codes, but the client must map them to Vietnamese copy and never display raw codes. The required mapping is:

| Code | User-facing label |
| --- | --- |
| `save_money` | Tiết kiệm một khoản tiền |
| `reduce_impulse_shopping` | Giảm mua sắm bốc đồng |
| `reduce_food_drink` | Giảm chi cho ăn uống |
| `reduce_sale_spending` | Bớt mua hàng vì giảm giá |
| `emergency_fund` | Tạo quỹ khẩn cấp |
| `other` | Mục tiêu khác |

The Profile screen should show the goal, target amount, target date, monthly spending limit, and amount spent this month. Do not label `monthlyBudget - monthlySpent` as “Đã tiết kiệm”: unspent budget is not verified savings.
