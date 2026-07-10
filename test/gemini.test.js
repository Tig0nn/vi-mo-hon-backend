const assert = require('node:assert/strict');
const test = require('node:test');

process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = '';
process.env.GEMINI_MODEL = '';

const geminiService = require('../src/services/gemini.service');

test('generateAntiRegretCoachMessage uses process.env Gemini config at call time', async () => {
  const previousApiKey = process.env.GEMINI_API_KEY;
  const previousModel = process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.GEMINI_MODEL = 'test-gemini-model';

  try {
    let called = false;
    const message = await geminiService.generateAntiRegretCoachMessage(
      {
        mainGoal: 'Tiet kiem 20 trieu',
        preferredTone: 'funny',
        itemName: 'ao khoac',
        amount: 450000,
        reason: 'minh dang phan van',
        detectedTrigger: 'flash_sale',
        suggestedAction: 'WAIT_24_HOURS',
        recentSpendingSummary: 'No recent spending recorded.',
      },
      {
        client: {
          models: {
            generateContent: async (request) => {
              called = true;
              assert.equal(request.model, 'test-gemini-model');
              assert.match(request.contents, /Anti-Regret Coach/);
              assert.match(request.contents, /flash_sale/);
              return {
                text: 'Dung mua voi nha. Canh goal truoc, roi tim option nho hon.',
              };
            },
          },
        },
      }
    );

    assert.equal(called, true);
    assert.equal(message, 'Dung mua voi nha. Canh goal truoc, roi tim option nho hon.');
  } finally {
    process.env.GEMINI_API_KEY = previousApiKey;
    process.env.GEMINI_MODEL = previousModel;
  }
});

test('generateAntiRegretCoachMessage returns null when Gemini key is missing', async () => {
  const previousApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';

  try {
    const message = await geminiService.generateAntiRegretCoachMessage({
      itemName: 'ao khoac',
      amount: 450000,
      reason: 'minh dang phan van',
      detectedTrigger: 'flash_sale',
      suggestedAction: 'WAIT_24_HOURS',
    });

    assert.equal(message, null);
  } finally {
    process.env.GEMINI_API_KEY = previousApiKey;
  }
});

test('generateCoachChatReply sends profile and spending context to Gemini as JSON', async () => {
  const previousApiKey = process.env.GEMINI_API_KEY;
  const previousModel = process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.GEMINI_MODEL = 'test-gemini-model';

  try {
    let called = false;
    const message = await geminiService.generateCoachChatReply(
      {
        userMessage: 'Toi muon mua dong ho dang sale',
        mainGoal: 'Tiet kiem 20 trieu',
        triggers: ['flash sale'],
        preferredTone: 'funny',
        monthlyBudget: 3000000,
        monthlySpent: 55000,
        recentSpendingSummary: 'FOOD_DRINK: 55.000đ',
      },
      {
        client: {
          models: {
            generateContent: async (request) => {
              called = true;
              assert.equal(request.model, 'test-gemini-model');
              assert.match(request.contents, /Mỏ Hỗn/);
              assert.equal(request.config.responseMimeType, 'application/json');
              assert.match(request.contents, /Monthly budget: 3000000 VND/);
              assert.match(request.contents, /Monthly spent: 55000 VND/);
              assert.match(request.contents, /Toi muon mua dong ho dang sale/);
              return {
                text: JSON.stringify({
                  reply: 'Đồng hồ đang sale nghe có vẻ hấp dẫn, nhưng đây vẫn là một khoản cần cân nhắc với mục tiêu tiết kiệm của bạn. Hãy chờ 24 giờ rồi xem cảm giác muốn mua còn mạnh không. Nếu vẫn muốn mua, đặt trước mức chi tối đa để không bị kéo theo cảm xúc sale.',
                  suggestedQuestions: [
                    'Nếu không mua món này thì tôi tiết kiệm được bao nhiêu?',
                    'Có lựa chọn nào rẻ hơn không?',
                    'Món này có thật sự cần trong tuần này không?',
                  ],
                }),
              };
            },
          },
        },
      }
    );

    assert.equal(called, true);
    assert.equal(message.retryCount, 0);
    assert.match(message.reply, /Đồng hồ đang sale/);
    assert.equal(message.suggestedQuestions.length, 3);
  } finally {
    process.env.GEMINI_API_KEY = previousApiKey;
    process.env.GEMINI_MODEL = previousModel;
  }
});

