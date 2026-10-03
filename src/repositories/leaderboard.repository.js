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

// Resilient fallback participants if Supabase is offline or encountering clock-skew JWT issues
const FALLBACK_LEADERBOARD_USERS = [
  { userId: 'user_bot_1', displayName: 'Tuấn Kỷ Luật', level: 6, xp: 620, discipline: 380, streak: 28 },
  { userId: 'user_bot_2', displayName: 'Lan Khắc Tinh Shopee', level: 5, xp: 510, discipline: 290, streak: 21 },
  { userId: 'user_bot_3', displayName: 'Huy Không Trà Sữa', level: 4, xp: 430, discipline: 210, streak: 14 },
  { userId: 'user_bot_4', displayName: 'Mai Tiết Kiệm', level: 4, xp: 390, discipline: 180, streak: 12 },
  { userId: 'user_bot_5', displayName: 'Bảo Nhịn Quẹt Thẻ', level: 3, xp: 280, discipline: 130, streak: 9 },
  { userId: 'user_bot_6', displayName: 'Chiến Binh GenZ', level: 2, xp: 190, discipline: 95, streak: 6 },
  { userId: 'user_bot_7', displayName: 'An Tập Sự', level: 1, xp: 80, discipline: 45, streak: 3 },
];

const getLeaderboardRawData = async () => {
  try {
    const client = getClient();

    // Fetch profiles and user_progress
    const [profilesRes, progressRes] = await Promise.all([
      client.from('profiles').select('user_id, display_name'),
      client.from('user_progress').select('user_id, xp, level, discipline, streak, current_streak'),
    ]);

    if (profilesRes.error) throw profilesRes.error;
    if (progressRes.error) throw progressRes.error;

    const profiles = profilesRes.data || [];
    const progressRows = progressRes.data || [];

    if (profiles.length > 0) {
      const progressMap = new Map();
      progressRows.forEach((p) => {
        progressMap.set(p.user_id, p);
      });

      return profiles.map((prof) => {
        const prog = progressMap.get(prof.user_id) || {};
        const streak = Number(prog.streak ?? prog.current_streak ?? 1);
        const discipline = Number(prog.discipline ?? 0);
        const level = Number(prog.level ?? 1);
        const xp = Number(prog.xp ?? 0);

        return {
          userId: prof.user_id,
          displayName: prof.display_name || 'Chiến Binh Mỏ Hỗn',
          level,
          xp,
          discipline,
          streak,
        };
      });
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'test' && supabaseClientOverride) {
      throw err;
    }
    console.warn('[Leaderboard] Supabase query failed, using fallback cohort:', err.message);
  }

  return FALLBACK_LEADERBOARD_USERS;
};

module.exports = {
  FALLBACK_LEADERBOARD_USERS,
  clearSupabaseClientForTest,
  getLeaderboardRawData,
  setSupabaseClientForTest,
};
