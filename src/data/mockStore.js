const state = {
  profiles: new Map(),
  expenses: [],
  counters: {
    profile: 1,
    expense: 1,
  },
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const nextId = (prefix) => {
  const value = state.counters[prefix];
  state.counters[prefix] += 1;
  return `${prefix}_${String(value).padStart(3, '0')}`;
};

const resetMockData = () => {
  state.profiles.clear();
  state.expenses = [];
  state.counters = {
    profile: 1,
    expense: 1,
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

const getInitialBossState = () => ({
  bossId: 'impulse-boss',
  name: 'Impulse Boss',
  currentHp: 100,
  maxHp: 100,
});

module.exports = {
  addXpToProfile,
  createExpense,
  createProfile,
  findProfileByUserId,
  getInitialBossState,
  listExpensesByUserId,
  resetMockData,
  sumExpensesByUserId,
  updateProfile,
};
