const assert = require('node:assert/strict');
const test = require('node:test');

process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = '';

const app = require('../app');
const profileRepository = require('../src/repositories/profile.repository');
const gameRepository = require('../src/repositories/game.repository');
const bossRepository = require('../src/repositories/boss.repository');
const challengeRepository = require('../src/repositories/challenge.repository');
const expenseRepository = require('../src/repositories/expense.repository');
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
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  return { response, body: await response.json() };
};

let fakeClient;
const userId = 'premium-tester-user';

test.beforeEach(() => {
  fakeClient = createFakeSupabaseClient();
  [profileRepository, gameRepository, bossRepository, challengeRepository, expenseRepository].forEach((repo) => {
    repo.setSupabaseClientForTest(fakeClient);
  });
  gameRepository.clearFallbackSessionsForTest();

  // Seed default free user
  fakeClient.state.profiles.set(userId, {
    user_id: userId,
    display_name: 'Test GenZ',
    monthly_budget: 3000000,
    main_goal: 'save_money',
    target_amount: 1000000,
    is_premium: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  fakeClient.state.userProgress.set(userId, {
    user_id: userId,
    xp: 150,
    level: 2,
    discipline: 40,
    current_streak: 5,
    longest_streak: 10,
    last_checkin_date: new Date().toISOString().split('T')[0],
    freeze_streak_left: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
});

test('POST /api/profile/upgrade-premium validates userId', async () => {
  const { baseUrl, close } = await startServer();
  try {
    const { response, body } = await requestJson(baseUrl, '/api/profile/upgrade-premium', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    assert.equal(response.status, 400);
    assert.equal(body.message, 'Validation failed');
  } finally {
    await close();
  }
});

test('Free user gets 3 tickets/day, and cannot freeze streak', async () => {
  const { baseUrl, close } = await startServer();
  try {
    // 1. Check tickets as free user
    const ticketsRes = await requestJson(baseUrl, `/api/game/tickets/${userId}`);
    assert.equal(ticketsRes.response.status, 200);
    assert.equal(ticketsRes.body.data.dailyMax, 3);
    assert.equal(ticketsRes.body.data.isPremium, false);

    // 2. Try freeze streak as free user -> 403 Forbidden
    const freezeRes = await requestJson(baseUrl, '/api/profile/freeze-streak', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });

    assert.equal(freezeRes.response.status, 403);
    assert.match(freezeRes.body.message, /Premium/i);
  } finally {
    await close();
  }
});

test('Upgrade to Premium gives 5 tickets/day and 2 freeze streak uses', async () => {
  const { baseUrl, close } = await startServer();
  try {
    // 1. Upgrade to Premium
    const upgradeRes = await requestJson(baseUrl, '/api/profile/upgrade-premium', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });

    assert.equal(upgradeRes.response.status, 200);
    assert.equal(upgradeRes.body.data.isPremium, true);
    assert.equal(upgradeRes.body.data.freezeStreakLeft, 2);

    // 2. Tickets should now be 5/day
    const ticketsRes = await requestJson(baseUrl, `/api/game/tickets/${userId}`);
    assert.equal(ticketsRes.response.status, 200);
    assert.equal(ticketsRes.body.data.dailyMax, 5);
    assert.equal(ticketsRes.body.data.isPremium, true);

    // 3. Freeze streak 1st time
    const freeze1 = await requestJson(baseUrl, '/api/profile/freeze-streak', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    assert.equal(freeze1.response.status, 200);
    assert.equal(freeze1.body.data.freezeStreakLeft, 1);
    assert.equal(freeze1.body.data.streak, 5);

    // 4. Freeze streak 2nd time
    const freeze2 = await requestJson(baseUrl, '/api/profile/freeze-streak', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    assert.equal(freeze2.response.status, 200);
    assert.equal(freeze2.body.data.freezeStreakLeft, 0);

    // 5. Freeze streak 3rd time -> 400 (used up all freezes)
    const freeze3 = await requestJson(baseUrl, '/api/profile/freeze-streak', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    assert.equal(freeze3.response.status, 400);
    assert.match(freeze3.body.message, /hết số lượt/i);

    // 6. Verify Dashboard endpoint reflects premium and streak status
    const dashboardRes = await requestJson(baseUrl, `/api/dashboard/${userId}`);
    assert.equal(dashboardRes.response.status, 200);
    assert.equal(dashboardRes.body.data.profile.isPremium, true);
    assert.equal(dashboardRes.body.data.profile.freezeStreakLeft, 0);
    assert.equal(dashboardRes.body.data.profile.streak, 5);
  } finally {
    await close();
  }
});
