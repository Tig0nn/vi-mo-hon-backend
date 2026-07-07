const assert = require('node:assert/strict');
const test = require('node:test');

process.env.NODE_ENV = 'test';

const app = require('../app');

const startServer = () =>
  new Promise((resolve) => {
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
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const body = await response.json();
  return { response, body };
};

test.beforeEach(() => {
  const { resetMockData } = require('../src/data/mockStore');
  resetMockData();
});

test('health check and not found responses use the shared API response shape', async () => {
  const server = await startServer();

  try {
    const health = await requestJson(server.baseUrl, '/api/health');
    assert.equal(health.response.status, 200);
    assert.equal(health.body.success, true);
    assert.equal(health.body.message, 'Server is healthy');
    assert.equal(health.body.data.status, 'ok');

    const missing = await requestJson(server.baseUrl, '/api/unknown');
    assert.equal(missing.response.status, 404);
    assert.deepEqual(missing.body, {
      success: false,
      message: 'Resource not found',
    });
  } finally {
    await server.close();
  }
});

test('profile endpoints create, read, and partially update a mock profile', async () => {
  const server = await startServer();

  try {
    const create = await requestJson(server.baseUrl, '/api/profile', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'mock-user',
        displayName: 'Minh',
        monthlyBudget: 3000000,
        currency: 'VND',
      }),
    });

    assert.equal(create.response.status, 201);
    assert.equal(create.body.success, true);
    assert.equal(create.body.data.userId, 'mock-user');
    assert.equal(create.body.data.level, 1);
    assert.equal(create.body.data.xp, 0);

    const read = await requestJson(server.baseUrl, '/api/profile/mock-user');
    assert.equal(read.response.status, 200);
    assert.equal(read.body.data.displayName, 'Minh');

    const update = await requestJson(server.baseUrl, '/api/profile/mock-user', {
      method: 'PATCH',
      body: JSON.stringify({ displayName: 'Minh Anh', monthlyBudget: 3500000 }),
    });

    assert.equal(update.response.status, 200);
    assert.equal(update.body.data.displayName, 'Minh Anh');
    assert.equal(update.body.data.monthlyBudget, 3500000);
    assert.equal(update.body.data.currency, 'VND');
  } finally {
    await server.close();
  }
});

test('quick expense input records an expense and updates XP progression', async () => {
  const server = await startServer();

  try {
    await requestJson(server.baseUrl, '/api/profile', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'mock-user',
        displayName: 'Minh',
        monthlyBudget: 3000000,
        currency: 'VND',
      }),
    });

    const createdExpense = await requestJson(server.baseUrl, '/api/expenses/quick-input', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'mock-user',
        text: 'tra sua 55000',
        category: 'FOOD_DRINK',
      }),
    });

    assert.equal(createdExpense.response.status, 201);
    assert.equal(createdExpense.body.data.expense.amount, 55000);
    assert.equal(createdExpense.body.data.progression.xpGained, 5);
    assert.equal(createdExpense.body.data.progression.totalXp, 5);
    assert.equal(createdExpense.body.data.progression.level, 1);

    const list = await requestJson(server.baseUrl, '/api/expenses?userId=mock-user&page=1&pageSize=20');
    assert.equal(list.response.status, 200);
    assert.equal(list.body.data.items.length, 1);
    assert.equal(list.body.data.pagination.totalItems, 1);
  } finally {
    await server.close();
  }
});

test('dashboard returns profile, recent expenses, XP, and initial boss state', async () => {
  const server = await startServer();

  try {
    await requestJson(server.baseUrl, '/api/profile', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'mock-user',
        displayName: 'Minh',
        monthlyBudget: 3000000,
        currency: 'VND',
      }),
    });

    await requestJson(server.baseUrl, '/api/expenses/quick-input', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'mock-user',
        amount: 55000,
        category: 'FOOD_DRINK',
      }),
    });

    const dashboard = await requestJson(server.baseUrl, '/api/dashboard/mock-user');

    assert.equal(dashboard.response.status, 200);
    assert.equal(dashboard.body.data.profile.userId, 'mock-user');
    assert.equal(dashboard.body.data.profile.xp, 5);
    assert.equal(dashboard.body.data.profile.monthlySpent, 55000);
    assert.equal(dashboard.body.data.boss.currentHp, 100);
    assert.equal(dashboard.body.data.boss.maxHp, 100);
    assert.equal(dashboard.body.data.recentExpenses.length, 1);
    assert.equal(dashboard.body.data.activeChallenges.length, 1);
    assert.equal(dashboard.body.data.activeChallenges[0].id, 'challenge-1');
  } finally {
    await server.close();
  }
});

