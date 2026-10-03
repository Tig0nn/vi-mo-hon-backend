const assert = require('node:assert/strict');
const test = require('node:test');

process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = '';

const app = require('../app');
const bossRepository = require('../src/repositories/boss.repository');
const gameRepository = require('../src/repositories/game.repository');
const profileRepository = require('../src/repositories/profile.repository');
const challengeRepository = require('../src/repositories/challenge.repository');
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
const userId = 'gamer-user';

test.beforeEach(() => {
  fakeClient = createFakeSupabaseClient();
  [profileRepository, bossRepository, gameRepository, challengeRepository].forEach((repo) => {
    repo.setSupabaseClientForTest(fakeClient);
  });
  gameRepository.clearFallbackSessionsForTest();

  // Seed user profile
  fakeClient.state.profiles.set(userId, {
    user_id: userId,
    display_name: 'Gamer GenZ',
    monthly_budget: 3000000,
    main_goal: 'save_money',
    target_amount: 1000000,
    is_premium: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  fakeClient.state.userProgress.set(userId, {
    user_id: userId,
    xp: 0,
    level: 1,
    discipline: 10,
    savings: 0,
    knowledge: 0,
    wealth: 10,
  });
  fakeClient.state.bosses.set('bubble-tea-monster', {
    id: 'bubble-tea-monster',
    name: 'Quái Vật Trà Sữa',
    max_hp: 100,
  });
  fakeClient.state.bossProgress.set(`${userId}:bubble-tea-monster`, {
    user_id: userId,
    boss_id: 'bubble-tea-monster',
    current_hp: 100,
    status: 'active',
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
});

test.afterEach(() => {
  [profileRepository, bossRepository, gameRepository, challengeRepository].forEach((repo) => {
    repo.clearSupabaseClientForTest();
  });
  gameRepository.clearFallbackSessionsForTest();
});

test('GET /api/game/tickets/:userId returns initial 3 daily tickets for free user', async () => {
  const server = await startServer();
  try {
    const { response, body } = await requestJson(server.baseUrl, `/api/game/tickets/${userId}`);
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.ticketsRemaining, 3);
    assert.equal(body.data.dailyMax, 3);
    assert.equal(body.data.usedToday, 0);
    assert.equal(body.data.isPremium, false);
  } finally {
    await server.close();
  }
});

test('GET /api/game/tickets/:userId returns 404 if profile does not exist', async () => {
  const server = await startServer();
  try {
    const { response, body } = await requestJson(server.baseUrl, '/api/game/tickets/non-existent-user');
    assert.equal(response.status, 404);
    assert.equal(body.success, false);
  } finally {
    await server.close();
  }
});

test('POST /api/game/start-session generates session token and returns target boss info', async () => {
  const server = await startServer();
  try {
    const { response, body } = await requestJson(server.baseUrl, '/api/game/start-session', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.sessionId);
    assert.ok(body.data.sessionToken);
    assert.equal(body.data.ticketsRemaining, 3);
    assert.equal(body.data.boss.bossId, 'bubble-tea-monster');
    assert.equal(body.data.boss.currentHp, 100);
  } finally {
    await server.close();
  }
});

test('POST /api/game/end-session enforces 10% boss HP cap and run cap of 20 HP', async () => {
  const server = await startServer();
  try {
    // Run 1: Attempt to deal 50 damage on a 100 max_hp boss.
    // 10% of 100 = 10 HP max total from runner.
    // Even though client sent 50 (run cap 20), boss 10% cap restricts it to 10 HP.
    const res1 = await requestJson(server.baseUrl, '/api/game/end-session', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        damageToBoss: 50,
        coins: 60, // Above 50 cap
        knowledgePoints: 25, // Above 20 cap
        durationSeconds: 45,
        obstaclesDodged: 12,
      }),
    });

    assert.equal(res1.response.status, 200);
    assert.equal(res1.body.success, true);
    assert.equal(res1.body.data.ticketsRemaining, 2);
    assert.equal(res1.body.data.pointsAwarded, 50, 'Savings should be capped at 50');
    assert.equal(res1.body.data.knowledgeAwarded, 20, 'Knowledge should be capped at 20');
    assert.equal(res1.body.data.bossDamageAwarded, 10, 'Boss damage capped at 10% of 100 HP = 10');
    assert.equal(res1.body.data.boss.currentHp, 90);
    assert.equal(res1.body.data.totalGameDamageOnBoss, 10);
    assert.equal(res1.body.data.maxGameDamageAllowed, 10);

    // Verify user progress persisted in state
    const prog = fakeClient.state.userProgress.get(userId);
    assert.equal(prog.savings, 50);
    assert.equal(prog.knowledge, 20);

    // Run 2: User plays another game, attempts to deal 20 damage.
    // Since 10 HP (the 10% cap) has already been dealt, damage awarded should be 0.
    const res2 = await requestJson(server.baseUrl, '/api/game/end-session', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        damageToBoss: 20,
        coins: 30,
        knowledgePoints: 10,
      }),
    });

    assert.equal(res2.response.status, 200);
    assert.equal(res2.body.data.ticketsRemaining, 1);
    assert.equal(res2.body.data.pointsAwarded, 30);
    assert.equal(res2.body.data.knowledgeAwarded, 10);
    assert.equal(res2.body.data.bossDamageAwarded, 0, 'Cannot exceed 10% boss cap');
    assert.equal(res2.body.data.boss.currentHp, 90, 'Boss HP should remain at 90');

    // Run 3: User plays 3rd game (last ticket)
    const res3 = await requestJson(server.baseUrl, '/api/game/end-session', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        damageToBoss: 10,
        coins: 10,
      }),
    });
    assert.equal(res3.response.status, 200);
    assert.equal(res3.body.data.ticketsRemaining, 0);

    // Run 4: 4th game should be rejected because daily tickets (3) are exhausted
    const res4 = await requestJson(server.baseUrl, '/api/game/end-session', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        damageToBoss: 10,
        coins: 10,
      }),
    });
    assert.equal(res4.response.status, 403);
    assert.match(res4.body.message, /hết vé chơi/);

    // Starting a new session when 0 tickets also returns 403
    const resStart = await requestJson(server.baseUrl, '/api/game/start-session', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    assert.equal(resStart.response.status, 403);
  } finally {
    await server.close();
  }
});

