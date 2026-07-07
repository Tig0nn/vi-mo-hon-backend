const expenseService = require('../services/expense.service');
const { sendError, sendSuccess } = require('../utils/response');
const { formatZodErrors } = require('../utils/validation');
const { paginationSchema, quickExpenseSchema } = require('../validators/expense.validator');

const createQuickExpense = (req, res, next) => {
  const result = quickExpenseSchema.safeParse(req.body);
  if (!result.success) {
    return sendError(res, 'Validation failed', 422, formatZodErrors(result.error));
  }

  try {
    return sendSuccess(res, expenseService.createQuickExpense(result.data), 'Expense recorded', 201);
  } catch (error) {
    return next(error);
  }
};

const listExpenses = (req, res) => {
  const result = paginationSchema.safeParse(req.query);
  if (!result.success) {
    return sendError(res, 'Validation failed', 422, formatZodErrors(result.error));
  }

  return sendSuccess(res, expenseService.listExpenses(result.data), 'Expenses retrieved', 200);
};

module.exports = {
  createQuickExpense,
  listExpenses,
};
