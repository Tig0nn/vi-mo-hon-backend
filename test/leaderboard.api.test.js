const assert = require('node:assert/strict');
const test = require('node:test');

process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = '';

const app = require('../app');
const leaderboardRepository = require('../src/repositories/leaderboard.repository');
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
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  return { response, body: await response.json() };
};

let fakeClient;

test.beforeEach(() => {
  fakeClient = createFakeSupabaseClient();
  [leaderboardRepository, profileRepository].forEach((repo) => {
    repo.setSupabaseClientForTest(fakeClient);
  });

  // Seed multiple test users with varying discipline points and streak days
  const users = [
    { id: 'user-low', name: 'Bé Tập Sự', discipline: 30, streak: 2, xp: 50 },
    { id: 'user-mid', name: 'Chiến Binh Tuấn', discipline: 120, streak: 8, xp: 200 },
    { id: 'user-high', name: 'Cao Thủ Lan', discipline: 350, streak: 5, xp: 600 },
    { id: 'user-streak-master', name: 'Huyền Thoại Kiên Trì', discipline: 80, streak: 35, xp: 300 },
  ];

  users.forEach((u) => {
    fakeClient.state.profiles.set(u.id, {
      user_id: u.id,
      display_name: u.name,
      monthly_budget: 3000000,
      main_goal: 'save_money',
    });
    fakeClient.state.userProgress.set(u.id, {
      user_id: u.id,
      xp: u.xp,
      level: Math.floor(u.xp / 100) + 1,
      discipline: u.discipline,
      streak: u.streak,
      current_streak: u.streak,
      savings: 50,
      knowledge: 20,
    });
  });
});

test.afterEach(() => {
  [leaderboardRepository, profileRepository].forEach((repo) => {
    repo.clearSupabaseClientForTest();
  });
});

test('GET /api/leaderboard defaults to discipline ranking sorted descending', async () => {
  const server = await startServer();
  try {
    const { response, body } = await requestJson(server.baseUrl, '/api/leaderboard');
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.type, 'discipline');
    assert.equal(body.data.leaderboard.length, 4);

    // Rank 1: Cao Thủ Lan with 350 discipline points
    const top1 = body.data.leaderboard[0];
    assert.equal(top1.rank, 1);
    assert.equal(top1.displayName, 'Cao Thủ Lan');
    assert.equal(top1.discipline, 350);
    assert.equal(top1.title, 'Bậc Thầy Kỷ Luật');

    // Rank 2: Chiến Binh Tuấn with 120 discipline points
    const top2 = body.data.leaderboard[1];
    assert.equal(top2.rank, 2);
    assert.equal(top2.displayName, 'Chiến Binh Tuấn');
    assert.equal(top2.title, 'Chiến Binh Kỷ Luật');

    // Rank 4: Bé Tập Sự with 30 discipline points
    const top4 = body.data.leaderboard[3];
    assert.equal(top4.rank, 4);
    assert.equal(top4.title, 'Tập Sự Kiềm Chế');
  } finally {
    await server.close();
  }
});

test('GET /api/leaderboard?type=streak ranks by streak days with honorary titles', async () => {
  const server = await startServer();
  try {
    const { response, body } = await requestJson(server.baseUrl, '/api/leaderboard?type=streak');
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.type, 'streak');

    // Rank 1: Huyền Thoại Kiên Trì with 35 streak days
    const top1 = body.data.leaderboard[0];
    assert.equal(top1.rank, 1);
    assert.equal(top1.displayName, 'Huyền Thoại Kiên Trì');
    assert.equal(top1.streak, 35);
    assert.equal(top1.title, 'Huyền Thoại Kiên Trì');

    // Rank 2: Chiến Binh Tuấn with 8 streak days
    const top2 = body.data.leaderboard[1];
    assert.equal(top2.rank, 2);
    assert.equal(top2.displayName, 'Chiến Binh Tuấn');
    assert.equal(top2.streak, 8);
    assert.equal(top2.title, 'Chiến Binh 1 Tuần');
  } finally {
    await server.close();
  }
});

test('GET /api/leaderboard with userId marks currentUser and returns position card', async () => {
  const server = await startServer();
  try {
    const { response, body } = await requestJson(server.baseUrl, '/api/leaderboard?type=discipline&userId=user-mid');
    assert.equal(response.status, 200);
    assert.ok(body.data.currentUser);
    assert.equal(body.data.currentUser.userId, 'user-mid');
    assert.equal(body.data.currentUser.rank, 2);
    assert.equal(body.data.currentUser.score, 120);

    const match = body.data.leaderboard.find((u) => u.userId === 'user-mid');
    assert.equal(match.isCurrentUser, true);
  } finally {
    await server.close();
  }
});

test('GET /api/leaderboard rejects money or savings ranking parameters (Ethical & Safety Rule)', async () => {
  const server = await startServer();
  try {
    const resMoney = await requestJson(server.baseUrl, '/api/leaderboard?type=money');
    assert.equal(resMoney.response.status, 422);
    assert.equal(resMoney.body.success, false);
    assert.match(resMoney.body.message, /Validation failed/);

    const resSavings = await requestJson(server.baseUrl, '/api/leaderboard?type=savings');
    assert.equal(resSavings.response.status, 422);
    assert.equal(resSavings.body.success, false);
  } finally {
    await server.close();
  }
});
