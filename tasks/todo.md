# Persistence Slice Checklist

- [x] Migration is idempotent and has no destructive statements.
- [x] Expense writes use an atomic RPC and list uses exact-count pagination.
- [x] Challenge completion is atomic and idempotent.
- [x] Dashboard reads persisted profile, progress, expenses, boss, and challenges.
- [x] Existing profile POST keeps its progress and game state.
- [x] API and repository tests pass without real Supabase credentials.
- [x] Documentation includes migration, verification, and duplicate-completion steps.
