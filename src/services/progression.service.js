const mockStore = require('../data/mockStore');
const { createHttpError } = require('../utils/httpError');

const EXPENSE_XP_REWARD = 5;

const addExpenseXp = (userId) => {
  const profile = mockStore.addXpToProfile(userId, EXPENSE_XP_REWARD);
  if (!profile) {
    throw createHttpError(404, 'Profile not found');
  }

  return {
    xpGained: EXPENSE_XP_REWARD,
    totalXp: profile.xp,
    level: profile.level,
  };
};

module.exports = {
  EXPENSE_XP_REWARD,
  addExpenseXp,
};
