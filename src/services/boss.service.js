const mockStore = require('../data/mockStore');

const getBossState = (userId) => mockStore.getBossState(userId);

const damageBoss = (userId, damage) => mockStore.damageBoss(userId, damage);

module.exports = {
  damageBoss,
  getBossState,
};
