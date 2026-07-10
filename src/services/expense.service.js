const { createHttpError } = require('../utils/httpError');
const { parseMoneyText } = require('../utils/parseMoneyText');
const expenseRepository = require('../repositories/expense.repository');
const profileService = require('./profile.service');

const getSafeSupabaseErrorDetails = (error) => ({
  message: error && error.message ? error.message : 'Unknown database error',
  code: error && error.code ? error.code : undefined,
  hint: error && error.hint ? error.hint : undefined,
});

const handleDatabaseError = (error) => {
  console.error('[Supabase] expense operation failed', getSafeSupabaseErrorDetails(error));
  throw createHttpError(500, 'Database error');
};

const deriveTitle = (text) => {
  if (!text) return 'Chi tiêu';
  const withoutAmount = text.replace(/\b\d[\d.,kKmMđ₫]*/g, ' ').replace(/\s+/g, ' ').trim();
  return withoutAmount || 'Chi tiêu';
};

const createQuickExpense = async (input) => {
  await profileService.getProfile(input.userId);

  const amount = input.amount !== undefined ? input.amount : parseMoneyText(input.text);
  if (!amount) {
    throw createHttpError(422, 'Validation failed', {
      amount: ['Unable to infer amount from text'],
    });
  }

  let result;
  try {
    result = await expenseRepository.recordExpenseAndAddXp({
      ...input,
      amount,
      title: deriveTitle(input.text),
    });
  } catch (error) {
    handleDatabaseError(error);
  }

  if (result.outcome === 'profile_not_found') throw createHttpError(404, 'Profile not found');
  if (result.outcome !== 'success') throw createHttpError(500, 'Database error');

  return {
    expense: result.expense,
    progression: result.progression,
  };
};

const listExpenses = async (params) => {
  try {
    return await expenseRepository.listExpensesByUserId(params.userId, params);
  } catch (error) {
    handleDatabaseError(error);
  }
};

module.exports = {
  createQuickExpense,
  deriveTitle,
  listExpenses,
};
