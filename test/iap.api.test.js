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
const userId = 'iap-test-user';

test.beforeEach(() => {
  fakeClient = createFakeSupabaseClient();
  [profileRepository, gameRepository, bossRepository, challengeRepository, expenseRepository].forEach((repo) => {
    repo.setSupabaseClientForTest(fakeClient);
  });

  fakeClient.state.profiles.set(userId, {
    user_id: userId,
    display_name: 'IAP GenZ Tester',
    monthly_budget: 3500000,
    main_goal: 'save_money',
    target_amount: 1500000,
    is_premium: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  fakeClient.state.userProgress.set(userId, {
    user_id: userId,
    xp: 200,
    level: 3,
    discipline: 50,
    current_streak: 7,
    longest_streak: 14,
    freeze_streak_left: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
});

test('POST /api/webhooks/verify-purchase activates premium for sandbox tester', async () => {
  const { baseUrl, close } = await startServer();
  try {
    // 1. Missing userId -> 400
    const failRes = await requestJson(baseUrl, '/api/webhooks/verify-purchase', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert.equal(failRes.response.status, 400);

    // 2. Invalid packageId -> 400
    const badPackage = await requestJson(baseUrl, '/api/webhooks/verify-purchase', {
      method: 'POST',
      body: JSON.stringify({ userId, packageId: 'fake_pkg_id' }),
    });
    assert.equal(badPackage.response.status, 400);

    // 3. Valid purchase -> 200 & upgrades
    const successRes = await requestJson(baseUrl, '/api/webhooks/verify-purchase', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        packageId: 'vmh_premium_monthly_29k',
        isSandbox: true,
      }),
    });

    assert.equal(successRes.response.status, 200);
    assert.equal(successRes.body.data.isPremium, true);
    assert.equal(successRes.body.data.freezeStreakLeft, 2);
    assert.equal(successRes.body.data.isSandbox, true);
  } finally {
    await close();
  }
});

test('POST /api/webhooks/revenuecat handles INITIAL_PURCHASE and EXPIRATION events', async () => {
  const { baseUrl, close } = await startServer();
  try {
    // 1. INITIAL_PURCHASE -> activates premium
    const purchaseWebhook = await requestJson(baseUrl, '/api/webhooks/revenuecat', {
      method: 'POST',
      body: JSON.stringify({
        event: {
          type: 'INITIAL_PURCHASE',
          app_user_id: userId,
          product_id: 'vmh_premium_monthly_29k',
        },
      }),
    });

    assert.equal(purchaseWebhook.response.status, 200);
    assert.equal(purchaseWebhook.body.data.outcome, 'premium_granted');

    // Verify profile state
    const profileAfterPurchase = await profileRepository.findProfileByUserId(userId);
    assert.equal(profileAfterPurchase.isPremium, true);
    assert.equal(profileAfterPurchase.freezeStreakLeft, 2);

    // 2. EXPIRATION -> revokes premium
    const expireWebhook = await requestJson(baseUrl, '/api/webhooks/revenuecat', {
      method: 'POST',
      body: JSON.stringify({
        event: {
          type: 'EXPIRATION',
          app_user_id: userId,
          product_id: 'vmh_premium_monthly_29k',
        },
      }),
    });

    assert.equal(expireWebhook.response.status, 200);
    assert.equal(expireWebhook.body.data.outcome, 'premium_revoked');

    // Verify profile state revoked
    const profileAfterExpire = await profileRepository.findProfileByUserId(userId);
    assert.equal(profileAfterExpire.isPremium, false);
  } finally {
    await close();
  }
});
