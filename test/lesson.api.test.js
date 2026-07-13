const assert = require('node:assert/strict');
const test = require('node:test');

process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = '';

const app = require('../app');
const bossRepository = require('../src/repositories/boss.repository');
const challengeRepository = require('../src/repositories/challenge.repository');
const expenseRepository = require('../src/repositories/expense.repository');
const lessonRepository = require('../src/repositories/lesson.repository');
const profileRepository = require('../src/repositories/profile.repository');
const { createFakeSupabaseClient } = require('./fakeSupabase');

const startServer = () => new Promise((resolve) => {
  const server = app.listen(0, () => {
    const { port } = server.address();
    resolve({
      baseUrl: `http://127.0.0.1:${port}`,
      close: () => new Promise((done) => server.close(done)),
    });
  });
});

const requestJson = async (baseUrl, path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  return { response, body: await response.json() };
};

const onboarding = (overrides = {}) => ({
  userId: 'lesson-user',
  displayName: 'Minh',
  monthlyBudget: 3000000,
  mainGoal: 'reduce_food_drink',
  targetAmount: 20000000,
  targetDate: '2027-01-01',
  triggers: ['food_craving'],
  ...overrides,
});

const repositories = [
  profileRepository,
  expenseRepository,
  challengeRepository,
  bossRepository,
  lessonRepository,
];

let fakeClient;
test.beforeEach(() => {
  fakeClient = createFakeSupabaseClient();
  repositories.forEach((repository) => repository.setSupabaseClientForTest(fakeClient));
});

test.afterEach(() => {
  repositories.forEach((repository) => repository.clearSupabaseClientForTest());
});

test('GET lessons returns three ordered public lessons without the correct answer', async () => {
  const server = await startServer();
  try {
    await requestJson(server.baseUrl, '/api/profile', {
      method: 'POST', body: JSON.stringify(onboarding()),
    });
    const result = await requestJson(
      server.baseUrl,
      '/api/lessons?userId=lesson-user&bossId=bubble-tea-monster',
    );

    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body.data.items.map((item) => item.id), [
      'bubble-tea-small-costs',
      'bubble-tea-trigger',
      'bubble-tea-promotion',
    ]);
    assert.deepEqual(result.body.data.items.map((item) => item.status), [
      'available', 'available', 'available',
    ]);
    assert.equal(JSON.stringify(result.body).includes('correct_answer_id'), false);
    assert.equal(JSON.stringify(result.body).includes('correctAnswerId'), false);
  } finally {
    await server.close();
  }
});

test('GET lessons validates required query fields and requires an existing profile', async () => {
  const server = await startServer();
  try {
    for (const path of [
      '/api/lessons?bossId=bubble-tea-monster',
      '/api/lessons?userId=lesson-user',
    ]) {
      const invalid = await requestJson(server.baseUrl, path);
      assert.equal(invalid.response.status, 422);
    }

    const missing = await requestJson(
      server.baseUrl,
      '/api/lessons?userId=missing-user&bossId=bubble-tea-monster',
    );
    assert.equal(missing.response.status, 404);
    assert.equal(missing.body.message, 'Profile not found');
  } finally {
    await server.close();
  }
});

test('POST lesson completion validates the lesson id and request body', async () => {
  const server = await startServer();
  try {
    for (const request of [
      {
        path: '/api/lessons/%20/complete',
        body: { userId: 'lesson-user', answerId: 'c' },
      },
      {
        path: '/api/lessons/bubble-tea-small-costs/complete',
        body: { userId: 'lesson-user' },
      },
      {
        path: '/api/lessons/bubble-tea-small-costs/complete',
        body: { answerId: 'c' },
      },
    ]) {
      const invalid = await requestJson(server.baseUrl, request.path, {
        method: 'POST', body: JSON.stringify(request.body),
      });
      assert.equal(invalid.response.status, 422);
    }
  } finally {
    await server.close();
  }
});