test('challenge completion rewards XP, discipline, boss damage, and updates dashboard', async () => {
  const server = await startServer();

  try {
    await requestJson(server.baseUrl, '/api/profile', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'mock-user',
        displayName: 'Minh',
        monthlyBudget: 3000000,
        currency: 'VND',
      }),
    });

    const challenges = await requestJson(server.baseUrl, '/api/challenges?userId=mock-user');
    assert.equal(challenges.response.status, 200);
    assert.equal(challenges.body.data.items.length, 1);
    assert.equal(challenges.body.data.items[0].id, 'challenge-1');
    assert.equal(challenges.body.data.items[0].rewardXp, 30);
    assert.equal(challenges.body.data.items[0].bossDamage, 20);
    assert.equal(challenges.body.data.items[0].status, 'active');

    const completion = await requestJson(server.baseUrl, '/api/challenges/challenge-1/complete', {
      method: 'POST',
      body: JSON.stringify({ userId: 'mock-user' }),
    });

    assert.equal(completion.response.status, 200);
    assert.equal(completion.body.data.challenge.id, 'challenge-1');
    assert.equal(completion.body.data.challenge.status, 'completed');
    assert.equal(completion.body.data.progression.xpGained, 30);
    assert.equal(completion.body.data.progression.totalXp, 30);
    assert.equal(completion.body.data.progression.disciplineGained, 5);
    assert.equal(completion.body.data.progression.discipline, 5);
    assert.equal(completion.body.data.boss.currentHp, 80);
    assert.equal(completion.body.data.boss.maxHp, 100);

    const dashboard = await requestJson(server.baseUrl, '/api/dashboard/mock-user');
    assert.equal(dashboard.response.status, 200);
    assert.equal(dashboard.body.data.profile.xp, 30);
    assert.equal(dashboard.body.data.profile.discipline, 5);
    assert.equal(dashboard.body.data.boss.currentHp, 80);
    assert.deepEqual(dashboard.body.data.activeChallenges, []);
  } finally {
    await server.close();
  }
});

test('challenge completion cannot damage boss below zero or complete twice', async () => {
  const server = await startServer();

  try {
    await requestJson(server.baseUrl, '/api/profile', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'mock-user',
        displayName: 'Minh',
        monthlyBudget: 3000000,
        currency: 'VND',
      }),
    });

    const first = await requestJson(server.baseUrl, '/api/challenges/challenge-1/complete', {
      method: 'POST',
      body: JSON.stringify({ userId: 'mock-user' }),
    });
    assert.equal(first.response.status, 200);

    const second = await requestJson(server.baseUrl, '/api/challenges/challenge-1/complete', {
      method: 'POST',
      body: JSON.stringify({ userId: 'mock-user' }),
    });

    assert.equal(second.response.status, 409);
    assert.equal(second.body.success, false);
  } finally {
    await server.close();
  }
});

test('API validates bad profile and expense requests', async () => {
  const server = await startServer();

  try {
    const invalidProfile = await requestJson(server.baseUrl, '/api/profile', {
      method: 'POST',
      body: JSON.stringify({
        userId: '',
        displayName: '',
        monthlyBudget: -1,
      }),
    });

    assert.equal(invalidProfile.response.status, 422);
    assert.equal(invalidProfile.body.success, false);
    assert.ok(invalidProfile.body.errors);

    const invalidExpense = await requestJson(server.baseUrl, '/api/expenses/quick-input', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'mock-user',
      }),
    });

    assert.equal(invalidExpense.response.status, 422);
    assert.equal(invalidExpense.body.success, false);
    assert.ok(invalidExpense.body.errors);
  } finally {
    await server.close();
  }
});
