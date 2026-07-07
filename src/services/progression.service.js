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

const addChallengeProgress = (userId, { rewardXp, disciplineReward }) => {
  const profileWithXp = mockStore.addXpToProfile(userId, rewardXp);
  if (!profileWithXp) {
    throw createHttpError(404, 'Profile not found');
  }

  const profileWithDiscipline = mockStore.addDisciplineToProfile(userId, disciplineReward);

  return {
    xpGained: rewardXp,
    totalXp: profileWithDiscipline.xp,
    level: profileWithDiscipline.level,
    disciplineGained: disciplineReward,
    discipline: profileWithDiscipline.discipline,
  };
};

module.exports = {
  EXPENSE_XP_REWARD,
  addChallengeProgress,
  addExpenseXp,
};
