# AGENTS.md

Guidance for AI agents and contributors working in this repository.

## Project Context

Vi Mo Hon is an Express.js backend for an AI-assisted financial habit coach. The MVP is a behavior-change backend, not a banking app, a full expense tracker, or a full game.

## Read These First

Before making implementation changes, read:

1. `README.md`
2. `docs/MVP_SPEC.md`
3. `docs/API_CONTRACT.md`
4. `docs/DB_SCHEMA.md`

If endpoint behavior changes, update `docs/API_CONTRACT.md` in the same change. If persistence changes, update `docs/DB_SCHEMA.md`.

## Current Stack

- JavaScript with CommonJS modules
- Node.js and Express.js
- Supabase/PostgreSQL active for partial persistence
- Zod active for request validation
- Gemini is called only from the Express backend for AI flows
- The frontend must not call Supabase or Gemini directly
- OpenAI API may be used only for future backend-only AI flows

## Code Organization

Current folders:

```text
src/
+-- config/        # includes env.js and supabase.js
+-- controllers/
+-- data/
+-- middlewares/
+-- repositories/
+-- routes/
+-- services/
+-- utils/
+-- validators/
```

Use this dependency direction:

```text
routes -> controllers -> services -> data clients
```

Keep controllers thin. Put business rules in services. Put request validation in validators or controller boundary code.

## Current Persistence Strategy

- `profiles` uses Supabase/PostgreSQL.
- `user_progress` is initialized and stored in Supabase when a Profile is posted.
- `GET /api/profile/:userId` reads from Supabase and returns `404` when the profile does not exist; it does not fall back to a mock profile.
- Profile POST may synchronize a copy to the mock store so existing hybrid flows continue to work.
- Expenses, Dashboard, Challenges, Boss, and Coach remain mock-backed or hybrid according to the current implementation.
- Do not revert Profile persistence to mock storage.
- Do not migrate another module unless a separate task explicitly requests it.

Mock storage must remain isolated in `src/data/` or a repository-like layer. Do not store mock arrays directly inside controllers. Keep hybrid boundaries explicit so a future persistence task can replace mock storage without changing route paths or response shapes.

The frontend calls the Express backend only. Supabase secret/service-role keys exist only in backend environment variables.

## User ID Strategy

- `mock-user` is only for local development.
- Each tester device creates one stable `userId`.
- The frontend stores that `userId` in AsyncStorage and reuses it after reloads.
- The backend accepts a non-empty `userId`.
- Authentication is not required for MVP testing.

## Onboarding MVP Rules

Required onboarding data:

- `displayName`
- `mainGoal`
- `targetAmount`
- `targetDate`
- `monthlyBudget`
- at least one trigger value

Definitions:

- `monthlyBudget` is the maximum spending limit the user plans for one month.
- `targetAmount` is the amount the user wants to save or achieve.
- `targetDate` is the deadline for completing that goal.

Onboarding must not ask the user to choose an AI personality. `preferredTone` defaults to `funny`; a functioning tone setting may be added later in Profile. Do not create a UI control that has no effect.

User-facing UI copy must not expose raw goal codes or the technical word `trigger`. Use the labels “Mục tiêu của bạn”, “Số tiền bạn muốn tiết kiệm”, “Thời hạn hoàn thành”, “Giới hạn chi tiêu mỗi tháng”, and “Những lúc bạn dễ tiêu tiền”. A waiting period is not a fixed rule; do not present a fixed 24-hour delay as mandatory behavior.

## API Rules

- Use REST endpoints documented in `docs/API_CONTRACT.md`.
- Keep response shape consistent through `src/utils/response.js`.
- Validate request bodies, params, and query strings at API boundaries.
- Paginate list endpoints from the first implementation.
- Do not expose stack traces, API keys, or provider internals in responses.
- Keep all mock storage isolated in a data/repository layer.
- Do not hard-code mock arrays inside controllers.

## AI Integration Rules

- The frontend must never call AI providers directly.
- AI provider keys belong only in backend environment variables.
- Use Gemini for Anti-Regret Coach only from the Express backend when `GEMINI_API_KEY` is configured.
- Keep rule-based/mock coach logic as the fallback if `GEMINI_API_KEY` is not ready or Gemini fails.
- Treat third-party AI responses as untrusted data before using them in logic.

## Notification Roadmap

Remote push notification is the final backend milestone of the MVP. Implement it only after onboarding, persistence, Coach, deployment, and the end-to-end flow are stable, and only when a dedicated task explicitly requests it. After push notification is tested on real devices, the MVP may open to approximately 20 testers.

Local reminders may remain available for development and testing, but they are not the final notification goal.

## Implementation Order

Completed:

1. Health and environment setup
2. Supabase Profile persistence
3. Supabase `user_progress` initialization
4. Existing mock/hybrid Expense, Dashboard, Challenge, Boss, and Coach flows

Next:

1. Onboarding backend validation
2. Frontend onboarding and Profile presentation
3. Expense and Dashboard Supabase persistence
4. Challenge and Boss Supabase persistence
5. Anti-Regret Coach stabilization and fallback testing
6. Backend deployment and end-to-end testing
7. Backend remote push notifications
8. MVP testing with approximately 20 users

## Verification

After changes, run the strongest available checks:

```bash
npm run dev
```

At minimum, verify app module loading:

```bash
node -e "require('./app'); console.log('app loads')"
```

If the system Node.js binary is unavailable, use the bundled Codex Node.js runtime when available.

## Git Notes

This workspace may contain an empty or unavailable `.git` directory. If Git is not usable, still keep changes small and summarize them clearly.

When Git is usable, prefer small commits:

- `docs:` for documentation-only changes
- `feat:` for new API behavior
- `fix:` for bug fixes
- `refactor:` for structure-only changes
- `test:` for tests

## Do Not Do Yet

- Do not build bank or e-wallet integrations.
- Do not build subscription/payment flows.
- Do not build OCR receipt scanning.
- Do not build multiplayer, social, or leaderboard features.
- Do not overbuild boss combat; keep it as simple progression feedback.
- Do not build additional challenge systems beyond the current single mock completion loop yet.
- Do not build Reflection screens, Reflection APIs, recent reflections, or reflection rewards for the current MVP.
