const state = {
  bossStates: new Map(),
  challengeStatuses: new Map(),
  profiles: new Map(),
  expenses: [],
  spendingUrges: [],
  counters: {
    profile: 1,
    expense: 1,
    urge: 1,
  },
};

const challengeTemplates = [
  {
    id: 'challenge-1',
    title: 'Không uống trà sữa hôm nay',
    description: 'Skip bubble tea for today.',
    rewardXp: 30,
    bossDamage: 20,
    disciplineReward: 5,
    difficulty: 'easy',
  },
];

const clone = (value) => JSON.parse(JSON.stringify(value));

const nextId = (prefix) => {
  const value = state.counters[prefix];
  state.counters[prefix] += 1;
  return `${prefix}_${String(value).padStart(3, '0')}`;
};

const resetMockData = () => {
  state.bossStates.clear();
  state.challengeStatuses.clear();
  state.profiles.clear();
  state.expenses = [];
  state.spendingUrges = [];
  state.counters = {
    profile: 1,
    expense: 1,
    urge: 1,
  };
};

const createProfile = (input) => {
  const timestamp = new Date().toISOString();
  const profile = {
    id: nextId('profile'),
    userId: input.userId,
    displayName: input.displayName,
    monthlyBudget: input.monthlyBudget,
    currency: input.currency || 'VND',
    level: 1,
    xp: 0,
    discipline: 0,
    mainGoal: input.mainGoal || null,
    triggers: input.triggers || [],
    preferredTone: input.preferredTone || null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  state.profiles.set(profile.userId, profile);
  return clone(profile);
};

const findProfileByUserId = (userId) => {
  const profile = state.profiles.get(userId);
  return profile ? clone(profile) : null;
};

const updateProfile = (userId, updates) => {
  const profile = state.profiles.get(userId);
  if (!profile) {
    return null;
  }

  const updated = {
    ...profile,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  state.profiles.set(userId, updated);
  return clone(updated);
};

const addXpToProfile = (userId, xpDelta) => {
  const profile = state.profiles.get(userId);
  if (!profile) {
    return null;
  }

  const xp = Math.max(0, profile.xp + xpDelta);
  const updated = {
    ...profile,
    xp,
    level: Math.floor(xp / 100) + 1,
    updatedAt: new Date().toISOString(),
  };

  state.profiles.set(userId, updated);
  return clone(updated);
};

const addDisciplineToProfile = (userId, disciplineDelta) => {
  const profile = state.profiles.get(userId);
  if (!profile) {
    return null;
  }

  const updated = {
    ...profile,
    discipline: Math.max(0, (profile.discipline || 0) + disciplineDelta),
    updatedAt: new Date().toISOString(),
  };

  state.profiles.set(userId, updated);
  return clone(updated);
};

const createExpense = (input) => {
  const timestamp = new Date().toISOString();
  const expense = {
    id: nextId('expense'),
    userId: input.userId,
    text: input.text || null,
    amount: input.amount,
    currency: input.currency || 'VND',
    category: input.category || null,
    occurredAt: input.occurredAt || timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  state.expenses.push(expense);
  return clone(expense);
};

const createSpendingUrge = (input) => {
  const timestamp = new Date().toISOString();
  const urge = {
    id: nextId('urge'),
    userId: input.userId,
    itemName: input.itemName,
    amount: input.amount,
    reason: input.reason,
    detectedTrigger: input.detectedTrigger,
    suggestedAction: input.suggestedAction,
    status: 'PENDING',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  state.spendingUrges.push(urge);
  return clone(urge);
};

const listExpensesByUserId = (userId, { page = 1, pageSize = 20 } = {}) => {
  const items = state.expenses
    .filter((expense) => expense.userId === userId)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = (page - 1) * pageSize;

  return {
    items: clone(items.slice(start, start + pageSize)),
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
    },
  };
};

const sumExpensesByUserId = (userId) =>
  state.expenses
    .filter((expense) => expense.userId === userId)
    .reduce((total, expense) => total + expense.amount, 0);

const getBossState = (userId) => {
  const existingBoss = state.bossStates.get(userId);
  if (existingBoss) {
    return clone(existingBoss);
  }

  const boss = {
    bossId: 'impulse-boss',
    name: 'Impulse Boss',
    currentHp: 100,
    maxHp: 100,
  };

  state.bossStates.set(userId, boss);
  return clone(boss);
};

const damageBoss = (userId, damage) => {
  const boss = getBossState(userId);
  const updated = {
    ...boss,
    currentHp: Math.max(0, boss.currentHp - damage),
  };

  state.bossStates.set(userId, updated);
  return clone(updated);
};

const challengeStatusKey = (userId, challengeId) => `${userId}:${challengeId}`;

const findChallengeById = (challengeId) => {
  const challenge = challengeTemplates.find((item) => item.id === challengeId);
  return challenge ? clone(challenge) : null;
};

const listActiveChallenges = (userId) =>
  clone(
    challengeTemplates
      .filter((challenge) => state.challengeStatuses.get(challengeStatusKey(userId, challenge.id)) !== 'completed')
      .map((challenge) => ({
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        rewardXp: challenge.rewardXp,
        bossDamage: challenge.bossDamage,
        difficulty: challenge.difficulty,
        status: 'active',
      }))
  );

const completeChallenge = (userId, challengeId) => {
  const challenge = findChallengeById(challengeId);
  if (!challenge) {
    return null;
  }

  const key = challengeStatusKey(userId, challengeId);
  if (state.challengeStatuses.get(key) === 'completed') {
    return {
      alreadyCompleted: true,
      challenge: {
        ...challenge,
        status: 'completed',
      },
    };
  }

  state.challengeStatuses.set(key, 'completed');

  return {
    alreadyCompleted: false,
    challenge: {
      id: challenge.id,
      title: challenge.title,
      description: challenge.description,
      rewardXp: challenge.rewardXp,
      bossDamage: challenge.bossDamage,
      difficulty: challenge.difficulty,
      status: 'completed',
    },
  };
};

module.exports = {
  addDisciplineToProfile,
  addXpToProfile,
  completeChallenge,
  createExpense,
  createProfile,
  createSpendingUrge,
  damageBoss,
  findChallengeById,
  findProfileByUserId,
  getBossState,
  listActiveChallenges,
  listExpensesByUserId,
  resetMockData,
  sumExpensesByUserId,
  updateProfile,
};
