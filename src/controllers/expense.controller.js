const expenseService = require('../services/expense.service');
const { sendError, sendSuccess } = require('../utils/response');
const { formatZodErrors } = require('../utils/validation');
const { paginationSchema, quickExpenseSchema } = require('../validators/expense.validator');

const createQuickExpense = async (req, res, next) => {
  const result = quickExpenseSchema.safeParse(req.body);
  if (!result.success) {
    return sendError(res, 'Validation failed', 422, formatZodErrors(result.error));
  }

  try {
    return sendSuccess(res, await expenseService.createQuickExpense(result.data), 'Expense recorded', 201);
  } catch (error) {
    return next(error);
  }
};

const listExpenses = async (req, res, next) => {
  const result = paginationSchema.safeParse(req.query);
  if (!result.success) {
    return sendError(res, 'Validation failed', 422, formatZodErrors(result.error));
  }

  try {
    return sendSuccess(res, await expenseService.listExpenses(result.data), 'Expenses retrieved', 200);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createQuickExpense,
  listExpenses,
};
