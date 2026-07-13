const { getSupabaseClient } = require('../config/supabase');

let supabaseClientOverride = null;
const getClient = () => supabaseClientOverride || getSupabaseClient();
const setSupabaseClientForTest = (client) => { if (process.env.NODE_ENV !== 'test') throw new Error('setSupabaseClientForTest can only be used in test'); supabaseClientOverride = client; };
const clearSupabaseClientForTest = () => { if (process.env.NODE_ENV !== 'test') throw new Error('clearSupabaseClientForTest can only be used in test'); supabaseClientOverride = null; };

const toApiChallenge = (row, status = row.status) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  rewardXp: Number(row.reward_xp),
  bossDamage: Number(row.hp_damage),
  disciplineReward: Number(row.discipline_reward),
  difficulty: row.difficulty,
  sequenceOrder: Number(row.sequence_order),
  assignedDate: row.assigned_date || null,
  status,
});

const ensureDefaultGameState = async (userId) => {
  const { data, error } = await getClient().rpc('ensure_default_game_state_v1', { p_user_id: userId });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  return result && result.outcome;
};

const listActiveChallenges = async (userId) => {
  const { data, error } = await getClient().from('user_challenges')
    .select('status, assigned_date, challenges!inner(id, title, description, reward_xp, hp_damage, discipline_reward, difficulty, sequence_order, is_active)')
    .eq('user_id', userId).eq('status', 'active').eq('challenges.is_active', true);
  if (error) throw error;
  return (data || []).map((row) => toApiChallenge({ ...row.challenges, assigned_date: row.assigned_date }, row.status));
};

const getBossChallengeStats = async (userId, bossId) => {
  const [{ data, error }, { data: definitions, error: definitionError }] = await Promise.all([
    getClient().from('user_challenges')
    .select('status, completed_at, challenges!inner(linked_boss_id)')
    .eq('user_id', userId).eq('challenges.linked_boss_id', bossId),
    getClient().from('challenges').select('id').eq('linked_boss_id', bossId).eq('is_active', true),
  ]);
  if (error || definitionError) throw error || definitionError;
  const rows = data || [];
  const completed = rows.filter((row) => row.status === 'completed');
  return {
    completedChallenges: completed.length,
    totalChallenges: (definitions || []).length,
    lastCompletedAt: completed.map((row) => row.completed_at).filter(Boolean).sort().at(-1) || null,
  };
};

const completeChallenge = async (userId, challengeId) => {
  const { data, error } = await getClient().rpc('complete_challenge_v1', { p_user_id: userId, p_challenge_id: challengeId });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || result.outcome !== 'success') return { outcome: result && result.outcome };
  return {
    outcome: result.outcome,
    challenge: toApiChallenge({ id: result.challenge_id, title: result.title, description: result.description, reward_xp: result.reward_xp, hp_damage: result.hp_damage, discipline_reward: result.discipline_reward, difficulty: result.difficulty, sequence_order: result.sequence_order, assigned_date: result.assigned_date }, result.challenge_status),
    progression: { xpGained: Number(result.reward_xp), totalXp: Number(result.xp), level: Number(result.level), disciplineGained: Number(result.discipline_reward), discipline: Number(result.discipline) },
    boss: { bossId: result.boss_id, name: result.boss_name, currentHp: Number(result.current_hp), maxHp: Number(result.max_hp) },
  };
};

module.exports = { clearSupabaseClientForTest, completeChallenge, ensureDefaultGameState, getBossChallengeStats, listActiveChallenges, setSupabaseClientForTest, toApiChallenge };