test('incorrect lesson answer returns explanation without changing XP or knowledge', async () => {
  const server = await startServer();
  try {
    await requestJson(server.baseUrl, '/api/profile', {
      method: 'POST', body: JSON.stringify(onboarding()),
    });
    const before = { ...fakeClient.state.userProgress.get('lesson-user') };
    const result = await requestJson(
      server.baseUrl,
      '/api/lessons/bubble-tea-small-costs/complete',
      { method: 'POST', body: JSON.stringify({ userId: 'lesson-user', answerId: 'a' }) },
    );

    assert.equal(result.response.status, 422);
    assert.deepEqual(result.body.errors, {
      code: 'LESSON_ANSWER_INCORRECT',
      explanation: '45.000 × 3 × 4 = 540.000đ.',
    });
    const after = fakeClient.state.userProgress.get('lesson-user');
    assert.equal(after.xp, before.xp);
    assert.equal(after.knowledge, before.knowledge);
  } finally {
    await server.close();
  }
});

test('correct lesson answer rewards once, recalculates level, and updates profile/dashboard knowledge', async () => {
  const server = await startServer();
  try {
    await requestJson(server.baseUrl, '/api/profile', {
      method: 'POST', body: JSON.stringify(onboarding()),
    });
    const progress = fakeClient.state.userProgress.get('lesson-user');
    progress.xp = 90;
    progress.knowledge = 3;
    progress.savings = 4;
    progress.discipline = 5;

    const completed = await requestJson(
      server.baseUrl,
      '/api/lessons/bubble-tea-small-costs/complete',
      { method: 'POST', body: JSON.stringify({ userId: 'lesson-user', answerId: 'c' }) },
    );
    assert.equal(completed.response.status, 200);
    assert.deepEqual(completed.body.data.progression, {
      xpGained: 20,
      knowledgeGained: 2,
      totalXp: 110,
      level: 2,
      knowledge: 5,
    });

    const repeated = await requestJson(
      server.baseUrl,
      '/api/lessons/bubble-tea-small-costs/complete',
      { method: 'POST', body: JSON.stringify({ userId: 'lesson-user', answerId: 'c' }) },
    );
    assert.equal(repeated.response.status, 409);
    assert.deepEqual(repeated.body.errors, { code: 'LESSON_ALREADY_COMPLETED' });
    assert.equal(fakeClient.state.userProgress.get('lesson-user').xp, 110);
    assert.equal(fakeClient.state.userProgress.get('lesson-user').knowledge, 5);

    const listed = await requestJson(
      server.baseUrl,
      '/api/lessons?userId=lesson-user&bossId=bubble-tea-monster',
    );
    assert.equal(listed.body.data.items[0].status, 'completed');

    const profile = await requestJson(server.baseUrl, '/api/profile/lesson-user');
    assert.equal(profile.body.data.knowledge, 5);
    assert.equal(profile.body.data.savings, 4);
    assert.equal(profile.body.data.wealth, 14);

    const dashboard = await requestJson(server.baseUrl, '/api/dashboard/lesson-user');
    assert.equal(dashboard.body.data.profile.knowledge, 5);
    assert.equal(dashboard.body.data.profile.wealth, 14);
  } finally {
    await server.close();
  }
});

test('concurrent duplicate lesson completion grants at most one reward', async () => {
  const server = await startServer();
  try {
    await requestJson(server.baseUrl, '/api/profile', {
      method: 'POST', body: JSON.stringify(onboarding()),
    });
    const requests = await Promise.all([
      requestJson(server.baseUrl, '/api/lessons/bubble-tea-trigger/complete', {
        method: 'POST', body: JSON.stringify({ userId: 'lesson-user', answerId: 'd' }),
      }),
      requestJson(server.baseUrl, '/api/lessons/bubble-tea-trigger/complete', {
        method: 'POST', body: JSON.stringify({ userId: 'lesson-user', answerId: 'd' }),
      }),
    ]);

    assert.deepEqual(requests.map((item) => item.response.status).sort(), [200, 409]);
    assert.equal(fakeClient.state.userProgress.get('lesson-user').xp, 20);
    assert.equal(fakeClient.state.userProgress.get('lesson-user').knowledge, 2);
  } finally {
    await server.close();
  }
});
