const assert = require('node:assert/strict');
const test = require('node:test');

process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = '';
process.env.GEMINI_MODEL = '';

const profileRepository = require('../src/repositories/profile.repository');
const app = require('../app');

const createFakeSupabaseClient = () => {
  const state = {
    profiles: new Map(),
    userProgress: new Map(),
  };

  const now = () => new Date().toISOString();
  const clone = (value) => JSON.parse(JSON.stringify(value));

  const createBuilder = (table) => {
    const builder = {
      filter: {},
      operation: null,
      payload: null,
      select() {
        return this;
      },
      eq(column, value) {
        this.filter[column] = value;
        return this;
      },
      upsert(payload) {
        if (table === 'user_progress') {
          if (!state.userProgress.has(payload.user_id)) {
            state.userProgress.set(payload.user_id, clone(payload));
          }

          return Promise.resolve({ data: null, error: null });
        }

        this.operation = 'upsert';
        this.payload = payload;
        return this;
      },
      update(payload) {
        this.operation = 'update';
        this.payload = payload;
        return this;
      },
      async maybeSingle() {
        if (table === 'user_progress') {
          const progress = state.userProgress.get(this.filter.user_id);
          return { data: progress ? clone(progress) : null, error: null };
        }

        if (table !== 'profiles') {
          return { data: null, error: null };
        }

        const userId = this.filter.user_id;

        if (this.operation === 'update') {
          const existing = state.profiles.get(userId);
          if (!existing) {
            return { data: null, error: null };
          }

          const updated = { ...existing, ...this.payload };
          state.profiles.set(userId, updated);
          return { data: clone(updated), error: null };
        }

        const profile = state.profiles.get(userId);
        return { data: profile ? clone(profile) : null, error: null };
      },
      async single() {
        if (table !== 'profiles' || this.operation !== 'upsert') {
          return { data: null, error: null };
        }

        const existing = state.profiles.get(this.payload.user_id);
        const timestamp = now();
        const profile = {
          id: existing ? existing.id : `profile-${state.profiles.size + 1}`,
          created_at: existing ? existing.created_at : timestamp,
          currency: 'VND',
          triggers: [],
          preferred_tone: 'funny',
          ...existing,
          ...this.payload,
          updated_at: this.payload.updated_at || timestamp,
        };

        state.profiles.set(profile.user_id, profile);
        return { data: clone(profile), error: null };
      },
    };

    return builder;
  };

  return {
    state,
    from(table) {
      return createBuilder(table);
    },
  };
};

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

let fakeSupabaseClient;

test.beforeEach(() => {
  const { resetMockData } = require('../src/data/mockStore');
  resetMockData();
  fakeSupabaseClient = createFakeSupabaseClient();
  profileRepository.setSupabaseClientForTest(fakeSupabaseClient);
});

test.afterEach(() => {
  profileRepository.clearSupabaseClientForTest();
  fakeSupabaseClient = null;
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

test('profile endpoints create, read, and partially update a Supabase-backed profile', async () => {
  const server = await startServer();

  try {
    const create = await requestJson(server.baseUrl, '/api/profile', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'mock-user',
        displayName: 'Minh',
        monthlyBudget: 3000000,
        currency: 'VND',
        mainGoal: 'Tiết kiệm 20 triệu',
        triggers: ['trà sữa', 'flash sale', 'shopee'],
        preferredTone: 'funny',
      }),
    });

    assert.equal(create.response.status, 201);
    assert.equal(create.body.success, true);
    assert.equal(create.body.data.userId, 'mock-user');
    assert.equal(create.body.data.level, 1);
    assert.equal(create.body.data.xp, 0);
    assert.equal(create.body.data.mainGoal, 'Tiết kiệm 20 triệu');
    assert.deepEqual(create.body.data.triggers, ['trà sữa', 'flash sale', 'shopee']);
    assert.equal(create.body.data.preferredTone, 'funny');

    const read = await requestJson(server.baseUrl, '/api/profile/mock-user');
    assert.equal(read.response.status, 200);
    assert.equal(read.body.data.displayName, 'Minh');
    assert.equal(read.body.data.mainGoal, 'Tiết kiệm 20 triệu');
    assert.deepEqual(read.body.data.triggers, ['trà sữa', 'flash sale', 'shopee']);
    assert.equal(read.body.data.preferredTone, 'funny');

    const update = await requestJson(server.baseUrl, '/api/profile/mock-user', {
      method: 'PATCH',
      body: JSON.stringify({
        displayName: 'Minh Anh',
        monthlyBudget: 3500000,
        mainGoal: 'Mua laptop không nợ',
        triggers: ['stress', 'sale'],
        preferredTone: 'strict-but-kind',
      }),
    });

    assert.equal(update.response.status, 200);
    assert.equal(update.body.data.displayName, 'Minh Anh');
    assert.equal(update.body.data.monthlyBudget, 3500000);
    assert.equal(update.body.data.currency, 'VND');
    assert.equal(update.body.data.mainGoal, 'Mua laptop không nợ');
    assert.deepEqual(update.body.data.triggers, ['stress', 'sale']);
    assert.equal(update.body.data.preferredTone, 'strict-but-kind');
  } finally {
    await server.close();
  }
});

