const mockStore = require('../data/mockStore');
const { createHttpError } = require('../utils/httpError');

const getDashboard = (userId) => {
  const profile = mockStore.findProfileByUserId(userId);
  if (!profile) {
    throw createHttpError(404, 'Profile not found');
  }

  const recentExpenses = mockStore.listExpensesByUserId(userId, {
    page: 1,
    pageSize: 5,
  }).items;

  return {
    profile: {
      userId: profile.userId,
      displayName: profile.displayName,
      level: profile.level,
      xp: profile.xp,
      discipline: profile.discipline || 0,
      monthlyBudget: profile.monthlyBudget,
      monthlySpent: mockStore.sumExpensesByUserId(userId),
      mainGoal: profile.mainGoal,
      triggers: profile.triggers || [],
      preferredTone: profile.preferredTone,
    },
    boss: mockStore.getBossState(userId),
    recentExpenses,
    activeChallenges: mockStore.listActiveChallenges(userId),
  };
};

module.exports = {
  getDashboard,
};
