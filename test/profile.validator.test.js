const assert = require('node:assert/strict');
const test = require('node:test');

const { profileCreateSchema, profileUpdateSchema } = require('../src/validators/profile.validator');

const toDateKey = (date) => date.toISOString().slice(0, 10);
const today = () => toDateKey(new Date());
const tomorrow = () => toDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000));
const yesterday = () => toDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));

const validProfile = () => ({
  userId: 'vmh-device-generated-id',
  displayName: 'Minh',
  monthlyBudget: 3000000,
  mainGoal: 'reduce_impulse_shopping',
  targetAmount: 20000000,
  targetDate: tomorrow(),
  triggers: ['friends', 'flash_sale', 'friends'],
});

test('profile onboarding validation accepts canonical data, defaults tone, and de-duplicates triggers', () => {
  const result = profileCreateSchema.safeParse(validProfile());

  assert.equal(result.success, true);
  assert.equal(result.data.preferredTone, 'funny');
  assert.deepEqual(result.data.triggers, ['friends', 'flash_sale']);
});

test('profile onboarding validation rejects incomplete or invalid onboarding fields', () => {
  const invalidCases = [
    ['missing userId', { userId: undefined }],
    ['missing displayName', { displayName: undefined }],
    ['blank displayName', { displayName: '   ' }],
    ['invalid mainGoal', { mainGoal: 'Tiết kiệm tiền' }],
    ['missing monthlyBudget', { monthlyBudget: undefined }],
    ['zero monthlyBudget', { monthlyBudget: 0 }],
    ['negative monthlyBudget', { monthlyBudget: -1 }],
    ['decimal monthlyBudget', { monthlyBudget: 1.5 }],
    ['invalid monthlyBudget string', { monthlyBudget: 'abc' }],
    ['missing targetAmount', { targetAmount: undefined }],
    ['zero targetAmount', { targetAmount: 0 }],
    ['negative targetAmount', { targetAmount: -1 }],
    ['missing targetDate', { targetDate: undefined }],
    ['invalid targetDate format', { targetDate: '12/31/2026' }],
    ['nonexistent targetDate', { targetDate: '2026-02-31' }],
    ['past targetDate', { targetDate: yesterday() }],
    ['same-day targetDate', { targetDate: today() }],
    ['empty triggers', { triggers: [] }],
    ['blank trigger', { triggers: ['   '] }],
    ['invalid trigger code', { triggers: ['flash_sale', 'shopping'] }],
    ['invalid preferredTone', { preferredTone: 'mean' }],
  ];

  for (const [name, override] of invalidCases) {
    const result = profileCreateSchema.safeParse({ ...validProfile(), ...override });
    assert.equal(result.success, false, name);
  }
});

test('profile patch validation is partial but rejects an empty body, body userId, and invalid supplied fields', () => {
  assert.equal(profileUpdateSchema.safeParse({ monthlyBudget: 3500000 }).success, true);

  const invalidCases = [
    {},
    { userId: 'another-user' },
    { monthlyBudget: 0 },
    { targetDate: yesterday() },
    { triggers: [] },
  ];

  for (const payload of invalidCases) {
    assert.equal(profileUpdateSchema.safeParse(payload).success, false, JSON.stringify(payload));
  }
});
