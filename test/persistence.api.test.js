const assert = require('node:assert/strict');
const test = require('node:test');

process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = '';

const app = require('../app');
const profileRepository = require('../src/repositories/profile.repository');
const expenseRepository = require('../src/repositories/expense.repository');
const challengeRepository = require('../src/repositories/challenge.repository');
const bossRepository = require('../src/repositories/boss.repository');
const { createFakeSupabaseClient } = require('./fakeSupabase');

const startServer = () => new Promise((resolve) => {
  const server = app.listen(0, () => {
    const { port } = server.address();
    resolve({ baseUrl: `http://127.0.0.1:${port}`, close: () => new Promise((done) => server.close(done)) });
  });
});
const requestJson = async (baseUrl, path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  return { response, body: await response.json() };
};
const onboarding = (overrides = {}) => ({
  userId: 'persisted-user', displayName: 'Minh', monthlyBudget: 3000000, mainGoal: 'save_money',
  targetAmount: 20000000, targetDate: '2027-01-01', triggers: ['flash_sale'], ...overrides,
});

let fakeClient;
test.beforeEach(() => {
  fakeClient = createFakeSupabaseClient();
  [profileRepository, expenseRepository, challengeRepository, bossRepository].forEach((repository) => repository.setSupabaseClientForTest(fakeClient));
});
test.afterEach(() => {
  [profileRepository, expenseRepository, challengeRepository, bossRepository].forEach((repository) => repository.clearSupabaseClientForTest());
});

test('expense listing uses persisted rows, newest-first ordering, and exact pagination totals', async () => {
  const server = await startServer();
  try {
    await requestJson(server.baseUrl, '/api/profile', { method: 'POST', body: JSON.stringify(onboarding()) });
    for (const [amount, occurredAt] of [[10000, '2026-07-01T08:00:00.000Z'], [20000, '2026-07-03T08:00:00.000Z'], [30000, '2026-07-02T08:00:00.000Z']]) {
      const recorded = await requestJson(server.baseUrl, '/api/expenses/quick-input', { method: 'POST', body: JSON.stringify({ userId: 'persisted-user', amount, occurredAt }) });
      assert.equal(recorded.response.status, 201);
    }
    const listed = await requestJson(server.baseUrl, '/api/expenses?userId=persisted-user&page=1&pageSize=2');
    assert.equal(listed.response.status, 200);
    assert.deepEqual(listed.body.data.items.map((item) => item.amount), [20000, 30000]);
    assert.deepEqual(listed.body.data.pagination, { page: 1, pageSize: 2, totalItems: 3, totalPages: 2 });
  } finally { await server.close(); }
});

test('boss lookup deterministically selects the earliest started active boss', async () => {
  await profileRepository.upsertProfile(onboarding());
  await challengeRepository.ensureDefaultGameState('persisted-user');
  fakeClient.state.bosses.set('earlier-boss', { id: 'earlier-boss', name: 'Earlier Boss', max_hp: 50 });
  fakeClient.state.bossProgress.set('persisted-user:earlier-boss', {
    user_id: 'persisted-user', boss_id: 'earlier-boss', current_hp: 50,
    status: 'active', started_at: '2020-01-01T00:00:00.000Z', updated_at: '2020-01-01T00:00:00.000Z',
  });

  const boss = await bossRepository.findBossState('persisted-user');
  assert.equal(boss.bossId, 'earlier-boss');
});

test('expense XP recalculates level and database failures are not reported as success', async () => {
  const server = await startServer();
  try {
    await requestJson(server.baseUrl, '/api/profile', { method: 'POST', body: JSON.stringify(onboarding()) });
    fakeClient.state.userProgress.get('persisted-user').xp = 95;
    const levelUp = await requestJson(server.baseUrl, '/api/expenses/quick-input', { method: 'POST', body: JSON.stringify({ userId: 'persisted-user', amount: 10000 }) });
    assert.equal(levelUp.body.data.progression.totalXp, 100);
    assert.equal(levelUp.body.data.progression.level, 2);
    const originalRpc = fakeClient.rpc;
    fakeClient.rpc = async (name, args) => name === 'record_expense_and_add_xp_v1' ? { data: null, error: { message: 'simulated failure', code: 'XX000' } } : originalRpc(name, args);
    const failed = await requestJson(server.baseUrl, '/api/expenses/quick-input', { method: 'POST', body: JSON.stringify({ userId: 'persisted-user', amount: 20000 }) });
    assert.equal(failed.response.status, 500);
    assert.equal(failed.body.message, 'Database error');
  } finally { await server.close(); }
});

test('concurrent completion grants rewards once, clamps boss HP, and dashboard has no reflections', async () => {
  const server = await startServer();
  try {
    await requestJson(server.baseUrl, '/api/profile', { method: 'POST', body: JSON.stringify(onboarding()) });
    fakeClient.state.bossProgress.get('persisted-user:bubble-tea-monster').current_hp = 10;
    const requests = await Promise.all([
      requestJson(server.baseUrl, '/api/challenges/challenge-1/complete', { method: 'POST', body: JSON.stringify({ userId: 'persisted-user' }) }),
      requestJson(server.baseUrl, '/api/challenges/challenge-1/complete', { method: 'POST', body: JSON.stringify({ userId: 'persisted-user' }) }),
    ]);
    assert.deepEqual(requests.map((result) => result.response.status).sort(), [200, 409]);
    assert.equal(fakeClient.state.userProgress.get('persisted-user').xp, 30);
    assert.equal(fakeClient.state.userProgress.get('persisted-user').discipline, 5);
    assert.equal(fakeClient.state.bossProgress.get('persisted-user:bubble-tea-monster').current_hp, 0);
    assert.equal(fakeClient.state.bossProgress.get('persisted-user:bubble-tea-monster').status, 'defeated');
    const dashboard = await requestJson(server.baseUrl, '/api/dashboard/persisted-user');
    assert.equal(dashboard.response.status, 200);
    assert.equal(Object.hasOwn(dashboard.body.data, 'recentReflections'), false);
    assert.deepEqual(dashboard.body.data.activeChallenges, []);
  } finally { await server.close(); }
});

