/**
 * GAME ECONOMY CONFIGURATION (BACKEND)
 * Single source of truth for mini game economy, tickets, rewards, and boss damage caps.
 * Derived from docs/GAME.md and Gate G-13.
 */

const GAME_ECONOMY = {
  tickets: {
    freeDailyMax: 3,
    premiumDailyMax: 5,
    earnRates: {
      dailyCheckin: 1,
      firstExpenseLogged: 1,
      impulseResisted: 1
    }
  },
  runnerGame: {
    baseSpeed: 12.0,
    speedIncrementPer100m: 0.5,
    maxSpeed: 24.0,
    quizGateIntervalMeters: 300,
    bossDamagePerRunMax: 20,
    maxSavingsPerRun: 50,
    maxKnowledgePerRun: 20
  },
  boss: {
    vndToHpRatio: 1000,      // 1.000đ = 1 HP
    maxGameDamagePercent: 10  // Max 10% of total Boss HP can come from runner game
  },
  streak: {
    freezeStreakMonthlyLimit: 2,
    bonusMultiplier7Days: 1.5,
    bonusMultiplier30Days: 2.0
  }
};

module.exports = GAME_ECONOMY;