test('posting the same profile user updates profile fields without resetting user progress', async () => {
  const server = await startServer();

  try {
    const first = await requestJson(server.baseUrl, '/api/profile', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'mock-user',
        displayName: 'Minh',
        monthlyBudget: 3000000,
        currency: 'VND',
        mainGoal: 'Tiet kiem 20 trieu',
      }),
    });

    assert.equal(first.response.status, 201);
    fakeSupabaseClient.state.userProgress.set('mock-user', {
      user_id: 'mock-user',
      xp: 77,
      level: 3,
      discipline: 9,
      savings: 123000,
      knowledge: 4,
    });

    const second = await requestJson(server.baseUrl, '/api/profile', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'mock-user',
        displayName: 'Minh Updated',
        monthlyBudget: 3500000,
        currency: 'VND',
        mainGoal: 'Mua laptop khong no',
        preferredTone: 'gentle',
      }),
    });

    assert.equal(second.response.status, 201);
    assert.equal(second.body.data.displayName, 'Minh Updated');
    assert.equal(second.body.data.mainGoal, 'Mua laptop khong no');
    assert.deepEqual(fakeSupabaseClient.state.userProgress.get('mock-user'), {
      user_id: 'mock-user',
      xp: 77,
      level: 3,
      discipline: 9,
      savings: 123000,
      knowledge: 4,
    });
  } finally {
    await server.close();
  }
});

test('profile endpoint returns 404 for a missing user and 400 for invalid tone', async () => {
  const server = await startServer();

  try {
    const missing = await requestJson(server.baseUrl, '/api/profile/missing-user');
    assert.equal(missing.response.status, 404);
    assert.equal(missing.body.message, 'Profile not found');

    const invalidTone = await requestJson(server.baseUrl, '/api/profile', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'mock-user',
        displayName: 'Minh',
        monthlyBudget: 3000000,
        mainGoal: 'Tiet kiem 20 trieu',
        preferredTone: 'mean',
      }),
    });

    assert.equal(invalidTone.response.status, 400);
    assert.equal(invalidTone.body.success, false);
    assert.ok(invalidTone.body.errors);
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
        mainGoal: 'Tiết kiệm 20 triệu',
        triggers: ['trà sữa', 'flash sale', 'shopee'],
        preferredTone: 'funny',
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
        mainGoal: 'Tiết kiệm 20 triệu',
        triggers: ['trà sữa', 'flash sale', 'shopee'],
        preferredTone: 'funny',
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
    assert.equal(dashboard.body.data.profile.mainGoal, 'Tiết kiệm 20 triệu');
    assert.deepEqual(dashboard.body.data.profile.triggers, ['trà sữa', 'flash sale', 'shopee']);
    assert.equal(dashboard.body.data.profile.preferredTone, 'funny');
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
        mainGoal: 'Tiet kiem 20 trieu',
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
        mainGoal: 'Tiet kiem 20 trieu',
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

