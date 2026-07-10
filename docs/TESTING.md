# Testing

Do not mark a check PASS unless it has actually been run and recorded for the relevant environment.

## Database smoke test

- [ ] Run `npm run test:db`.
- [ ] The read query against `bosses` succeeds.
- [ ] No secret appears in command output.

## Expense, challenge, and dashboard persistence

1. Run `supabase/migrations/20260710_expense_challenge_persistence.sql` in Supabase SQL Editor. Do not add `DATABASE_URL` or create another project.
2. Start the API and create/update a test profile:

```http
POST /api/profile
Content-Type: application/json

{
  "userId": "test-user-persistence",
  "displayName": "Minh",
  "monthlyBudget": 3000000,
  "mainGoal": "save_money",
  "targetAmount": 20000000,
  "targetDate": "2027-01-01",
  "triggers": ["flash_sale"]
}
```

3. Run these Postman requests in order:

```http
POST /api/expenses/quick-input
{ "userId": "test-user-persistence", "text": "tra sua 55000", "category": "FOOD_DRINK" }
```

Expected: `201`.

```http
GET /api/expenses?userId=test-user-persistence&page=1&pageSize=20
GET /api/challenges?userId=test-user-persistence
POST /api/challenges/challenge-1/complete
{ "userId": "test-user-persistence" }
POST /api/challenges/challenge-1/complete
{ "userId": "test-user-persistence" }
GET /api/dashboard/test-user-persistence
```

Expected statuses, respectively: `200`, `200`, `200`, `409`, `200`.

Verify safely in the SQL Editor:

```sql
select id, user_id, title, amount, category, raw_text, spent_at
from public.expenses where user_id = 'test-user-persistence' order by spent_at desc;

select user_id, xp, level, discipline, savings, knowledge, wealth
from public.user_progress where user_id = 'test-user-persistence';

select user_id, challenge_id, status, completed_at
from public.user_challenges where user_id = 'test-user-persistence';

select user_id, boss_id, current_hp, status
from public.user_boss_progress where user_id = 'test-user-persistence';
```

The second completion must leave XP, discipline, and boss HP unchanged.

## Profile API

- [ ] A valid POST creates or upserts a Supabase profile.
- [ ] A `user_progress` row is created once.
- [ ] Repeated POST does not reset XP or stats.
- [ ] GET returns the Supabase profile.
- [ ] PATCH updates only supplied fields.
- [ ] A missing profile returns `404`.

## Automated persistence coverage

- [x] Quick expenses persist through the atomic RPC and award exactly 5 XP.
- [x] Expense listings are newest-first with exact pagination totals.
- [x] Challenge completion is idempotent, awards persisted rewards once, and clamps boss HP at zero.
- [x] Dashboard reads persisted progress, expenses, boss progress, and challenges without Reflection data.

## Implemented onboarding validation

Automated coverage is in `test/profile.validator.test.js` and `test/api.test.js`.

- [x] Missing or blank required Profile fields return `400`.
- [x] Invalid goal, trigger, or preferred-tone codes return `400`.
- [x] Zero, negative, decimal, non-finite, and invalid numeric budget/target values are rejected.
- [x] Invalid, nonexistent, past, or same-day target dates are rejected.
- [x] Empty or invalid trigger arrays are rejected; duplicate trigger codes are removed.
- [x] A valid onboarding payload succeeds and defaults `preferredTone` to `funny`.
- [x] PATCH remains partial, rejects an empty body or body `userId`, and preserves omitted fields.

## Frontend/manual acceptance checklist

- [ ] Raw goal codes do not appear in the UI.
- [ ] `reduce_impulse_shopping` displays as “Giảm mua sắm bốc đồng”.
- [ ] `20000000` displays as `20.000.000đ`.
- [ ] “Ngân sách tháng” is replaced with “Giới hạn chi tiêu mỗi tháng”.
- [ ] The Profile view shows `targetAmount`.
- [ ] The Profile view shows `targetDate`.
- [ ] Onboarding cannot complete while a required field is missing.
- [ ] Bottom navigation does not appear during onboarding.
- [ ] A failed Profile POST does not persist `onboardingCompleted`.

## Final MVP remote push-notification milestone

**PENDING IMPLEMENTATION** — do not mark these checks PASS until the dedicated remote push-notification milestone is implemented and tested.

- [ ] Notification permission is handled.
- [ ] A token is registered for the correct `userId`.
- [ ] The same device does not create duplicate tokens.
- [ ] A user can enable or disable notifications.
- [ ] A test notification reaches a real device.
- [ ] Expired or invalid tokens are handled.
- [ ] The backend does not crash when the notification provider fails.
- [ ] Notifications do not include sensitive financial data.
- [ ] Test on at least 2–3 real devices before opening the MVP to 20 testers.
