const { getSupabaseClient } = require('../config/supabase');

const EXPENSE_COLUMNS = 'id, user_id, title, raw_text, amount, category, spent_at, created_at';
const API_CATEGORY_BY_DATABASE_CATEGORY = {
  food_drink: 'FOOD_DRINK',
  shopping: 'SHOPPING',
  entertainment: 'ENTERTAINMENT',
  transport: 'TRANSPORT',
  education: 'EDUCATION',
  saving: 'SAVING',
  other: 'OTHER',
};
const DATABASE_CATEGORIES = new Set(Object.keys(API_CATEGORY_BY_DATABASE_CATEGORY));

let supabaseClientOverride = null;
const getClient = () => supabaseClientOverride || getSupabaseClient();

const setSupabaseClientForTest = (client) => {
  if (process.env.NODE_ENV !== 'test') throw new Error('setSupabaseClientForTest can only be used in test');
  supabaseClientOverride = client;
};
const clearSupabaseClientForTest = () => {
  if (process.env.NODE_ENV !== 'test') throw new Error('clearSupabaseClientForTest can only be used in test');
  supabaseClientOverride = null;
};

const normalizeCategory = (category) => {
  const normalized = String(category || 'other').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return DATABASE_CATEGORIES.has(normalized) ? normalized : 'other';
};

const toSafeNumber = (value, field) => {
  const numberValue = Number(value);
  if (!Number.isSafeInteger(numberValue)) throw new Error(`Unsafe database ${field}`);
  return numberValue;
};

const toApiExpense = (row) => ({
  id: row.id,
  userId: row.user_id,
  text: row.raw_text || null,
  amount: toSafeNumber(row.amount, 'amount'),
  currency: 'VND',
  category: API_CATEGORY_BY_DATABASE_CATEGORY[row.category] || String(row.category || 'other').toUpperCase(),
  occurredAt: row.spent_at,
  createdAt: row.created_at,
});

const recordExpenseAndAddXp = async ({ userId, title, amount, category, text, occurredAt }) => {
  const { data, error } = await getClient().rpc('record_expense_and_add_xp_v1', {
    p_user_id: userId,
    p_title: title,
    p_amount: amount,
    p_category: normalizeCategory(category),
    p_raw_text: text || null,
    p_spent_at: occurredAt || new Date().toISOString(),
    p_xp_reward: 5,
  });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  return {
    outcome: result && result.outcome,
    expense: result && result.outcome === 'success' ? toApiExpense({
      id: result.expense_id, user_id: result.user_id, title: result.title, raw_text: result.raw_text,
      amount: result.amount, category: result.category, spent_at: result.spent_at, created_at: result.created_at,
    }) : null,
    progression: result && result.outcome === 'success' ? { xpGained: 5, totalXp: toSafeNumber(result.xp, 'xp'), level: toSafeNumber(result.level, 'level') } : null,
  };
};

const listExpensesByUserId = async (userId, { page, pageSize }) => {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await getClient().from('expenses').select(EXPENSE_COLUMNS, { count: 'exact' })
    .eq('user_id', userId).order('spent_at', { ascending: false }).order('created_at', { ascending: false }).range(from, to);
  if (error) throw error;
  const totalItems = count || 0;
  return { items: (data || []).map(toApiExpense), pagination: { page, pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)) } };
};

const sumExpensesForUtcMonth = async (userId, start, end) => {
  const { data, error } = await getClient().from('expenses').select('amount').eq('user_id', userId)
    .gte('spent_at', start).lt('spent_at', end);
  if (error) throw error;
  return (data || []).reduce((total, item) => total + toSafeNumber(item.amount, 'amount'), 0);
};

const sumExpensesByUserId = async (userId) => {
  const { data, error } = await getClient().from('expenses').select('amount').eq('user_id', userId);
  if (error) throw error;
  return (data || []).reduce((total, item) => total + toSafeNumber(item.amount, 'amount'), 0);
};

module.exports = { clearSupabaseClientForTest, listExpensesByUserId, normalizeCategory, recordExpenseAndAddXp, setSupabaseClientForTest, sumExpensesByUserId, sumExpensesForUtcMonth, toApiExpense };
