const { getSupabaseClient } = require('../config/supabase');

let supabaseClientOverride = null;
const getClient = () => supabaseClientOverride || getSupabaseClient();
const setSupabaseClientForTest = (client) => { if (process.env.NODE_ENV !== 'test') throw new Error('setSupabaseClientForTest can only be used in test'); supabaseClientOverride = client; };
const clearSupabaseClientForTest = () => { if (process.env.NODE_ENV !== 'test') throw new Error('clearSupabaseClientForTest can only be used in test'); supabaseClientOverride = null; };

const findBossState = async (userId) => {
  const { data, error } = await getClient().from('user_boss_progress')
    .select('current_hp, status, bosses!inner(id, name, max_hp)').eq('user_id', userId).eq('boss_id', 'impulse-boss').maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { bossId: data.bosses.id, name: data.bosses.name, currentHp: Number(data.current_hp), maxHp: Number(data.bosses.max_hp) };
};

module.exports = { clearSupabaseClientForTest, findBossState, setSupabaseClientForTest };