test('generateCoachChatReply retries once when Gemini returns a short fragment', async () => {
  const previousApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-gemini-key';

  try {
    let calls = 0;
    const message = await geminiService.generateCoachChatReply(
      {
        userMessage: 'Toi muon mua dong ho 1 trieu vi dang sale',
        mainGoal: 'Tiet kiem 20 trieu',
        triggers: ['flash sale'],
        preferredTone: 'funny',
        monthlyBudget: 3000000,
        monthlySpent: 55000,
        recentSpendingSummary: 'FOOD_DRINK: 55.000đ',
      },
      {
        client: {
          models: {
            generateContent: async (request) => {
              calls += 1;
              if (calls === 1) {
                return {
                  text: JSON.stringify({
                    reply: 'U là trời, đồng hồ',
                    suggestedQuestions: ['Một?', 'Hai?', 'Ba?'],
                  }),
                };
              }

              assert.match(request.contents, /previous output was invalid/i);
              return {
                text: JSON.stringify({
                  reply: 'Đồng hồ 1 triệu là khoản không nhỏ nếu bạn đang nhắm tới mục tiêu tiết kiệm 20 triệu. Vì trigger ở đây là sale, hãy chờ 24 giờ rồi kiểm tra xem bạn còn thật sự muốn mua không. Nếu vẫn muốn mua, hãy đặt mức chi tối đa trước khi mở app mua hàng.',
                  suggestedQuestions: [
                    'Nếu không mua món này thì tôi tiết kiệm được bao nhiêu?',
                    'Có lựa chọn nào rẻ hơn không?',
                    'Món này có thật sự cần trong tuần này không?',
                  ],
                }),
              };
            },
          },
        },
      }
    );

    assert.equal(calls, 2);
    assert.equal(message.retryCount, 1);
    assert.match(message.reply, /Đồng hồ 1 triệu/);
  } finally {
    process.env.GEMINI_API_KEY = previousApiKey;
  }
});

test('generateCoachChatReply throws invalid response error after retry fails validation', async () => {
  const previousApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-gemini-key';

  try {
    let calls = 0;
    const error = await geminiService.generateCoachChatReply(
      {
        userMessage: 'Toi muon mua dong ho',
        monthlySpent: 0,
      },
      {
        client: {
          models: {
            generateContent: async () => {
              calls += 1;
              return {
                text: JSON.stringify({
                  reply: 'U là trời, đồng hồ',
                  suggestedQuestions: ['Một?', 'Hai?', 'Ba?'],
                }),
              };
            },
          },
        },
      }
    ).catch((caughtError) => caughtError);

    assert.equal(calls, 2);
    assert.equal(error.code, 'AI_RESPONSE_INVALID');
    assert.equal(error.status, 502);
    assert.deepEqual(error.debug, {
      provider: 'gemini',
      retryCount: 1,
      reason: 'invalid_short_reply',
    });
  } finally {
    process.env.GEMINI_API_KEY = previousApiKey;
  }
});

test('isValidCoachReply rejects short fragments and forbidden internal references', () => {
  assert.equal(geminiService.isValidCoachReply('U là trời, đồng hồ'), false);
  assert.equal(
    geminiService.isValidCoachReply('Gemini đang xử lý system prompt nên mình trả lời sau. Câu này đủ dài nhưng vẫn nhắc nội bộ không nên xuất hiện.'),
    false
  );
  assert.equal(
    geminiService.isValidCoachReply('Đồng hồ 1 triệu là khoản đáng cân nhắc nếu bạn đang có mục tiêu tiết kiệm rõ ràng. Hãy chờ 24 giờ rồi xem bạn còn muốn mua không. Nếu vẫn muốn mua, đặt trước một mức giá tối đa để tránh bị sale kéo đi quá xa.'),
    true
  );
});