test('anti-regret coach falls back to a short Vietnamese rule-based response without Gemini', async () => {
  const server = await startServer();

  try {
    await requestJson(server.baseUrl, '/api/profile', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'mock-user',
        displayName: 'Minh',
        monthlyBudget: 3000000,
        currency: 'VND',
        mainGoal: 'Tiết kiệm 20 triệu',
        triggers: ['trà sữa', 'flash sale', 'shopee'],
        preferredTone: 'funny',
      }),
    });

    const coach = await requestJson(server.baseUrl, '/api/coach/anti-regret', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'mock-user',
        itemName: 'tai nghe mới',
        amount: 1200000,
        reason: 'Mình thấy flash sale nên hơi muốn chốt đơn',
      }),
    });

    assert.equal(coach.response.status, 200);
    assert.equal(coach.body.success, true);
    assert.equal(coach.body.message, 'Coach response generated');
    assert.deepEqual(Object.keys(coach.body.data).sort(), [
      'coachMessage',
      'detectedTrigger',
      'suggestedAction',
      'urgeId',
    ]);
    assert.match(coach.body.data.urgeId, /^urge_\d{3}$/);
    assert.equal(coach.body.data.detectedTrigger, 'flash_sale');
    assert.equal(coach.body.data.suggestedAction, 'WAIT_24_HOURS');
    assert.deepEqual(coach.body.debug, { provider: 'fallback' });
    assert.match(coach.body.data.coachMessage, /Tiết kiệm 20 triệu/);
    assert.match(coach.body.data.coachMessage, /tai nghe mới/);
    assert.ok(coach.body.data.coachMessage.length <= 180);
  } finally {
    await server.close();
  }
});

test('anti-regret coach can use a generated Gemini message with profile and spending context', async () => {
  const mockStore = require('../src/data/mockStore');
  const coachService = require('../src/services/coach.service');

  mockStore.createProfile({
    userId: 'mock-user',
    displayName: 'Minh',
    monthlyBudget: 3000000,
    currency: 'VND',
    mainGoal: 'Tiáº¿t kiá»‡m 20 triá»‡u',
    triggers: ['flash sale', 'stress'],
    preferredTone: 'funny',
  });
  mockStore.createExpense({
    userId: 'mock-user',
    amount: 55000,
    currency: 'VND',
    category: 'FOOD_DRINK',
  });

  const response = await coachService.createAntiRegretResponse(
    {
      userId: 'mock-user',
      itemName: 'tai nghe má»›i',
      amount: 1200000,
      reason: 'MÃ¬nh tháº¥y flash sale nÃªn hÆ¡i muá»‘n chá»‘t Ä‘Æ¡n',
    },
    {
      generateCoachMessage: async (context) => {
        assert.equal(context.mainGoal, 'Tiáº¿t kiá»‡m 20 triá»‡u');
        assert.deepEqual(context.triggers, ['flash sale', 'stress']);
        assert.equal(context.preferredTone, 'funny');
        assert.equal(context.itemName, 'tai nghe má»›i');
        assert.equal(context.amount, 1200000);
        assert.equal(context.detectedTrigger, 'flash_sale');
        assert.match(context.recentSpendingSummary, /FOOD_DRINK/);
        return 'Khoan chá»‘t Ä‘Æ¡n nha. So vá»›i goal cá»§a báº¡n trÆ°á»›c, rá»“i thá»­ tÃ¬m option nhá» hÆ¡n.';
      },
    }
  );

  assert.equal(response.coachMessage, 'Khoan chá»‘t Ä‘Æ¡n nha. So vá»›i goal cá»§a báº¡n trÆ°á»›c, rá»“i thá»­ tÃ¬m option nhá» hÆ¡n.');
  assert.equal(response.detectedTrigger, 'flash_sale');
  assert.equal(response.suggestedAction, 'WAIT_24_HOURS');
  assert.equal(response.providerUsed, 'gemini');

  const savedUrge = mockStore.findSpendingUrgeById(response.urgeId);
  assert.equal(savedUrge.coachMessage, response.coachMessage);
});

