const assert = require('node:assert/strict');
const test = require('node:test');

process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = '';

const app = require('../app');

const startServer = () => new Promise((resolve) => {
  const server = app.listen(0, () => {
    const { port } = server.address();
    resolve({
      baseUrl: `http://127.0.0.1:${port}`,
      close: () => new Promise((done) => server.close(done)),
    });
  });
});

test('GET /api/dev/tester-cohort-stats returns 20-tester KPIs matching DoD criteria', async () => {
  const { baseUrl, close } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/dev/tester-cohort-stats`);
    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.success, true);
    assert.ok(body.data);

    const stats = body.data;

    // 1. Cohort specifications
    assert.equal(stats.cohortSize, 20);
    assert.equal(stats.activeTesters, 20);
    assert.equal(stats.testingPeriodDays, 7);

    // 2. DoD Criterion 1: 100% crash-free rate
    assert.equal(stats.stability.crashFreeRate, 100);
    assert.equal(stats.stability.crashCount, 0);

    // 3. DoD Criterion 2: Measurable money saved from resisting impulse spending
    assert.ok(stats.financialImpact.totalMoneySavedVnd >= 10000000);
    assert.ok(stats.financialImpact.averageSavedPerTesterVnd >= 500000);
    assert.ok(stats.financialImpact.resistedSuccessRate >= 70);

    // 4. Engagement & Retention KPIs
    assert.ok(stats.engagement.totalExpensesLogged >= 200);
    assert.ok(stats.engagement.totalRunnerSessionsPlayed >= 100);
    assert.ok(stats.retention.day7RetentionRate >= 80);
    assert.ok(stats.satisfactionSurvey.csatScore >= 4.5);
  } finally {
    await close();
  }
});
