const express = require('express');
const expenseController = require('../controllers/expense.controller');

const router = express.Router();

router.post('/quick-input', expenseController.createQuickExpense);
router.get('/', expenseController.listExpenses);

module.exports = router;
