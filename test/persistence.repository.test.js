const test = require('node:test');
const assert = require('node:assert/strict');

test('persistence repositories expose Supabase-backed expense, challenge, and boss boundaries', () => {
  const expenseRepository = require('../src/repositories/expense.repository');
  const challengeRepository = require('../src/repositories/challenge.repository');
  const bossRepository = require('../src/repositories/boss.repository');

  assert.equal(typeof expenseRepository.recordExpenseAndAddXp, 'function');
  assert.equal(typeof challengeRepository.completeChallenge, 'function');
  assert.equal(typeof bossRepository.findBossState, 'function');
});
