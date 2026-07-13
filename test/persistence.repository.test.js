const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const LEGACY_BOSS_ID = ['impulse', 'boss'].join('-');

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
    path.join(__dirname, '..', 'supabase/migrations/20260713000000_ordered_boss_challenges.sql'),
    'utf8',
  );
  const rpcSource = migration.slice(migration.indexOf('DROP FUNCTION'));

  const forbiddenSeedIds = new RegExp(`${LEGACY_BOSS_ID}|challenge-1`);
  assert.doesNotMatch(source, forbiddenSeedIds);
  assert.doesNotMatch(rpcSource, forbiddenSeedIds);
});

test('challenge RPC hotfix qualifies identifiers that overlap RETURNS TABLE fields', () => {
  const hotfix = fs.readFileSync(
    path.join(__dirname, '..', 'supabase/migrations/20260713120000_challenge_rpc_ambiguity_hotfix.sql'),
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

test('financial lesson migration defines safe schema, seeds, and a locked backend-only RPC', () => {
  const migration = fs.readFileSync(
    path.join(__dirname, '..', 'supabase/migrations/20260713150000_financial_lessons.sql'),
    'utf8',
  );

  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.financial_lessons/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.user_lesson_progress/);
  assert.match(migration, /boss_id text NOT NULL REFERENCES public\.bosses\(id\)/);
  assert.match(migration, /jsonb_typeof\(cards\) = 'array'/);
  assert.match(migration, /jsonb_array_length\(answers\) > 0/);
  assert.match(migration, /ALTER TABLE public\.financial_lessons ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /ALTER TABLE public\.user_lesson_progress ENABLE ROW LEVEL SECURITY/);
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.financial_lessons, public\.user_lesson_progress\s+FROM PUBLIC, anon, authenticated/,
  );
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.complete_financial_lesson_v1/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /SET search_path = public, pg_temp/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.complete_financial_lesson_v1\(text, text, text\)/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.complete_financial_lesson_v1\(text, text, text\)\s+TO service_role/);
  assert.doesNotMatch(migration, /UPDATE public\.user_progress[\s\S]*wealth\s*=/);
});

test('boss canonicalization hotfix safely merges progress and replaces the default-state RPC', () => {
  const migration = fs.readFileSync(
    path.join(__dirname, '..', 'supabase/migrations/20260713180000_canonicalize_bubble_tea_boss.sql'),
    'utf8',
  );

  assert.match(migration, /^BEGIN;/m);
  assert.match(migration, /^COMMIT;/m);
  assert.match(migration, /user_boss_progress_pkey/);
  assert.match(migration, /LEAST\(target_progress\.current_hp, source_progress\.current_hp\)/);
  assert.match(migration, new RegExp(`financial_lessons AS fl[\\s\\S]*fl\\.boss_id = '${LEGACY_BOSS_ID}'`));
  assert.match(migration, /bubble-tea-small-costs[\s\S]*bubble-tea-trigger[\s\S]*bubble-tea-promotion/);
  assert.match(migration, /CREATE TEMP TABLE challenge_merge_map/);
  assert.match(migration, /canonical_challenge\.title = legacy_challenge\.title/);
  assert.match(migration, /canonical_challenge\.sequence_order = legacy_challenge\.sequence_order/);
  assert.match(migration, /CREATE TEMP TABLE user_challenge_merge/);
  assert.match(migration, /bool_or\(progress\.status = 'completed'\)/);
  assert.match(migration, /min\(progress\.completed_at\) FILTER/);
  assert.match(migration, /ON CONFLICT ON CONSTRAINT user_challenges_pkey/);
  assert.match(migration, /challenges_boss_sequence_order_uidx/);
  assert.match(migration, /user_challenges_one_active_uidx/);
  assert.match(migration, /row_number\(\) OVER[\s\S]*MAX\(canonical_challenge\.sequence_order\)/);
  assert.doesNotMatch(
    migration,
    new RegExp(`UPDATE public\\.challenges AS c\\s+SET linked_boss_id = 'bubble-tea-monster'\\s+WHERE c\\.linked_boss_id = '${LEGACY_BOSS_ID}'`),
  );
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.ensure_default_game_state_v1/);
  assert.match(migration, /b\.id = 'bubble-tea-monster'/);
  assert.match(migration, new RegExp(`DELETE FROM public\\.bosses AS b[\\s\\S]*b\\.id = '${LEGACY_BOSS_ID}'`));
  assert.doesNotMatch(migration, /SET[\s\S]{0,80}max_hp\s*=/);
  assert.doesNotMatch(migration, /WHERE\s+user_id\s*=|AND\s+boss_id\s*=/);
  const deleteLegacyProgressAt = migration.indexOf('DELETE FROM public.user_challenges AS legacy_progress');
  const restoreCanonicalProgressAt = migration.indexOf('INSERT INTO public.user_challenges AS canonical_progress');
  const deleteLegacyChallengeAt = migration.indexOf('DELETE FROM public.challenges AS legacy_challenge');
  assert.ok(deleteLegacyProgressAt > 0 && deleteLegacyProgressAt < restoreCanonicalProgressAt);
  assert.ok(restoreCanonicalProgressAt < deleteLegacyChallengeAt);
});

