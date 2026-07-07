const mockStore = require('../data/mockStore');
const { createHttpError } = require('../utils/httpError');

const createProfile = (input) => {
  const existingProfile = mockStore.findProfileByUserId(input.userId);
  if (existingProfile) {
    throw createHttpError(409, 'Profile already exists');
  }

  return mockStore.createProfile(input);
};

const getProfile = (userId) => {
  const profile = mockStore.findProfileByUserId(userId);
  if (!profile) {
    throw createHttpError(404, 'Profile not found');
  }

  return profile;
};

const updateProfile = (userId, updates) => {
  const profile = mockStore.updateProfile(userId, updates);
  if (!profile) {
    throw createHttpError(404, 'Profile not found');
  }

  return profile;
};

module.exports = {
  createProfile,
  getProfile,
  updateProfile,
};
