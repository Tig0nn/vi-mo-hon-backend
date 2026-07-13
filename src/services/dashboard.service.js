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
    const stats = await challengeRepository.getBossChallengeStats(userId, boss.bossId);
    const todayChallenge = activeChallenges[0] ? { ...activeChallenges[0], totalChallenges: stats.totalChallenges } : null;
    const businessDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const completedDate = stats.lastCompletedAt && new Date(stats.lastCompletedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const completedToday = !todayChallenge && boss.status !== 'defeated' && completedDate === businessDate;
    const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

    return {
      profile: { userId: profile.userId, displayName: profile.displayName, level: profile.level, xp: profile.xp, discipline: profile.discipline || 0, savings: profile.savings || 0, knowledge: profile.knowledge || 0, wealth: profile.wealth || 0, monthlyBudget: profile.monthlyBudget, monthlySpent, mainGoal: profile.mainGoal, triggers: profile.triggers || [], preferredTone: profile.preferredTone },
      boss: { ...boss, completedChallenges: stats.completedChallenges, totalChallenges: stats.totalChallenges },
      recentExpenses: recentExpensePage.items,
      activeChallenges,
      todayChallenge,
      nextChallengeAvailableOn: completedToday ? tomorrow : null,
      challengeMessage: boss.status === 'defeated' ? 'Bạn đã đánh bại boss này' : (completedToday ? 'Đã hoàn thành thử thách hôm nay' : null),
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
