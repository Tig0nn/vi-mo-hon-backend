# AGENTS.md

Guidance for AI agents and contributors working in this repository.

## Project Context

Vi Mo Hon is an Express.js backend for an AI-assisted financial habit coach. The MVP is a behavior-change backend, not a banking app, not a full expense tracker, and not a full game.

Completed backend slices:

```text
Slice 1: health check -> environment config -> mock profile -> quick expense input -> XP progression -> initial boss state -> dashboard
Slice 2: challenge list -> challenge completion -> XP + discipline -> boss HP damage -> dashboard update
```

Supabase persistence, anti-regret coach, reflections, and deeper challenge systems are still future work.

## Read These First

Before making implementation changes, read:

1. `README.md`
2. `docs/MVP_SPEC.md`
3. `docs/API_CONTRACT.md`
4. `docs/DB_SCHEMA.md`

If endpoint behavior changes, update `docs/API_CONTRACT.md` in the same change. If persistence changes, update `docs/DB_SCHEMA.md`.

## Current Stack

- Node.js
- Express.js
- CommonJS modules
- Supabase/PostgreSQL planned for persistence
- Zod planned for request validation
- OpenAI API planned for backend-only AI flows

## Code Organization

Current folders:

```text
src/
+-- config/
+-- controllers/
+-- data/
+-- middlewares/
+-- routes/
+-- services/
+-- utils/
+-- validators/
```

Add these folders as the MVP grows:

```text
src/
+-- config/supabase.js
```

Use this dependency direction:

```text
routes -> controllers -> services -> data clients
```

Keep controllers thin. Put business rules in services. Put request validation in validators or controller boundary code.

## Current Persistence Strategy

For the first backend slice, use mock data only.

Mock data must be isolated in `src/data/` or a repository-like layer. Do not store mock arrays directly inside controllers. Controllers should call services, and services should call the mock data layer.

Design the mock data layer so it can later be replaced by Supabase/PostgreSQL without changing route paths, controller behavior, or API response shapes.

Supabase persistence is planned but should not be implemented until the mock vertical slice works.

## API Rules

- Use REST endpoints documented in `docs/API_CONTRACT.md`.
- Keep response shape consistent through `src/utils/response.js`.
- Validate request bodies, params, and query strings at API boundaries.
- Use `mock-user` for local development. For external demo testing, use assigned `test-user-*` IDs.
- Paginate list endpoints from the first implementation.
- Do not expose stack traces, API keys, or provider internals in responses.
- Use mock data for the first backend slice.
- Keep all mock storage isolated in a data/repository layer.
- Do not hard-code mock arrays inside controllers.
- Design services so mock storage can later be replaced by Supabase without changing routes or response shapes.

## AI Integration Rules

- The frontend must never call AI providers directly.
- AI provider keys belong only in backend environment variables.
- Start with rule-based/mock coach logic if `OPENAI_API_KEY` is not ready.
- Treat third-party AI responses as untrusted data before using them in logic.

## Environment

Use `.env.example` as the source of required environment variables.

Do not commit `.env`, API keys, service-role keys, or local secrets.

## Implementation Order

Recommended order for the next backend work:

1. Health check + response helper + notFound middleware + error middleware.
2. Environment config.
3. Mock profile.
4. Quick expense input.
5. XP progression.
6. Initial boss state.
7. Dashboard.
8. Challenge system.
9. Supabase persistence when preparing external demo/testing.
10. Anti-Regret Coach with rule-based/mock response.
11. Reflection.
12. Deeper challenge systems.

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
- Do not build multiplayer/social/leaderboard features.
- Do not overbuild boss combat; keep it as simple progression feedback.
- Do not build additional challenge systems beyond the current single mock completion loop yet.