test('POST /api/game/end-session on larger boss (2000 HP) allows 20 HP per run up to 200 HP cap', async () => {
  const server = await startServer();
  try {
    // Configure boss with 2000 HP (10% cap = 200 HP)
    fakeClient.state.bosses.set('bubble-tea-monster', {
      id: 'bubble-tea-monster',
      name: 'Quái Vật Trà Sữa Khổng Lồ',
      max_hp: 2000,
    });
    fakeClient.state.bossProgress.set(`${userId}:bubble-tea-monster`, {
      user_id: userId,
      boss_id: 'bubble-tea-monster',
      current_hp: 2000,
      status: 'active',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const res = await requestJson(server.baseUrl, '/api/game/end-session', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        damageToBoss: 25, // Above 20 run cap
        coins: 40,
      }),
    });

    assert.equal(res.response.status, 200);
    assert.equal(res.body.data.bossDamageAwarded, 20, 'Clamped to 20 per run cap');
    assert.equal(res.body.data.boss.currentHp, 1980);
    assert.equal(res.body.data.maxGameDamageAllowed, 200);
  } finally {
    await server.close();
  }
});

test('POST /api/game/end-session defeats boss if HP reaches 0', async () => {
  const server = await startServer();
  try {
    // Boss has 5 HP left
    fakeClient.state.bossProgress.set(`${userId}:bubble-tea-monster`, {
      user_id: userId,
      boss_id: 'bubble-tea-monster',
      current_hp: 5,
      status: 'active',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const res = await requestJson(server.baseUrl, '/api/game/end-session', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        damageToBoss: 10,
      }),
    });

    assert.equal(res.response.status, 200);
    assert.equal(res.body.data.bossDamageAwarded, 5, 'Damage clamped to remaining HP');
    assert.equal(res.body.data.boss.currentHp, 0);
    assert.equal(res.body.data.boss.status, 'defeated');
  } finally {
    await server.close();
  }
});
