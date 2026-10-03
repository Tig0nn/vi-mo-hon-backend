const { getSupabaseClient } = require('../config/supabase');

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

// Fallback in-memory storage for environments where game_sessions table is not yet migrated
const fallbackSessions = [];

const getDailySessionsCount = async (userId, dateStr) => {
  try {
    const client = getClient();
    const { data, error } = await client
      .from('game_sessions')
      .select('id, session_date, created_at')
      .eq('user_id', userId);

    if (!error && Array.isArray(data)) {
      return data.filter((row) => {
        const rowDate = row.session_date || (row.created_at ? row.created_at.slice(0, 10) : null);
        return rowDate === dateStr;
      }).length;
    }
  } catch (err) {
    // Fall back to in-memory store
  }

  return fallbackSessions.filter((row) => row.userId === userId && row.sessionDate === dateStr).length;
};

const getAccumulatedGameDamage = async (userId, bossId) => {
  try {
    const client = getClient();
    const { data, error } = await client
      .from('game_sessions')
      .select('boss_damage_awarded, boss_id')
      .eq('user_id', userId)
      .eq('boss_id', bossId);

    if (!error && Array.isArray(data)) {
      return data.reduce((sum, row) => sum + (Number(row.boss_damage_awarded) || 0), 0);
    }
  } catch (err) {
    // Fall back to in-memory store
  }

  return fallbackSessions
    .filter((row) => row.userId === userId && row.bossId === bossId)
    .reduce((sum, row) => sum + (Number(row.bossDamageAwarded) || 0), 0);
};

const recordGameSession = async (sessionData) => {
  const row = {
    user_id: sessionData.userId,
    session_id: sessionData.sessionId,
    boss_id: sessionData.bossId,
    duration_seconds: sessionData.durationSeconds || 0,
    obstacles_dodged: sessionData.obstaclesDodged || 0,
    coins_collected: sessionData.coinsCollected || 0,
    points_awarded: sessionData.pointsAwarded || 0,
    boss_damage_awarded: sessionData.bossDamageAwarded || 0,
    is_verified: sessionData.isVerified !== false,
    session_date: sessionData.sessionDate,
    created_at: new Date().toISOString()
  };

  try {
    const client = getClient();
    const { error } = await client.from('game_sessions').insert(row);
    if (error) {
      fallbackSessions.push({
        userId: sessionData.userId,
        sessionId: sessionData.sessionId,
        bossId: sessionData.bossId,
        bossDamageAwarded: sessionData.bossDamageAwarded || 0,
        sessionDate: sessionData.sessionDate,
        createdAt: row.created_at
      });
    }
  } catch (err) {
    fallbackSessions.push({
      userId: sessionData.userId,
      sessionId: sessionData.sessionId,
      bossId: sessionData.bossId,
      bossDamageAwarded: sessionData.bossDamageAwarded || 0,
      sessionDate: sessionData.sessionDate,
      createdAt: row.created_at
    });
  }

  return row;
};

const updateUserRewards = async (userId, { savingsAwarded, knowledgeAwarded }) => {
  const client = getClient();
  const { data: currentProgress, error: fetchErr } = await client
    .from('user_progress')
    .select('user_id, savings, knowledge')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchErr) throw fetchErr;

  const currentSavings = Number(currentProgress?.savings || 0);
  const currentKnowledge = Number(currentProgress?.knowledge || 0);

  const updatedSavings = currentSavings + Math.max(0, savingsAwarded || 0);
  const updatedKnowledge = currentKnowledge + Math.max(0, knowledgeAwarded || 0);

  const { error: updateErr } = await client
    .from('user_progress')
    .update({
      savings: updatedSavings,
      knowledge: updatedKnowledge,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  if (updateErr) throw updateErr;

  return {
    savings: updatedSavings,
    knowledge: updatedKnowledge
  };
};

const clearFallbackSessionsForTest = () => {
  fallbackSessions.length = 0;
};

module.exports = {
  clearFallbackSessionsForTest,
  clearSupabaseClientForTest,
  getAccumulatedGameDamage,
  getDailySessionsCount,
  recordGameSession,
  setSupabaseClientForTest,
  updateUserRewards
};
