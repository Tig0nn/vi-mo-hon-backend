const mockStore = require('../data/mockStore');
const bossService = require('./boss.service');
const progressionService = require('./progression.service');
const { createHttpError } = require('../utils/httpError');

const listActiveChallenges = (userId) => {
  const profile = mockStore.findProfileByUserId(userId);
  if (!profile) {
    throw createHttpError(404, 'Profile not found');
  }

  return {
    items: mockStore.listActiveChallenges(userId),
  };
};

const completeChallenge = (userId, challengeId) => {
  const profile = mockStore.findProfileByUserId(userId);
  if (!profile) {
    throw createHttpError(404, 'Profile not found');
  }

  const result = mockStore.completeChallenge(userId, challengeId);
  if (!result) {
    throw createHttpError(404, 'Challenge not found');
  }

  if (result.alreadyCompleted) {
    throw createHttpError(409, 'Challenge already completed');
  }

  const progression = progressionService.addChallengeProgress(userId, {
    rewardXp: result.challenge.rewardXp,
    disciplineReward: 5,
  });
  const boss = bossService.damageBoss(userId, result.challenge.bossDamage);

  return {
    challenge: result.challenge,
    progression,
    boss,
  };
};

module.exports = {
  completeChallenge,
  listActiveChallenges,
};
