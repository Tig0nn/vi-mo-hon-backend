const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('persistence repositories expose Supabase-backed expense, challenge, and boss boundaries', () => {
  const expenseRepository = require('../src/repositories/expense.repository');
  const challengeRepository = require('../src/repositories/challenge.repository');
  const bossRepository = require('../src/repositories/boss.repository');

  assert.equal(typeof expenseRepository.recordExpenseAndAddXp, 'function');
  assert.equal(typeof challengeRepository.completeChallenge, 'function');
  assert.equal(typeof bossRepository.findBossState, 'function');
});

test('game business logic does not hard-code seeded boss or challenge ids', () => {
  const businessFiles = [
    'src/repositories/boss.repository.js',
    'src/repositories/challenge.repository.js',
    'src/services/boss.service.js',
    'src/services/challenge.service.js',
    'src/services/dashboard.service.js',
  ];
  const source = businessFiles
    .map((file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8'))
    .join('\n');
  const migration = fs.readFileSync(
    path.join(__dirname, '..', 'supabase/migrations/20260713_ordered_boss_challenges.sql'),
    'utf8',
  );
  const rpcSource = migration.slice(migration.indexOf('DROP FUNCTION'));

  assert.doesNotMatch(source, /impulse-boss|challenge-1/);
  assert.doesNotMatch(rpcSource, /impulse-boss|challenge-1/);
});

test('challenge RPC hotfix qualifies identifiers that overlap RETURNS TABLE fields', () => {
  const hotfix = fs.readFileSync(
    path.join(__dirname, '..', 'supabase/migrations/20260713_challenge_rpc_ambiguity_hotfix.sql'),
    'utf8',
  );

  assert.match(hotfix, /CREATE OR REPLACE FUNCTION public\.ensure_default_game_state_v1/);
  assert.match(hotfix, /CREATE OR REPLACE FUNCTION public\.complete_challenge_v1/);
  assert.match(hotfix, /UPDATE public\.user_challenges AS uc/);
  assert.match(hotfix, /WHERE uc\.user_id = p_user_id\s+AND uc\.challenge_id = p_challenge_id/);
  assert.match(hotfix, /ON CONFLICT ON CONSTRAINT user_challenges_pkey/);
  assert.doesNotMatch(hotfix, /WHERE\s+user_id\s*=|AND\s+challenge_id\s*=|AND\s+boss_id\s*=/);
  assert.doesNotMatch(hotfix, /ON CONFLICT \(user_id, challenge_id\)/);
});
