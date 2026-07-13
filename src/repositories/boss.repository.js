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
  if (!row) return null;
  return { bossId: row.bosses.id, name: row.bosses.name, currentHp: Number(row.current_hp), maxHp: Number(row.bosses.max_hp), status: row.status };
};

module.exports = { clearSupabaseClientForTest, findBossState, setSupabaseClientForTest };