test('anti-regret coach preserves an explicit valid trigger and can expose Gemini debug in development', async () => {
  const geminiService = require('../src/services/gemini.service');
  const originalGenerate = geminiService.generateAntiRegretCoachMessage;
  geminiService.generateAntiRegretCoachMessage = async (context) => {
    assert.equal(context.detectedTrigger, 'flash_sale');
    return 'Pause nhe truoc da nha. So voi goal cua ban, thu option re hon roi quyet cung chua muon.';
  };

  const server = await startServer();

  try {
    await requestJson(server.baseUrl, '/api/profile', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'mock-user',
        displayName: 'Minh',
        monthlyBudget: 3000000,
        currency: 'VND',
        mainGoal: 'Tiet kiem 20 trieu',
        triggers: ['flash_sale'],
        preferredTone: 'funny',
      }),
    });

    const coach = await requestJson(server.baseUrl, '/api/coach/anti-regret', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'mock-user',
        itemName: 'ao khoac',
        amount: 450000,
        reason: 'minh dang phan van',
        trigger: 'flash_sale',
      }),
    });

    assert.equal(coach.response.status, 200);
    assert.equal(coach.body.data.detectedTrigger, 'flash_sale');
    assert.equal(coach.body.data.coachMessage, 'Pause nhe truoc da nha. So voi goal cua ban, thu option re hon roi quyet cung chua muon.');
    assert.deepEqual(coach.body.debug, { provider: 'gemini' });
  } finally {
    geminiService.generateAntiRegretCoachMessage = originalGenerate;
    await server.close();
  }
});

test('coach chat returns a validated Gemini reply, suggested questions, and retry debug metadata', async () => {
  const geminiService = require('../src/services/gemini.service');
  const originalGenerate = geminiService.generateCoachChatReply;
  geminiService.generateCoachChatReply = async (context) => {
    assert.equal(context.userMessage, 'Tôi muốn mua đồng hồ 1 triệu vì đang sale, có nên mua không?');
    assert.equal(context.mainGoal, 'Tiết kiệm 20 triệu');
    assert.deepEqual(context.triggers, ['trà sữa', 'flash sale', 'shopee']);
    assert.equal(context.preferredTone, 'funny');
    assert.equal(context.monthlyBudget, 3000000);
    assert.equal(context.monthlySpent, 55000);
    assert.match(context.recentSpendingSummary, /FOOD_DRINK/);
    return {
      reply: 'Đồng hồ 1 triệu là khoản không nhỏ, nhất là khi bạn đang có mục tiêu tiết kiệm rõ ràng. Nếu lý do chính là sale, hãy chờ 24 giờ rồi xem bạn còn muốn mua không. Nếu vẫn muốn mua, đặt trước một mức giá tối đa để tránh chốt vì cảm xúc.',
      suggestedQuestions: [
        'Nếu không mua món này thì tôi tiết kiệm được bao nhiêu?',
        'Có lựa chọn nào rẻ hơn không?',
        'Món này có thật sự cần trong tuần này không?',
      ],
      retryCount: 0,
    };
  };

  const server = await startServer();

  try {
    await requestJson(server.baseUrl, '/api/profile', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'mock-user',
        displayName: 'Minh',
        monthlyBudget: 3000000,
        currency: 'VND',
        mainGoal: 'Tiết kiệm 20 triệu',
        triggers: ['trà sữa', 'flash sale', 'shopee'],
        preferredTone: 'funny',
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

    const coach = await requestJson(server.baseUrl, '/api/coach/chat', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'mock-user',
        message: 'Tôi muốn mua đồng hồ 1 triệu vì đang sale, có nên mua không?',
      }),
    });

    assert.equal(coach.response.status, 200);
    assert.equal(coach.body.success, true);
    assert.equal(coach.body.message, 'Coach chat response generated');
    assert.match(coach.body.data.reply, /Đồng hồ 1 triệu/);
    assert.equal(coach.body.data.suggestedQuestions.length, 3);
    assert.ok(coach.body.data.suggestedQuestions.includes('Có lựa chọn nào rẻ hơn không?'));
    assert.deepEqual(coach.body.debug, { provider: 'gemini', retryCount: 0 });
  } finally {
    geminiService.generateCoachChatReply = originalGenerate;
    await server.close();
  }
});

