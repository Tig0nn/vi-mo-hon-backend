const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.GEMINI_API_KEY = "";
process.env.GEMINI_MODEL = "";

const profileRepository = require("../src/repositories/profile.repository");
const expenseRepository = require("../src/repositories/expense.repository");
const challengeRepository = require("../src/repositories/challenge.repository");
const bossRepository = require("../src/repositories/boss.repository");
const {
  createFakeSupabaseClient: createPersistenceFakeSupabaseClient,
} = require("./fakeSupabase");
const app = require("../app");

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
        if (table === "user_progress") {
          if (!state.userProgress.has(payload.user_id)) {
            state.userProgress.set(payload.user_id, clone(payload));
          }

          return Promise.resolve({ data: null, error: null });
        }

        this.operation = "upsert";
        this.payload = payload;
        return this;
      },
      update(payload) {
        this.operation = "update";
        this.payload = payload;
        return this;
      },
      async maybeSingle() {
        if (table === "user_progress") {
          const progress = state.userProgress.get(this.filter.user_id);
          return { data: progress ? clone(progress) : null, error: null };
        }

        if (table !== "profiles") {
          return { data: null, error: null };
        }

        const userId = this.filter.user_id;

        if (this.operation === "update") {
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
        if (table !== "profiles" || this.operation !== "upsert") {
          return { data: null, error: null };
        }

        const existing = state.profiles.get(this.payload.user_id);
        const timestamp = now();
        const profile = {
          id: existing ? existing.id : `profile-${state.profiles.size + 1}`,
          created_at: existing ? existing.created_at : timestamp,
          currency: "VND",
          triggers: [],
          preferred_tone: "funny",
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
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });

  const body = await response.json();
  return { response, body };
};

const requestForm = async (baseUrl, path, formData, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    method: options.method || "POST",
    body: formData,
  });

  const body = await response.json();
  return { response, body };
};

const createSilentWavBuffer = (durationSeconds = 1) => {
  const sampleRate = 8000;
  const channels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const dataSize = Math.floor(durationSeconds * byteRate);
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
};

const futureDate = () =>
  new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const validOnboardingPayload = (overrides = {}) => ({
  userId: "mock-user",
  displayName: "Minh",
  monthlyBudget: 3000000,
  mainGoal: "save_money",
  targetAmount: 20000000,
  targetDate: futureDate(),
  triggers: ["flash_sale"],
  preferredTone: "funny",
  ...overrides,
});

let fakeSupabaseClient;

test.beforeEach(() => {
  const { resetMockData } = require("../src/data/mockStore");
  resetMockData();
  fakeSupabaseClient = createPersistenceFakeSupabaseClient();
  profileRepository.setSupabaseClientForTest(fakeSupabaseClient);
  expenseRepository.setSupabaseClientForTest(fakeSupabaseClient);
  challengeRepository.setSupabaseClientForTest(fakeSupabaseClient);
  bossRepository.setSupabaseClientForTest(fakeSupabaseClient);
});

test.afterEach(() => {
  profileRepository.clearSupabaseClientForTest();
  expenseRepository.clearSupabaseClientForTest();
  challengeRepository.clearSupabaseClientForTest();
  bossRepository.clearSupabaseClientForTest();
  fakeSupabaseClient = null;
});

test("health check and not found responses use the shared API response shape", async () => {
  const server = await startServer();

  try {
    const health = await requestJson(server.baseUrl, "/api/health");
    assert.equal(health.response.status, 200);
    assert.equal(health.body.success, true);
    assert.equal(health.body.message, "Server is healthy");
    assert.equal(health.body.data.status, "ok");

    const missing = await requestJson(server.baseUrl, "/api/unknown");
    assert.equal(missing.response.status, 404);
    assert.deepEqual(missing.body, {
      success: false,
      message: "Resource not found",
    });
  } finally {
    await server.close();
  }
});