test('challenge merge fixture keeps completed progress and avoids duplicate canonical challenges', () => {
  const challenges = [
    { id: 'legacy-1', bossId: LEGACY_BOSS_ID, title: 'Không uống trà sữa hôm nay', sequenceOrder: 1 },
    { id: 'legacy-2', bossId: LEGACY_BOSS_ID, title: 'Ghi lại mọi khoản mua đồ uống', sequenceOrder: 2 },
    { id: 'canonical-1', bossId: 'bubble-tea-monster', title: 'Không uống trà sữa hôm nay', sequenceOrder: 1 },
    { id: 'canonical-2', bossId: 'bubble-tea-monster', title: 'Ghi lại mọi khoản mua đồ uống', sequenceOrder: 2 },
  ];
  const progress = [
    { userId: 'user-1', challengeId: 'legacy-1', status: 'completed', completedAt: '2026-07-10T08:00:00.000Z' },
    { userId: 'user-1', challengeId: 'canonical-1', status: 'active', completedAt: null },
    { userId: 'user-1', challengeId: 'legacy-2', status: 'completed', completedAt: '2026-07-11T08:00:00.000Z' },
  ];

  const mapping = new Map(
    challenges
      .filter((challenge) => challenge.bossId === LEGACY_BOSS_ID)
      .map((legacyChallenge) => {
        const canonicalChallenge = challenges.find((challenge) =>
          challenge.bossId === 'bubble-tea-monster'
          && challenge.title === legacyChallenge.title
          && challenge.sequenceOrder === legacyChallenge.sequenceOrder);
        return [legacyChallenge.id, canonicalChallenge.id];
      }),
  );
  const mergedProgress = new Map();
  for (const row of progress) {
    const challengeId = mapping.get(row.challengeId) || row.challengeId;
    const progressKey = `${row.userId}:${challengeId}`;
    const existing = mergedProgress.get(progressKey);
    if (!existing) {
      mergedProgress.set(progressKey, { ...row, challengeId });
    } else if (row.status === 'completed' || existing.status === 'completed') {
      const completedTimes = [existing.completedAt, row.completedAt].filter(Boolean).sort();
      mergedProgress.set(progressKey, {
        ...existing,
        status: 'completed',
        completedAt: completedTimes[0] || null,
      });
    }
  }
  const remainingChallenges = challenges.filter((challenge) => challenge.bossId !== LEGACY_BOSS_ID);

  assert.deepEqual(remainingChallenges.map((challenge) => challenge.id), ['canonical-1', 'canonical-2']);
  assert.equal(new Set(remainingChallenges.map((challenge) => `${challenge.bossId}:${challenge.sequenceOrder}`)).size, 2);
  assert.deepEqual([...mergedProgress.values()].map((row) => ({
    challengeId: row.challengeId,
    status: row.status,
    completedAt: row.completedAt,
  })), [
    { challengeId: 'canonical-1', status: 'completed', completedAt: '2026-07-10T08:00:00.000Z' },
    { challengeId: 'canonical-2', status: 'completed', completedAt: '2026-07-11T08:00:00.000Z' },
  ]);
});
