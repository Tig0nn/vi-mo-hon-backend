# Implementation Plan: Expense and game-state persistence

## Overview

Move expenses, challenge completion, boss progress, and dashboard reads from the mock store to the existing Supabase tables without changing the public Express API.

## Architecture decisions

- PostgreSQL RPC functions are the sole writers for multi-row expense and challenge mutations.
- Repositories map database rows to API objects; services keep HTTP/business error mapping.
- UTC is the calendar boundary for dashboard monthly spending.

## Task list

### Phase 1: Database foundation
- [x] Add an idempotent migration for default game data, lazy initialization, and service-role RPCs.
- [x] Add repository mappings and test-client overrides for expenses, challenges, and boss state.

### Phase 2: API migration
- [x] Make expense and challenge controllers/services asynchronous and database-backed.
- [x] Make dashboard reads database-backed and initialize default game state safely.
- [x] Ensure profile upserts initialize default game state without resetting it.

### Phase 3: Proof and handoff
- [x] Extend the fake Supabase client and add behavior-focused API tests.
- [x] Update API, database, README, and testing documentation.
- [x] Run the full test suite and module-load check.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Double challenge rewards | Lock the user challenge row in the completion RPC. |
| Existing profile state reset | Use conflict-safe inserts only. |
| Supabase errors leak | Log only safe metadata; map unexpected failures to `Database error`. |