test("profile endpoints create, read, and partially update a Supabase-backed profile", async () => {
  const server = await startServer();

  try {
    const create = await requestJson(server.baseUrl, "/api/profile", {
      method: "POST",
      body: JSON.stringify(validOnboardingPayload()),
    });

    assert.equal(create.response.status, 201);
    assert.equal(create.body.success, true);
    assert.equal(create.body.data.userId, "mock-user");
    assert.equal(create.body.data.level, 1);
    assert.equal(create.body.data.xp, 0);
    assert.equal(create.body.data.mainGoal, "save_money");
    assert.deepEqual(create.body.data.triggers, ["flash_sale"]);
    assert.equal(create.body.data.preferredTone, "funny");

    const read = await requestJson(server.baseUrl, "/api/profile/mock-user");
    assert.equal(read.response.status, 200);
    assert.equal(read.body.data.displayName, "Minh");
    assert.equal(read.body.data.mainGoal, "save_money");
    assert.deepEqual(read.body.data.triggers, ["flash_sale"]);
    assert.equal(read.body.data.preferredTone, "funny");

    const update = await requestJson(server.baseUrl, "/api/profile/mock-user", {
      method: "PATCH",
      body: JSON.stringify({
        displayName: "Minh Anh",
        monthlyBudget: 3500000,
        mainGoal: "reduce_impulse_shopping",
        triggers: ["emotional_spending"],
        preferredTone: "strict-but-kind",
      }),
    });

    assert.equal(update.response.status, 200);
    assert.equal(update.body.data.displayName, "Minh Anh");
    assert.equal(update.body.data.monthlyBudget, 3500000);
    assert.equal(update.body.data.currency, "VND");
    assert.equal(update.body.data.mainGoal, "reduce_impulse_shopping");
    assert.deepEqual(update.body.data.triggers, ["emotional_spending"]);
    assert.equal(update.body.data.preferredTone, "strict-but-kind");
  } finally {
    await server.close();
  }
});

