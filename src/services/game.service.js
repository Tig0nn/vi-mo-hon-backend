const crypto = require('crypto');
const GAME_ECONOMY = require('../config/gameEconomy.config');
const bossRepository = require('../repositories/boss.repository');
const gameRepository = require('../repositories/game.repository');
const profileRepository = require('../repositories/profile.repository');
const { createHttpError } = require('../utils/httpError');

const getTodayString = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
};

const getTicketStatus = async (userId) => {
  const profile = await profileRepository.findProfileByUserId(userId);
  if (!profile) {
    throw createHttpError(404, 'Profile not found');
  }

  const todayStr = getTodayString();
  const isPremium = Boolean(profile.isPremium);
  const dailyMax = isPremium
    ? GAME_ECONOMY.tickets.premiumDailyMax
    : GAME_ECONOMY.tickets.freeDailyMax;

  const usedToday = await gameRepository.getDailySessionsCount(userId, todayStr);
  const ticketsRemaining = Math.max(0, dailyMax - usedToday);

  return {
    userId,
    ticketsRemaining,
    dailyMax,
    usedToday,
    isPremium,
    today: todayStr,
  };
};

const startSession = async (userId) => {
  const ticketStatus = await getTicketStatus(userId);
  if (ticketStatus.ticketsRemaining <= 0) {
    throw createHttpError(403, 'Bạn đã hết vé chơi hôm nay. Hãy quay lại vào ngày mai!');
  }

  const boss = await bossRepository.findBossState(userId);
  const sessionId = crypto.randomUUID();
  const sessionToken = crypto.randomBytes(16).toString('hex');

  return {
    sessionId,
    sessionToken,
    ticketsRemaining: ticketStatus.ticketsRemaining,
    dailyMax: ticketStatus.dailyMax,
    maxScoreCap: GAME_ECONOMY.runnerGame.maxSavingsPerRun,
    boss: boss
      ? {
          bossId: boss.bossId,
          name: boss.name,
          currentHp: boss.currentHp,
          maxHp: boss.maxHp,
          status: boss.status,
        }
      : null,
  };
};

const endSession = async (payload) => {
  const ticketStatus = await getTicketStatus(payload.userId);
  if (ticketStatus.ticketsRemaining <= 0) {
    throw createHttpError(403, 'Bạn đã dùng hết vé chơi hôm nay. Hãy quay lại vào ngày mai!');
  }

  // 1. Server Capped Validation for Rewards
  const rawCoins = Math.max(0, Math.round(Number(payload.coins) || 0));
  const rawSavings = Math.max(
    0,
    Math.round(
      Number(payload.savingsPoints !== undefined ? payload.savingsPoints : rawCoins) || 0
    )
  );
  const rawKnowledge = Math.max(0, Math.round(Number(payload.knowledgePoints) || 0));

  const awardedSavings = Math.min(GAME_ECONOMY.runnerGame.maxSavingsPerRun, rawSavings);
  const awardedKnowledge = Math.min(GAME_ECONOMY.runnerGame.maxKnowledgePerRun, rawKnowledge);

  // 2. Server Capped Validation for Boss Damage
  // Cap at 20 HP per run
  const rawDamage = Math.min(
    GAME_ECONOMY.runnerGame.bossDamagePerRunMax,
    Math.max(0, Math.round(Number(payload.damageToBoss) || 0))
  );

  let actualDamage = 0;
  let newBossHp = 0;
  let newStatus = null;
  let accumulatedDamage = 0;
  let maxAllowedFromGame = 0;

  const boss = await bossRepository.findBossState(payload.userId);

  if (boss && boss.status === 'active' && boss.currentHp > 0) {
    // Hard Cap Rule: Total accumulated damage from runner <= 10% of initial Boss HP
    maxAllowedFromGame = Math.floor(
      boss.maxHp * (GAME_ECONOMY.boss.maxGameDamagePercent / 100)
    );
    accumulatedDamage = await gameRepository.getAccumulatedGameDamage(
      payload.userId,
      boss.bossId
    );

    const remainingCapAllowance = Math.max(0, maxAllowedFromGame - accumulatedDamage);
    const cappedRunDamage = Math.min(rawDamage, remainingCapAllowance);

    actualDamage = Math.min(cappedRunDamage, boss.currentHp);
    newBossHp = Math.max(0, boss.currentHp - actualDamage);
    newStatus = newBossHp === 0 ? 'defeated' : boss.status;

    if (actualDamage > 0 || newStatus !== boss.status) {
      await bossRepository.updateBossHp(payload.userId, boss.bossId, newBossHp, newStatus);
    }
  } else if (boss) {
    newBossHp = boss.currentHp;
    newStatus = boss.status;
  }

  // 3. Record Game Session (Consumes 1 Ticket)
  const sessionId = payload.sessionId || crypto.randomUUID();
  await gameRepository.recordGameSession({
    userId: payload.userId,
    sessionId,
    bossId: boss ? boss.bossId : null,
    durationSeconds: payload.durationSeconds || 0,
    obstaclesDodged: payload.obstaclesDodged || 0,
    coinsCollected: rawCoins,
    pointsAwarded: awardedSavings,
    bossDamageAwarded: actualDamage,
    isVerified: true,
    sessionDate: ticketStatus.today,
  });

  // 4. Update User Currency Progress (Savings, Knowledge)
  await gameRepository.updateUserRewards(payload.userId, {
    savingsAwarded: awardedSavings,
    knowledgeAwarded: awardedKnowledge,
  });

  const remainingAfterRun = Math.max(0, ticketStatus.ticketsRemaining - 1);

  return {
    verified: true,
    sessionId,
    ticketsRemaining: remainingAfterRun,
    pointsAwarded: awardedSavings,
    knowledgeAwarded: awardedKnowledge,
    bossDamageAwarded: actualDamage,
    boss: boss
      ? {
          bossId: boss.bossId,
          name: boss.name,
          currentHp: newBossHp,
          maxHp: boss.maxHp,
          status: newStatus,
        }
      : null,
    totalGameDamageOnBoss: accumulatedDamage + actualDamage,
    maxGameDamageAllowed: maxAllowedFromGame,
  };
};

module.exports = {
  endSession,
  getTicketStatus,
  getTodayString,
  startSession,
};
