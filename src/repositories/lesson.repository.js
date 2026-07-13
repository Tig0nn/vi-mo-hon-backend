const { getSupabaseClient } = require('../config/supabase');

const LESSON_COLUMNS = [
  'id',
  'boss_id',
  'title',
  'summary',
  'cards',
  'question',
  'answers',
  'reward_xp',
  'knowledge_reward',
  'sort_order',
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

const toSafeInteger = (value, field) => {
  const numberValue = Number(value);
  if (!Number.isSafeInteger(numberValue)) throw new Error(`Unsafe database ${field}`);
  return numberValue;
};

const toApiLesson = (row, status = 'available') => ({
  id: row.id,
  bossId: row.boss_id,
  title: row.title,
  summary: row.summary,
  cards: (Array.isArray(row.cards) ? row.cards : []).map((card, index) => ({
    id: card && card.id ? String(card.id) : `card-${index + 1}`,
    title: card && card.title ? String(card.title) : '',
    body: card && card.body ? String(card.body) : '',
  })),
  quiz: {
    question: row.question,
    answers: (Array.isArray(row.answers) ? row.answers : []).map((answer) => ({
      id: answer && answer.id ? String(answer.id) : '',
      label: answer && answer.label ? String(answer.label) : '',
    })),
  },
  rewardXp: toSafeInteger(row.reward_xp, 'reward_xp'),
  knowledgeReward: toSafeInteger(row.knowledge_reward, 'knowledge_reward'),
  status: status === 'completed' ? 'completed' : 'available',
});

const listLessons = async (userId, bossId) => {
  const [{ data: lessons, error: lessonError }, { data: progress, error: progressError }] =
    await Promise.all([
      getClient()
        .from('financial_lessons')
        .select(LESSON_COLUMNS)
        .eq('boss_id', bossId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      getClient()
        .from('user_lesson_progress')
        .select('lesson_id, status')
        .eq('user_id', userId),
    ]);

  if (lessonError || progressError) throw lessonError || progressError;
  const statusByLessonId = new Map(
    (progress || []).map((row) => [row.lesson_id, row.status]),
  );
  return (lessons || []).map((row) => toApiLesson(row, statusByLessonId.get(row.id)));
};

const completeLesson = async (userId, lessonId, answerId) => {
  const { data, error } = await getClient().rpc('complete_financial_lesson_v1', {
    p_user_id: userId,
    p_lesson_id: lessonId,
    p_answer_id: answerId,
  });
  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : data;
  if (!result || result.outcome !== 'success') {
    return {
      outcome: result && result.outcome,
      explanation: result && result.explanation,
    };
  }

  return {
    outcome: result.outcome,
    lessonId: result.lesson_id,
    progression: {
      xpGained: toSafeInteger(result.reward_xp, 'reward_xp'),
      knowledgeGained: toSafeInteger(result.knowledge_reward, 'knowledge_reward'),
      totalXp: toSafeInteger(result.xp, 'xp'),
      level: toSafeInteger(result.level, 'level'),
      knowledge: toSafeInteger(result.knowledge, 'knowledge'),
    },
    explanation: result.explanation || '',
  };
};

module.exports = {
  clearSupabaseClientForTest,
  completeLesson,
  listLessons,
  setSupabaseClientForTest,
  toApiLesson,
};