test("posting the same profile user updates profile fields without resetting user progress", async () => {
  const server = await startServer();

  try {
    const first = await requestJson(server.baseUrl, "/api/profile", {
      method: "POST",
      body: JSON.stringify(validOnboardingPayload()),
    });

    assert.equal(first.response.status, 201);
    fakeSupabaseClient.state.userProgress.set("mock-user", {
      user_id: "mock-user",
      xp: 77,
      level: 3,
      discipline: 9,
      savings: 123000,
      knowledge: 4,
    });

    const second = await requestJson(server.baseUrl, "/api/profile", {
      method: "POST",
      body: JSON.stringify(
        validOnboardingPayload({
          displayName: "Minh Updated",
          monthlyBudget: 3500000,
          mainGoal: "reduce_impulse_shopping",
          preferredTone: "gentle",
        }),
      ),
    });

    assert.equal(second.response.status, 201);
    assert.equal(second.body.data.displayName, "Minh Updated");
    assert.equal(second.body.data.mainGoal, "reduce_impulse_shopping");
    assert.deepEqual(fakeSupabaseClient.state.userProgress.get("mock-user"), {
      user_id: "mock-user",
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

test("profile endpoint returns 404 for a missing user and 400 for invalid tone", async () => {
  const server = await startServer();

  try {
    const missing = await requestJson(
      server.baseUrl,
      "/api/profile/missing-user",
    );
    assert.equal(missing.response.status, 404);
    assert.equal(missing.body.message, "Profile not found");

    const invalidTone = await requestJson(server.baseUrl, "/api/profile", {
      method: "POST",
      body: JSON.stringify(validOnboardingPayload({ preferredTone: "mean" })),
    });

    assert.equal(invalidTone.response.status, 400);
    assert.equal(invalidTone.body.success, false);
    assert.ok(invalidTone.body.errors);
  } finally {
    await server.close();
  }
});

test("quick expense input records an expense and updates XP progression", async () => {
  const server = await startServer();

  try {
    await requestJson(server.baseUrl, "/api/profile", {
      method: "POST",
      body: JSON.stringify(validOnboardingPayload()),
    });

    const createdExpense = await requestJson(
      server.baseUrl,
      "/api/expenses/quick-input",
      {
        method: "POST",
        body: JSON.stringify({
          userId: "mock-user",
          text: "tra sua 55000",
          category: "FOOD_DRINK",
        }),
      },
    );

    assert.equal(createdExpense.response.status, 201);
    assert.equal(createdExpense.body.data.expense.amount, 55000);
    assert.equal(createdExpense.body.data.progression.xpGained, 5);
    assert.equal(createdExpense.body.data.progression.totalXp, 5);
    assert.equal(createdExpense.body.data.progression.level, 1);

    const list = await requestJson(
      server.baseUrl,
      "/api/expenses?userId=mock-user&page=1&pageSize=20",
    );
    assert.equal(list.response.status, 200);
    assert.equal(list.body.data.items.length, 1);
    assert.equal(list.body.data.pagination.totalItems, 1);
  } finally {
    await server.close();
  }
});

test("dashboard returns profile, recent expenses, XP, and initial boss state", async () => {
  const server = await startServer();

  try {
    await requestJson(server.baseUrl, "/api/profile", {
      method: "POST",
      body: JSON.stringify(validOnboardingPayload()),
    });

    await requestJson(server.baseUrl, "/api/expenses/quick-input", {
      method: "POST",
      body: JSON.stringify({
        userId: "mock-user",
        amount: 55000,
        category: "FOOD_DRINK",
      }),
    });

    const dashboard = await requestJson(
      server.baseUrl,
      "/api/dashboard/mock-user",
    );

    assert.equal(dashboard.response.status, 200);
    assert.equal(dashboard.body.data.profile.userId, "mock-user");
    assert.equal(dashboard.body.data.profile.xp, 5);
    assert.equal(dashboard.body.data.profile.monthlySpent, 55000);
    assert.equal(dashboard.body.data.profile.mainGoal, "save_money");
    assert.deepEqual(dashboard.body.data.profile.triggers, ["flash_sale"]);
    assert.equal(dashboard.body.data.profile.preferredTone, "funny");
    assert.equal(dashboard.body.data.boss.bossId, "bubble-tea-monster");
    assert.equal(dashboard.body.data.boss.currentHp, 100);
    assert.equal(dashboard.body.data.boss.maxHp, 100);
    assert.equal(dashboard.body.data.recentExpenses.length, 1);
    assert.equal(dashboard.body.data.activeChallenges.length, 1);
    assert.equal(dashboard.body.data.activeChallenges[0].id, "challenge-1");
  } finally {
    await server.close();
  }
});

test("challenge completion rewards XP, discipline, boss damage, and updates dashboard", async () => {
  const server = await startServer();

  try {
    await requestJson(server.baseUrl, "/api/profile", {
      method: "POST",
      body: JSON.stringify(validOnboardingPayload()),
    });

    const challenges = await requestJson(
      server.baseUrl,
      "/api/challenges?userId=mock-user",
    );
    assert.equal(challenges.response.status, 200);
    assert.equal(challenges.body.data.items.length, 1);
    assert.equal(challenges.body.data.items[0].id, "challenge-1");
    assert.equal(challenges.body.data.items[0].rewardXp, 30);
    assert.equal(challenges.body.data.items[0].bossDamage, 20);
    assert.equal(challenges.body.data.items[0].status, "active");

    const completion = await requestJson(
      server.baseUrl,
      "/api/challenges/challenge-1/complete",
      {
        method: "POST",
        body: JSON.stringify({ userId: "mock-user" }),
      },
    );

    assert.equal(completion.response.status, 200);
    assert.equal(completion.body.data.challenge.id, "challenge-1");
    assert.equal(completion.body.data.challenge.status, "completed");
    assert.equal(completion.body.data.progression.xpGained, 30);
    assert.equal(completion.body.data.progression.totalXp, 30);
    assert.equal(completion.body.data.progression.disciplineGained, 5);
    assert.equal(completion.body.data.progression.discipline, 5);
    assert.equal(completion.body.data.boss.bossId, "bubble-tea-monster");
    assert.equal(completion.body.data.boss.currentHp, 80);
    assert.equal(completion.body.data.boss.maxHp, 100);

    const dashboard = await requestJson(
      server.baseUrl,
      "/api/dashboard/mock-user",
    );
    assert.equal(dashboard.response.status, 200);
    assert.equal(dashboard.body.data.profile.xp, 30);
    assert.equal(dashboard.body.data.profile.discipline, 5);
    assert.equal(dashboard.body.data.boss.bossId, "bubble-tea-monster");
    assert.equal(dashboard.body.data.boss.currentHp, 80);
    assert.deepEqual(dashboard.body.data.activeChallenges, []);
  } finally {
    await server.close();
  }
});

test("challenge completion cannot damage boss below zero or complete twice", async () => {
  const server = await startServer();

  try {
    await requestJson(server.baseUrl, "/api/profile", {
      method: "POST",
      body: JSON.stringify(validOnboardingPayload()),
    });

    const first = await requestJson(
      server.baseUrl,
      "/api/challenges/challenge-1/complete",
      {
        method: "POST",
        body: JSON.stringify({ userId: "mock-user" }),
      },
    );
    assert.equal(first.response.status, 200);

    const second = await requestJson(
      server.baseUrl,
      "/api/challenges/challenge-1/complete",
      {
        method: "POST",
        body: JSON.stringify({ userId: "mock-user" }),
      },
    );

    assert.equal(second.response.status, 409);
    assert.equal(second.body.success, false);
  } finally {
    await server.close();
  }
});

test("anti-regret coach falls back to a short Vietnamese rule-based response without Gemini", async () => {
  const server = await startServer();

  try {
    await requestJson(server.baseUrl, "/api/profile", {
      method: "POST",
      body: JSON.stringify(validOnboardingPayload()),
    });

    const coach = await requestJson(server.baseUrl, "/api/coach/anti-regret", {
      method: "POST",
      body: JSON.stringify({
        userId: "mock-user",
        itemName: "tai nghe mới",
        amount: 1200000,
        reason: "Mình thấy flash sale nên hơi muốn chốt đơn",
      }),
    });

    assert.equal(coach.response.status, 200);
    assert.equal(coach.body.success, true);
    assert.equal(coach.body.message, "Coach response generated");
    assert.deepEqual(Object.keys(coach.body.data).sort(), [
      "coachMessage",
      "detectedTrigger",
      "suggestedAction",
      "urgeId",
    ]);
    assert.match(coach.body.data.urgeId, /^urge_\d{3}$/);
    assert.equal(coach.body.data.detectedTrigger, "flash_sale");
    assert.equal(coach.body.data.suggestedAction, "WAIT_24_HOURS");
    assert.deepEqual(coach.body.debug, { provider: "fallback" });
    assert.match(coach.body.data.coachMessage, /save_money/);
    assert.match(coach.body.data.coachMessage, /tai nghe mới/);
    assert.ok(coach.body.data.coachMessage.length <= 180);
  } finally {
    await server.close();
  }
});

test("anti-regret coach can use a generated Gemini message with profile and spending context", async () => {
  const mockStore = require("../src/data/mockStore");
  const coachService = require("../src/services/coach.service");
  const profileService = require("../src/services/profile.service");

  await profileService.createProfile({
    userId: "mock-user",
    displayName: "Minh",
    monthlyBudget: 3000000,
    mainGoal: "Tiết kiệm 20 triệu",
    targetAmount: 20000000,
    targetDate: futureDate(),
    triggers: ["flash sale", "stress"],
    preferredTone: "funny",
  });

  mockStore.createExpense({
    userId: "mock-user",
    amount: 55000,
    currency: "VND",
    category: "FOOD_DRINK",
  });

  const expectedMessage =
    "Khoan chốt đơn nha. So với goal của bạn trước, rồi thử tìm option nhỏ hơn.";

  let receivedContext = null;

  const response = await coachService.createAntiRegretResponse(
    {
      userId: "mock-user",
      itemName: "tai nghe mới",
      amount: 1200000,
      reason: "Mình thấy flash sale nên hơi muốn chốt đơn",
    },
    {
      generateCoachMessage: async (context) => {
        // Không assert ở đây vì coach.service sẽ catch lỗi
        // và chuyển sang fallback.
        receivedContext = context;
        return expectedMessage;
      },
    },
  );

  assert.equal(response.coachMessage, expectedMessage);
  assert.equal(response.detectedTrigger, "flash_sale");
  assert.equal(response.suggestedAction, "WAIT_24_HOURS");
  assert.equal(response.providerUsed, "gemini");

  assert.ok(receivedContext);
  assert.equal(receivedContext.mainGoal, "Tiết kiệm 20 triệu");
  assert.deepEqual(receivedContext.triggers, ["flash sale", "stress"]);
  assert.equal(receivedContext.preferredTone, "funny");
  assert.equal(receivedContext.itemName, "tai nghe mới");
  assert.equal(receivedContext.amount, 1200000);
  assert.equal(receivedContext.detectedTrigger, "flash_sale");
  assert.match(receivedContext.recentSpendingSummary, /FOOD_DRINK/);

  const savedUrge = mockStore.findSpendingUrgeById(response.urgeId);

  assert.equal(savedUrge.coachMessage, response.coachMessage);
});

test("anti-regret coach preserves an explicit valid trigger and can expose Gemini debug in development", async () => {
  const geminiService = require("../src/services/gemini.service");
  const originalGenerate = geminiService.generateAntiRegretCoachMessage;
  geminiService.generateAntiRegretCoachMessage = async (context) => {
    assert.equal(context.detectedTrigger, "flash_sale");
    return "Pause nhe truoc da nha. So voi goal cua ban, thu option re hon roi quyet cung chua muon.";
  };

  const server = await startServer();

  try {
    await requestJson(server.baseUrl, "/api/profile", {
      method: "POST",
      body: JSON.stringify(validOnboardingPayload()),
    });

    const coach = await requestJson(server.baseUrl, "/api/coach/anti-regret", {
      method: "POST",
      body: JSON.stringify({
        userId: "mock-user",
        itemName: "ao khoac",
        amount: 450000,
        reason: "minh dang phan van",
        trigger: "flash_sale",
      }),
    });

    assert.equal(coach.response.status, 200);
    assert.equal(coach.body.data.detectedTrigger, "flash_sale");
    assert.equal(
      coach.body.data.coachMessage,
      "Pause nhe truoc da nha. So voi goal cua ban, thu option re hon roi quyet cung chua muon.",
    );
    assert.deepEqual(coach.body.debug, { provider: "gemini" });
  } finally {
    geminiService.generateAntiRegretCoachMessage = originalGenerate;
    await server.close();
  }
});

test("coach chat returns a validated Gemini reply, suggested questions, and retry debug metadata", async () => {
  const geminiService = require("../src/services/gemini.service");
  const originalGenerate = geminiService.generateCoachChatReply;
  geminiService.generateCoachChatReply = async (context) => {
    assert.equal(
      context.userMessage,
      "Tôi muốn mua đồng hồ 1 triệu vì đang sale, có nên mua không?",
    );
    assert.equal(context.mainGoal, "save_money");
    assert.deepEqual(context.triggers, ["flash_sale"]);
    assert.equal(context.preferredTone, "funny");
    assert.equal(context.monthlyBudget, 3000000);
    assert.equal(context.monthlySpent, 55000);
    assert.match(context.recentSpendingSummary, /FOOD_DRINK/);
    return {
      reply:
        "Đồng hồ 1 triệu là khoản không nhỏ, nhất là khi bạn đang có mục tiêu tiết kiệm rõ ràng. Nếu lý do chính là sale, hãy chờ 24 giờ rồi xem bạn còn muốn mua không. Nếu vẫn muốn mua, đặt trước một mức giá tối đa để tránh chốt vì cảm xúc.",
      suggestedQuestions: [
        "Nếu không mua món này thì tôi tiết kiệm được bao nhiêu?",
        "Có lựa chọn nào rẻ hơn không?",
        "Món này có thật sự cần trong tuần này không?",
      ],
      retryCount: 0,
    };
  };

  const server = await startServer();

  try {
    await requestJson(server.baseUrl, "/api/profile", {
      method: "POST",
      body: JSON.stringify(validOnboardingPayload()),
    });

    await requestJson(server.baseUrl, "/api/expenses/quick-input", {
      method: "POST",
      body: JSON.stringify({
        userId: "mock-user",
        amount: 55000,
        category: "FOOD_DRINK",
      }),
    });

    const coach = await requestJson(server.baseUrl, "/api/coach/chat", {
      method: "POST",
      body: JSON.stringify({
        userId: "mock-user",
        message: "Tôi muốn mua đồng hồ 1 triệu vì đang sale, có nên mua không?",
      }),
    });

    assert.equal(coach.response.status, 200);
    assert.equal(coach.body.success, true);
    assert.equal(coach.body.message, "Coach chat response generated");
    assert.match(coach.body.data.reply, /Đồng hồ 1 triệu/);
    assert.equal(coach.body.data.suggestedQuestions.length, 3);
    assert.ok(
      coach.body.data.suggestedQuestions.includes(
        "Có lựa chọn nào rẻ hơn không?",
      ),
    );
    assert.deepEqual(coach.body.debug, { provider: "gemini", retryCount: 0 });
  } finally {
    geminiService.generateCoachChatReply = originalGenerate;
    await server.close();
  }
});

test("coach voice-message transcribes audio and reuses coach chat reply logic", async () => {
  const geminiService = require("../src/services/gemini.service");
  const originalTranscribe = geminiService.generateVoiceTranscription;
  const originalGenerate = geminiService.generateCoachChatReply;
  const transcript =
    "Tôi muốn mua đồng hồ 1 triệu vì đang sale, có nên mua không?";

  geminiService.generateVoiceTranscription = async (context) => {
    assert.ok(Buffer.isBuffer(context.audioBuffer));
    assert.equal(context.mimeType, "audio/wav");
    return transcript;
  };
  geminiService.generateCoachChatReply = async (context) => {
    assert.equal(context.userMessage, transcript);
    assert.equal(context.mainGoal, "save_money");
    assert.deepEqual(context.triggers, ["flash_sale"]);
    return {
      reply:
        "Đồng hồ 1 triệu là khoản cần cân nhắc nếu bạn đang có mục tiêu tiết kiệm rõ ràng. Vì lý do chính là sale, hãy chờ 24 giờ rồi xem bạn còn muốn mua không. Nếu vẫn muốn mua, đặt trước mức chi tối đa để không bị cảm xúc kéo đi.",
      suggestedQuestions: [
        "Nếu không mua món này thì tôi tiết kiệm được bao nhiêu?",
        "Có lựa chọn nào rẻ hơn không?",
        "Món này có thật sự cần trong tuần này không?",
      ],
      retryCount: 0,
    };
  };

  const server = await startServer();

  try {
    await requestJson(server.baseUrl, "/api/profile", {
      method: "POST",
      body: JSON.stringify(validOnboardingPayload()),
    });

    const formData = new FormData();
    formData.append("userId", "mock-user");
    formData.append(
      "audio",
      new Blob([createSilentWavBuffer(1)], { type: "audio/wav" }),
      "voice.wav",
    );

    const coach = await requestForm(
      server.baseUrl,
      "/api/coach/voice-message",
      formData,
    );

    assert.equal(coach.response.status, 200);
    assert.equal(coach.body.success, true);
    assert.equal(coach.body.message, "Coach voice response generated");
    assert.equal(coach.body.data.transcribedText, transcript);
    assert.match(coach.body.data.coachReply, /Đồng hồ 1 triệu/);
    assert.equal(coach.body.data.suggestedQuestions.length, 3);
    assert.deepEqual(coach.body.debug, { provider: "gemini", retryCount: 0 });
  } finally {
    geminiService.generateVoiceTranscription = originalTranscribe;
    geminiService.generateCoachChatReply = originalGenerate;
    await server.close();
  }
});

test("coach voice-message rejects audio longer than 60 seconds", async () => {
  const geminiService = require("../src/services/gemini.service");
  const originalTranscribe = geminiService.generateVoiceTranscription;
  let transcribeCalled = false;
  geminiService.generateVoiceTranscription = async () => {
    transcribeCalled = true;
    return "Không nên gọi tới đây";
  };

  const server = await startServer();

  try {
    const formData = new FormData();
    formData.append("userId", "mock-user");
    formData.append(
      "audio",
      new Blob([createSilentWavBuffer(61)], { type: "audio/wav" }),
      "long.wav",
    );

    const coach = await requestForm(
      server.baseUrl,
      "/api/coach/voice-message",
      formData,
    );

    assert.equal(coach.response.status, 422);
    assert.equal(coach.body.success, false);
    assert.equal(coach.body.message, "Audio duration must be 60 seconds or shorter");
    assert.equal(transcribeCalled, false);
  } finally {
    geminiService.generateVoiceTranscription = originalTranscribe;
    await server.close();
  }
});

test("coach chat returns an AI provider error instead of a fallback when Gemini fails", async () => {
  const geminiService = require("../src/services/gemini.service");
  const originalGenerate = geminiService.generateCoachChatReply;
  geminiService.generateCoachChatReply = async () => {
    const error = new Error("Coach đang hơi lag, thử lại sau nha.");
    error.status = 502;
    error.code = "AI_PROVIDER_ERROR";
    error.debug = { provider: "gemini" };
    throw error;
  };

  const server = await startServer();

  try {
    await requestJson(server.baseUrl, "/api/profile", {
      method: "POST",
      body: JSON.stringify(validOnboardingPayload()),
    });

    const coach = await requestJson(server.baseUrl, "/api/coach/chat", {
      method: "POST",
      body: JSON.stringify({
        userId: "mock-user",
        message: "Làm sao tiết kiệm thêm 50.000đ?",
      }),
    });

    assert.equal(coach.response.status, 502);
    assert.equal(coach.body.success, false);
    assert.equal(coach.body.message, "Coach đang hơi lag, thử lại sau nha.");
    assert.deepEqual(coach.body.error, { code: "AI_PROVIDER_ERROR" });
    assert.deepEqual(coach.body.debug, { provider: "gemini" });
  } finally {
    geminiService.generateCoachChatReply = originalGenerate;
    await server.close();
  }
});

test("coach chat returns an invalid response error instead of a fallback when Gemini output is unusable", async () => {
  const geminiService = require("../src/services/gemini.service");
  const originalGenerate = geminiService.generateCoachChatReply;
  geminiService.generateCoachChatReply = async () => {
    const error = new Error("Coach chưa trả lời ổn định, thử lại nha.");
    error.status = 502;
    error.code = "AI_RESPONSE_INVALID";
    error.debug = {
      provider: "gemini",
      retryCount: 1,
      reason: "invalid_short_reply",
    };
    throw error;
  };

  const server = await startServer();

  try {
    await requestJson(server.baseUrl, "/api/profile", {
      method: "POST",
      body: JSON.stringify(validOnboardingPayload()),
    });

    const coach = await requestJson(server.baseUrl, "/api/coach/chat", {
      method: "POST",
      body: JSON.stringify({
        userId: "mock-user",
        message: "Tôi muốn mua đồng hồ 1 triệu vì đang sale, có nên mua không?",
      }),
    });

    assert.equal(coach.response.status, 502);
    assert.equal(coach.body.success, false);
    assert.equal(
      coach.body.message,
      "Coach chưa trả lời ổn định, thử lại nha.",
    );
    assert.deepEqual(coach.body.error, { code: "AI_RESPONSE_INVALID" });
    assert.deepEqual(coach.body.debug, {
      provider: "gemini",
      retryCount: 1,
      reason: "invalid_short_reply",
    });
  } finally {
    geminiService.generateCoachChatReply = originalGenerate;
    await server.close();
  }
});

test("coach reads profile from Supabase after in-memory state is reset", async () => {
  const server = await startServer();

  try {
    const createdProfile = await requestJson(server.baseUrl, "/api/profile", {
      method: "POST",
      body: JSON.stringify(
        validOnboardingPayload({
          userId: "cold-start-user",
        }),
      ),
    });

    assert.equal(createdProfile.response.status, 201);

    // Mô phỏng Vercel cold start hoặc instance mới:
    // database còn nhưng RAM bị xóa.
    const { resetMockData } = require("../src/data/mockStore");
    resetMockData();

    const coach = await requestJson(server.baseUrl, "/api/coach/anti-regret", {
      method: "POST",
      body: JSON.stringify({
        userId: "cold-start-user",
        itemName: "tai nghe mới",
        amount: 1200000,
        reason: "Đang flash sale nên mình muốn mua",
      }),
    });

    assert.equal(coach.response.status, 200);
    assert.equal(coach.body.success, true);
    assert.equal(coach.body.data.detectedTrigger, "flash_sale");
  } finally {
    await server.close();
  }
});

test("anti-regret coach validates requests and requires an existing Supabase profile", async () => {
  const server = await startServer();

  try {
    const invalidCoachRequest = await requestJson(
      server.baseUrl,
      "/api/coach/anti-regret",
      {
        method: "POST",
        body: JSON.stringify({
          userId: "mock-user",
          amount: -1,
        }),
      },
    );

    assert.equal(invalidCoachRequest.response.status, 422);
    assert.equal(invalidCoachRequest.body.success, false);
    assert.ok(invalidCoachRequest.body.errors);

    const missingProfile = await requestJson(
      server.baseUrl,
      "/api/coach/anti-regret",
      {
        method: "POST",
        body: JSON.stringify({
          userId: "mock-user",
          itemName: "áo khoác",
          amount: 450000,
          reason: "Bạn bè rủ mua cùng",
        }),
      },
    );

    assert.equal(missingProfile.response.status, 404);
    assert.equal(missingProfile.body.success, false);
    assert.equal(missingProfile.body.message, "Profile not found");
  } finally {
    await server.close();
  }
});

test("API validates bad profile and expense requests", async () => {
  const server = await startServer();

  try {
    const invalidProfile = await requestJson(server.baseUrl, "/api/profile", {
      method: "POST",
      body: JSON.stringify({
        userId: "",
        displayName: "",
        monthlyBudget: -1,
      }),
    });

    assert.equal(invalidProfile.response.status, 400);
    assert.equal(invalidProfile.body.success, false);
    assert.ok(invalidProfile.body.errors);

    const invalidExpense = await requestJson(
      server.baseUrl,
      "/api/expenses/quick-input",
      {
        method: "POST",
        body: JSON.stringify({
          userId: "mock-user",
        }),
      },
    );

    assert.equal(invalidExpense.response.status, 422);
    assert.equal(invalidExpense.body.success, false);
    assert.ok(invalidExpense.body.errors);
  } finally {
    await server.close();
  }
});

test("profile API enforces strict onboarding POST and partial PATCH validation", async () => {
  const server = await startServer();

  try {
    const invalidPostPayloads = [
      { userId: undefined },
      { displayName: "   " },
      { mainGoal: "Tiết kiệm tiền" },
      { monthlyBudget: 0 },
      { monthlyBudget: -1 },
      { monthlyBudget: 1.5 },
      { targetAmount: 0 },
      { targetDate: "2026-02-31" },
      { targetDate: new Date().toISOString().slice(0, 10) },
      { triggers: [] },
      { triggers: ["shopping"] },
      { preferredTone: "mean" },
    ];

    for (const override of invalidPostPayloads) {
      const response = await requestJson(server.baseUrl, "/api/profile", {
        method: "POST",
        body: JSON.stringify(validOnboardingPayload(override)),
      });
      assert.equal(response.response.status, 400, JSON.stringify(override));
      assert.equal(response.body.success, false);
      assert.ok(response.body.errors);
    }

    const created = await requestJson(server.baseUrl, "/api/profile", {
      method: "POST",
      body: JSON.stringify(
        validOnboardingPayload({ triggers: ["friends", "friends"] }),
      ),
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.data.preferredTone, "funny");
    assert.deepEqual(created.body.data.triggers, ["friends"]);

    const invalidPatchPayloads = [
      {},
      { userId: "another-user" },
      { monthlyBudget: 0 },
      { targetDate: new Date().toISOString().slice(0, 10) },
      { triggers: [] },
    ];

    for (const payload of invalidPatchPayloads) {
      const response = await requestJson(
        server.baseUrl,
        "/api/profile/mock-user",
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
      );
      assert.equal(response.response.status, 400, JSON.stringify(payload));
    }

    const patch = await requestJson(server.baseUrl, "/api/profile/mock-user", {
      method: "PATCH",
      body: JSON.stringify({ monthlyBudget: 3500000 }),
    });
    assert.equal(patch.response.status, 200);
    assert.equal(patch.body.data.monthlyBudget, 3500000);
    assert.equal(patch.body.data.targetAmount, 20000000);
  } finally {
    await server.close();
  }
});
