const { getSupabaseClient } = require('../config/supabase');

let supabaseClientOverride = null;
const getClient = () => supabaseClientOverride || getSupabaseClient();
const setSupabaseClientForTest = (client) => { if (process.env.NODE_ENV !== 'test') throw new Error('setSupabaseClientForTest can only be used in test'); supabaseClientOverride = client; };
const clearSupabaseClientForTest = () => { if (process.env.NODE_ENV !== 'test') throw new Error('clearSupabaseClientForTest can only be used in test'); supabaseClientOverride = null; };

const findBossState = async (userId) => {
  const { data, error } = await getClient().from('user_boss_progress')
    .select('boss_id, current_hp, status, started_at, bosses!inner(id, name, max_hp)')
    .eq('user_id', userId)
    .order('started_at', { ascending: true })
    .order('boss_id', { ascending: true });
  if (error) throw error;
  const rows = data || [];
  const row = rows.find((item) => item.status === 'active') || rows[rows.length - 1];
  return { bossId: row.bosses.id, name: row.bosses.name, currentHp: Number(row.current_hp), maxHp: Number(row.bosses.max_hp), status: row.status };
};

const updateBossHp = async (userId, bossId, newHp, status = null) => {
  const finalStatus = status || (newHp <= 0 ? 'defeated' : 'active');
  const clampedHp = Math.max(0, newHp);
  const { data, error } = await getClient()
    .from('user_boss_progress')
    .update({
      current_hp: clampedHp,
      status: finalStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('boss_id', bossId);
  if (error) throw error;
  return { bossId, currentHp: clampedHp, status: finalStatus };
};

module.exports = { clearSupabaseClientForTest, findBossState, setSupabaseClientForTest, updateBossHp };