test('coach chat returns an AI provider error instead of a fallback when Gemini fails', async () => {
  const geminiService = require('../src/services/gemini.service');
  const originalGenerate = geminiService.generateCoachChatReply;
  geminiService.generateCoachChatReply = async () => {
    const error = new Error('Coach đang hơi lag, thử lại sau nha.');
    error.status = 502;
    error.code = 'AI_PROVIDER_ERROR';
    error.debug = { provider: 'gemini' };
    throw error;
  };

  const server = await startServer();

  try {
    await requestJson(server.baseUrl, '/api/profile', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'mock-user',
        displayName: 'Minh',
        monthlyBudget: 3000000,
        currency: 'VND',
        mainGoal: 'Tiết kiệm 20 triệu',
      }),
    });

    const coach = await requestJson(server.baseUrl, '/api/coach/chat', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'mock-user',
        message: 'Làm sao tiết kiệm thêm 50.000đ?',
      }),
    });

    assert.equal(coach.response.status, 502);
    assert.equal(coach.body.success, false);
    assert.equal(coach.body.message, 'Coach đang hơi lag, thử lại sau nha.');
    assert.deepEqual(coach.body.error, { code: 'AI_PROVIDER_ERROR' });
    assert.deepEqual(coach.body.debug, { provider: 'gemini' });
  } finally {
    geminiService.generateCoachChatReply = originalGenerate;
    await server.close();
  }
});

test('coach chat returns an invalid response error instead of a fallback when Gemini output is unusable', async () => {
  const geminiService = require('../src/services/gemini.service');
  const originalGenerate = geminiService.generateCoachChatReply;
  geminiService.generateCoachChatReply = async () => {
    const error = new Error('Coach chưa trả lời ổn định, thử lại nha.');
    error.status = 502;
    error.code = 'AI_RESPONSE_INVALID';
    error.debug = {
      provider: 'gemini',
      retryCount: 1,
      reason: 'invalid_short_reply',
    };
    throw error;
  };

  const server = await startServer();

  try {
    await requestJson(server.baseUrl, '/api/profile', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'mock-user',
        displayName: 'Minh',
        monthlyBudget: 3000000,
        currency: 'VND',
        mainGoal: 'Tiết kiệm 20 triệu',
      }),
    });

    const coach = await requestJson(server.baseUrl, '/api/coach/chat', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'mock-user',
        message: 'Tôi muốn mua đồng hồ 1 triệu vì đang sale, có nên mua không?',
      }),
    });

    assert.equal(coach.response.status, 502);
    assert.equal(coach.body.success, false);
    assert.equal(coach.body.message, 'Coach chưa trả lời ổn định, thử lại nha.');
    assert.deepEqual(coach.body.error, { code: 'AI_RESPONSE_INVALID' });
    assert.deepEqual(coach.body.debug, {
      provider: 'gemini',
      retryCount: 1,
      reason: 'invalid_short_reply',
    });
  } finally {
    geminiService.generateCoachChatReply = originalGenerate;
    await server.close();
  }
});

test('anti-regret coach validates requests and requires an existing mock profile', async () => {
  const server = await startServer();

  try {
    const invalidCoachRequest = await requestJson(server.baseUrl, '/api/coach/anti-regret', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'mock-user',
        amount: -1,
      }),
    });

    assert.equal(invalidCoachRequest.response.status, 422);
    assert.equal(invalidCoachRequest.body.success, false);
    assert.ok(invalidCoachRequest.body.errors);

    const missingProfile = await requestJson(server.baseUrl, '/api/coach/anti-regret', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'mock-user',
        itemName: 'áo khoác',
        amount: 450000,
        reason: 'Bạn bè rủ mua cùng',
      }),
    });

    assert.equal(missingProfile.response.status, 404);
    assert.equal(missingProfile.body.success, false);
    assert.equal(missingProfile.body.message, 'Profile not found');
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

    assert.equal(invalidProfile.response.status, 400);
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
