# Vi Mo Hon Backend

Express.js backend for the Vi Mo Hon MVP, an AI-assisted financial habit coach for young Vietnamese users. The backend focuses on behavior-change workflows first: profile, quick expense input, XP progression, initial boss state in the dashboard, and later anti-regret coaching/reflection.

## Tech Stack

- Node.js
- Express.js
- Supabase/PostgreSQL
- Zod for request validation
- OpenAI API through backend-only integration

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

The default server port is `3000`.

Environment variables are loaded and validated from `src/config/env.js`. `PORT` and `NODE_ENV` have safe defaults; Supabase and OpenAI keys can stay empty until those integration slices are implemented.

## Current Endpoints

```http
GET /api/health
POST /api/profile
GET /api/profile/:userId
PATCH /api/profile/:userId
POST /api/expenses/quick-input
GET /api/expenses?userId=mock-user&page=1&pageSize=20
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

Planned additions for later slices:

- `src/config/supabase.js` for Supabase persistence
- Coach, reflection, and challenge modules

## Documentation

- `docs/MVP_SPEC.md`: product and backend MVP scope
- `docs/API_CONTRACT.md`: request/response contract for MVP endpoints
- `docs/DB_SCHEMA.md`: planned Supabase/PostgreSQL tables

## Implementation Notes

- Keep AI calls on the backend only.
- Use `mock-user` for local development and assigned `test-user-*` IDs for external demo testing.
- Keep route handlers thin: routes -> controllers -> services.
- Keep mock data isolated in `src/data/`.
- Validate external input at API boundaries.
- Keep response shape consistent through `src/utils/response.js`.
- Keep environment parsing centralized in `src/config/env.js`.