test('reposting onboarding preserves persisted progress, completed challenge state, and boss HP', async () => {
  const server = await startServer();
  try {
    await requestJson(server.baseUrl, '/api/profile', { method: 'POST', body: JSON.stringify(onboarding()) });
    await requestJson(server.baseUrl, '/api/challenges/challenge-1/complete', { method: 'POST', body: JSON.stringify({ userId: 'persisted-user' }) });
    fakeClient.state.userProgress.get('persisted-user').savings = 100000;
    fakeClient.state.userProgress.get('persisted-user').knowledge = 7;
    const repeated = await requestJson(server.baseUrl, '/api/profile', { method: 'POST', body: JSON.stringify(onboarding({ displayName: 'Minh Anh' })) });
    assert.equal(repeated.response.status, 201);
    assert.deepEqual(fakeClient.state.userProgress.get('persisted-user'), { user_id: 'persisted-user', xp: 30, level: 1, discipline: 5, savings: 100000, knowledge: 7, wealth: 5 });
    assert.equal(fakeClient.state.userChallenges.get('persisted-user:challenge-1').status, 'completed');
    assert.equal(fakeClient.state.bossProgress.get('persisted-user:bubble-tea-monster').current_hp, 80);
  } finally { await server.close(); }
});

test('dashboard keeps activeChallenges compatibility and reports next-day availability after completion', async () => {
  const server = await startServer();
  try {
    await requestJson(server.baseUrl, '/api/profile', { method: 'POST', body: JSON.stringify(onboarding()) });
    await requestJson(server.baseUrl, '/api/challenges/challenge-1/complete', { method: 'POST', body: JSON.stringify({ userId: 'persisted-user' }) });

    const dashboard = await requestJson(server.baseUrl, '/api/dashboard/persisted-user');
    assert.equal(dashboard.response.status, 200);
    assert.deepEqual(dashboard.body.data.activeChallenges, []);
    assert.equal(dashboard.body.data.todayChallenge, null);
    assert.equal(dashboard.body.data.nextChallengeAvailableOn, '2026-07-14');
    assert.equal(dashboard.body.data.challengeMessage, 'Đã hoàn thành thử thách hôm nay');
    assert.equal(dashboard.body.data.boss.completedChallenges, 1);
    assert.equal(dashboard.body.data.boss.totalChallenges, 5);
  } finally { await server.close(); }
});

test('ordered challenges unlock on following days, persist while unfinished, and defeat the boss after the last one', async () => {
  const server = await startServer();
  try {
    await requestJson(server.baseUrl, '/api/profile', { method: 'POST', body: JSON.stringify(onboarding()) });

    const firstDashboard = await requestJson(server.baseUrl, '/api/dashboard/persisted-user');
    assert.equal(firstDashboard.body.data.todayChallenge.id, 'challenge-1');
    assert.equal(firstDashboard.body.data.todayChallenge.sequenceOrder, 1);
    assert.equal(firstDashboard.body.data.todayChallenge.totalChallenges, 5);
    assert.equal(firstDashboard.body.data.activeChallenges.length, 1);

    fakeClient.state.businessDate = '2026-07-14';
    const stillActive = await requestJson(server.baseUrl, '/api/challenges?userId=persisted-user');
    assert.deepEqual(stillActive.body.data.items.map((item) => item.id), ['challenge-1']);

    for (let sequence = 1; sequence <= 5; sequence += 1) {
      const completion = await requestJson(server.baseUrl, `/api/challenges/challenge-${sequence}/complete`, { method: 'POST', body: JSON.stringify({ userId: 'persisted-user' }) });
      assert.equal(completion.response.status, 200);
      assert.equal(completion.body.data.progression.xpGained, 30);
      assert.equal(completion.body.data.progression.disciplineGained, sequence === 5 ? 8 : 5);
      assert.equal(completion.body.data.boss.currentHp, 100 - (sequence * 20));

      const sameDay = await requestJson(server.baseUrl, '/api/challenges?userId=persisted-user');
      assert.deepEqual(sameDay.body.data.items, []);
      if (sequence < 5) {
        fakeClient.state.businessDate = `2026-07-${14 + sequence}`;
        const nextDay = await requestJson(server.baseUrl, '/api/challenges?userId=persisted-user');
        assert.deepEqual(nextDay.body.data.items.map((item) => item.id), [`challenge-${sequence + 1}`]);
        assert.equal(nextDay.body.data.items.length, 1);
      }
    }

    assert.equal(fakeClient.state.userProgress.get('persisted-user').xp, 150);
    assert.equal(fakeClient.state.userProgress.get('persisted-user').discipline, 28);
    assert.equal(fakeClient.state.bossProgress.get('persisted-user:bubble-tea-monster').current_hp, 0);
    const defeated = await requestJson(server.baseUrl, '/api/dashboard/persisted-user');
    assert.equal(defeated.body.data.boss.status, 'defeated');
    assert.equal(defeated.body.data.boss.completedChallenges, 5);
    assert.equal(defeated.body.data.boss.totalChallenges, 5);
    assert.equal(defeated.body.data.todayChallenge, null);
    assert.equal(defeated.body.data.challengeMessage, 'Bạn đã đánh bại boss này');
  } finally { await server.close(); }
});
