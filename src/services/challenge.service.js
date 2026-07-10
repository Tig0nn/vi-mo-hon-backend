const { createHttpError } = require('../utils/httpError');
const challengeRepository = require('../repositories/challenge.repository');
const profileService = require('./profile.service');

const getSafeSupabaseErrorDetails = (error) => ({
  message: error && error.message ? error.message : 'Unknown database error',
  code: error && error.code ? error.code : undefined,
  hint: error && error.hint ? error.hint : undefined,
});
const handleDatabaseError = (error) => {
  console.error('[Supabase] challenge operation failed', getSafeSupabaseErrorDetails(error));
  throw createHttpError(500, 'Database error');
};

const listActiveChallenges = async (userId) => {
  await profileService.getProfile(userId);
  try {
    const outcome = await challengeRepository.ensureDefaultGameState(userId);
    if (outcome === 'profile_not_found') throw createHttpError(404, 'Profile not found');
    return { items: await challengeRepository.listActiveChallenges(userId) };
  } catch (error) {
    if (error.status) throw error;
    handleDatabaseError(error);
  }
};

const completeChallenge = async (userId, challengeId) => {
  await profileService.getProfile(userId);
  let result;
  try {
    result = await challengeRepository.completeChallenge(userId, challengeId);
  } catch (error) {
    handleDatabaseError(error);
  }
  if (result.outcome === 'profile_not_found') throw createHttpError(404, 'Profile not found');
  if (result.outcome === 'challenge_not_found') throw createHttpError(404, 'Challenge not found');
  if (result.outcome === 'challenge_already_completed') throw createHttpError(409, 'Challenge already completed');
  if (result.outcome === 'challenge_not_active') throw createHttpError(409, 'Challenge is not active');
  if (result.outcome !== 'success') throw createHttpError(500, 'Database error');
  return { challenge: result.challenge, progression: result.progression, boss: result.boss };
};

module.exports = {
  completeChallenge,
  listActiveChallenges,
};
