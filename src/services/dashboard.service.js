const { createHttpError } = require('../utils/httpError');
const bossRepository = require('../repositories/boss.repository');
const challengeRepository = require('../repositories/challenge.repository');
const expenseRepository = require('../repositories/expense.repository');
const profileService = require('./profile.service');

const getSafeSupabaseErrorDetails = (error) => ({ message: error && error.message ? error.message : 'Unknown database error', code: error && error.code, hint: error && error.hint });
const handleDatabaseError = (error) => { console.error('[Supabase] dashboard operation failed', getSafeSupabaseErrorDetails(error)); throw createHttpError(500, 'Database error'); };
const getUtcMonthRange = (now = new Date()) => {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
};

const getDashboard = async (userId) => {
  const profile = await profileService.getProfile(userId);
  try {
    const outcome = await challengeRepository.ensureDefaultGameState(userId);
    if (outcome === 'profile_not_found') throw createHttpError(404, 'Profile not found');
    const { start, end } = getUtcMonthRange();
    const [recentExpensePage, monthlySpent, boss, activeChallenges] = await Promise.all([
      expenseRepository.listExpensesByUserId(userId, { page: 1, pageSize: 5 }),
      expenseRepository.sumExpensesForUtcMonth(userId, start, end),
      bossRepository.findBossState(userId),
      challengeRepository.listActiveChallenges(userId),
    ]);
    if (!boss) throw createHttpError(500, 'Database error');

    return {
      profile: { userId: profile.userId, displayName: profile.displayName, level: profile.level, xp: profile.xp, discipline: profile.discipline || 0, monthlyBudget: profile.monthlyBudget, monthlySpent, mainGoal: profile.mainGoal, triggers: profile.triggers || [], preferredTone: profile.preferredTone },
      boss,
      recentExpenses: recentExpensePage.items,
      activeChallenges,
    };
  } catch (error) {
    if (error.status) throw error;
    handleDatabaseError(error);
  }
};

module.exports = {
  getDashboard,
  getUtcMonthRange,
};
