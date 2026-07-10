# Testing

Do not mark a check PASS unless it has actually been run and recorded for the relevant environment.

## Database smoke test

- [ ] Run `npm run test:db`.
- [ ] The read query against `bosses` succeeds.
- [ ] No secret appears in command output.

## Profile API

- [ ] A valid POST creates or upserts a Supabase profile.
- [ ] A `user_progress` row is created once.
- [ ] Repeated POST does not reset XP or stats.
- [ ] GET returns the Supabase profile.
- [ ] PATCH updates only supplied fields.
- [ ] A missing profile returns `404`.

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
