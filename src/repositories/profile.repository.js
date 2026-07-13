const { getSupabaseClient } = require('../config/supabase');

const PROFILE_COLUMNS = [
  'user_id',
  'display_name',
  'monthly_budget',
  'main_goal',
  'target_amount',
  'target_date',
  'triggers',
  'preferred_tone',
  'created_at',
  'updated_at',
].join(', ');

let supabaseClientOverride = null;

const getClient = () => supabaseClientOverride || getSupabaseClient();

const setSupabaseClientForTest = (client) => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setSupabaseClientForTest can only be used in test');
  }

  supabaseClientOverride = client;
};

const clearSupabaseClientForTest = () => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('clearSupabaseClientForTest can only be used in test');
  }

  supabaseClientOverride = null;
};

const removeUndefined = (value) =>
  Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));

const toApiProfile = (row, progress = null) => {
  if (!row) {
    return null;
  }

  const discipline = Number(progress && progress.discipline !== undefined ? progress.discipline : 0);
  const savings = Number(progress && progress.savings !== undefined ? progress.savings : 0);
  const knowledge = Number(progress && progress.knowledge !== undefined ? progress.knowledge : 0);

  return {
    id: row.id || row.user_id,
    userId: row.user_id,
    displayName: row.display_name,
    monthlyBudget: row.monthly_budget,
    currency: 'VND',
    level: progress && progress.level !== undefined ? progress.level : 1,
    xp: progress && progress.xp !== undefined ? progress.xp : 0,
    discipline,
    savings,
    knowledge,
    wealth: discipline + savings + knowledge,
    mainGoal: row.main_goal,
    targetAmount: row.target_amount,
    targetDate: row.target_date,
    triggers: row.triggers || [],
    preferredTone: row.preferred_tone || 'funny',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const toProfileRow = (profileData) =>
  removeUndefined({
    user_id: profileData.userId,
    display_name: profileData.displayName,
    monthly_budget: profileData.monthlyBudget,
    main_goal: profileData.mainGoal,
    target_amount: profileData.targetAmount,
    target_date: profileData.targetDate,
    triggers: profileData.triggers,
    preferred_tone: profileData.preferredTone,
    updated_at: new Date().toISOString(),
  });

const toProfileUpdateRow = (changes) =>
  removeUndefined({
    display_name: changes.displayName,
    monthly_budget: changes.monthlyBudget,
    main_goal: changes.mainGoal,
    target_amount: changes.targetAmount,
    target_date: changes.targetDate,
    triggers: changes.triggers,
    preferred_tone: changes.preferredTone,
    updated_at: new Date().toISOString(),
  });

const findProfileByUserId = async (userId) => {
  const { data, error } = await getClient()
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const progress = await findUserProgressByUserId(userId);
  return toApiProfile(data, progress);
};

const upsertProfile = async (profileData) => {
  const { data, error } = await getClient()
    .from('profiles')
    .upsert(toProfileRow(profileData), { onConflict: 'user_id' })
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  const progress = await findUserProgressByUserId(profileData.userId);
  return toApiProfile(data, progress);
};

const updateProfile = async (userId, changes) => {
  const { data, error } = await getClient()
    .from('profiles')
    .update(toProfileUpdateRow(changes))
    .eq('user_id', userId)
    .select(PROFILE_COLUMNS)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const progress = await findUserProgressByUserId(userId);
  return toApiProfile(data, progress);
};

const findUserProgressByUserId = async (userId) => {
  const { data, error } = await getClient()
    .from('user_progress')
    .select('user_id, xp, level, discipline, savings, knowledge')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

const ensureUserProgress = async (userId) => {
  const { error } = await getClient()
    .from('user_progress')
    .upsert(
      {
        user_id: userId,
        xp: 0,
        level: 1,
        discipline: 0,
        savings: 0,
        knowledge: 0,
      },
      {
        onConflict: 'user_id',
        ignoreDuplicates: true,
      }
    );

  if (error) {
    throw error;
  }
};

const ensureDefaultGameState = async (userId) => {
  const { data, error } = await getClient().rpc('ensure_default_game_state_v1', {
    p_user_id: userId,
  });

  if (error) {
    throw error;
  }

  const result = Array.isArray(data) ? data[0] : data;
  return result && result.outcome;
};

module.exports = {
  clearSupabaseClientForTest,
  ensureDefaultGameState,
  ensureUserProgress,
  findProfileByUserId,
  setSupabaseClientForTest,
  toApiProfile,
  toProfileRow,
  updateProfile,
  upsertProfile,
};
