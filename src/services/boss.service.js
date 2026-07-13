const bossRepository = require('../repositories/boss.repository');

const getBossState = (userId) => bossRepository.findBossState(userId);

module.exports = {
  getBossState,
};
