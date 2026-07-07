const mockStore = require('../data/mockStore');
const { createHttpError } = require('../utils/httpError');
const { parseMoneyText } = require('../utils/parseMoneyText');
const progressionService = require('./progression.service');

const createQuickExpense = (input) => {
  const profile = mockStore.findProfileByUserId(input.userId);
  if (!profile) {
    throw createHttpError(404, 'Profile not found');
  }

  const amount = input.amount || parseMoneyText(input.text);
  if (!amount) {
    throw createHttpError(422, 'Validation failed', {
      amount: ['Unable to infer amount from text'],
    });
  }

  const expense = mockStore.createExpense({
    ...input,
    amount,
    currency: profile.currency,
  });
  const progression = progressionService.addExpenseXp(input.userId);

  return {
    expense,
    progression,
  };
};

const listExpenses = (params) => mockStore.listExpensesByUserId(params.userId, params);

module.exports = {
  createQuickExpense,
  listExpenses,
};
