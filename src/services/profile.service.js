const mockStore = require('../data/mockStore');
const profileRepository = require('../repositories/profile.repository');
const { createHttpError } = require('../utils/httpError');

const getSafeSupabaseErrorDetails = (error) => ({
  message: error && error.message ? error.message : 'Unknown database error',
  code: error && error.code ? error.code : undefined,
  hint: error && error.hint ? error.hint : undefined,
});

const handleDatabaseError = (error) => {
  console.error('[Supabase] profile operation failed', getSafeSupabaseErrorDetails(error));
  throw createHttpError(500, 'Database error');
};

const syncMockProfile = (profile) => {
  const existingProfile = mockStore.findProfileByUserId(profile.userId);
  const payload = {
    userId: profile.userId,
    displayName: profile.displayName,
    monthlyBudget: profile.monthlyBudget,
    currency: profile.currency,
    mainGoal: profile.mainGoal,
    triggers: profile.triggers || [],
    preferredTone: profile.preferredTone,
  };

  if (existingProfile) {
    mockStore.updateProfile(profile.userId, payload);
    return;
  }

  mockStore.createProfile(payload);
};

const createProfile = async (input) => {
  try {
    const profile = await profileRepository.upsertProfile(input);
    await profileRepository.ensureUserProgress(input.userId);
    await profileRepository.ensureDefaultGameState(input.userId);
    syncMockProfile(profile);
    return profile;
  } catch (error) {
    handleDatabaseError(error);
  }
};

const getProfile = async (userId) => {
  let profile;

  try {
    profile = await profileRepository.findProfileByUserId(userId);
  } catch (error) {
    handleDatabaseError(error);
  }

  if (!profile) {
    throw createHttpError(404, 'Profile not found');
  }

  return profile;
};

const updateProfile = async (userId, updates) => {
  let profile;

  try {
    profile = await profileRepository.updateProfile(userId, updates);
  } catch (error) {
    handleDatabaseError(error);
  }

  if (!profile) {
    throw createHttpError(404, 'Profile not found');
  }

  syncMockProfile(profile);
  return profile;
};

module.exports = {
  createProfile,
  getProfile,
  updateProfile,
};
