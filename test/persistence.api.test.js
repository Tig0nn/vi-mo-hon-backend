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
    fakeClient.state.bossProgress.get('persisted-user:impulse-boss').current_hp = 10;
    const requests = await Promise.all([
      requestJson(server.baseUrl, '/api/challenges/challenge-1/complete', { method: 'POST', body: JSON.stringify({ userId: 'persisted-user' }) }),
      requestJson(server.baseUrl, '/api/challenges/challenge-1/complete', { method: 'POST', body: JSON.stringify({ userId: 'persisted-user' }) }),
    ]);
    assert.deepEqual(requests.map((result) => result.response.status).sort(), [200, 409]);
    assert.equal(fakeClient.state.userProgress.get('persisted-user').xp, 30);
    assert.equal(fakeClient.state.userProgress.get('persisted-user').discipline, 5);
    assert.equal(fakeClient.state.bossProgress.get('persisted-user:impulse-boss').current_hp, 0);
    assert.equal(fakeClient.state.bossProgress.get('persisted-user:impulse-boss').status, 'defeated');
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
    assert.equal(fakeClient.state.bossProgress.get('persisted-user:impulse-boss').current_hp, 80);
  } finally { await server.close(); }
});
