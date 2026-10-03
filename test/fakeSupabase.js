const createFakeSupabaseClient = () => {
  const challengeRows = [
    ['challenge-1', 'Không uống trà sữa hôm nay', 1, 5],
    ['challenge-2', 'Ghi lại mọi khoản mua đồ uống', 2, 5],
    ['challenge-3', 'Không mua đồ uống sau 20:00', 3, 5],
    ['challenge-4', 'Chọn món rẻ hơn bình thường', 4, 5],
    ['challenge-5', 'Giữ chi tiêu đồ uống dưới 30.000đ', 5, 8],
  ];
  const lessonRows = [
    {
      id: 'bubble-tea-small-costs', boss_id: 'bubble-tea-monster',
      title: '45.000đ có thật sự nhỏ?',
      summary: 'Nhìn thấy chi phí tích lũy của những khoản nhỏ lặp lại.',
      cards: [
        { id: 'card-1', title: 'Một lần thì nhỏ', body: 'Một ly trà sữa 45.000đ nghe có vẻ không đáng kể.' },
        { id: 'card-2', title: 'Lặp lại thì khác', body: 'Uống 3 ly mỗi tuần tương đương khoảng 540.000đ trong 4 tuần.' },
        { id: 'card-3', title: 'Một năm là bao nhiêu?', body: 'Duy trì thói quen đó trong 52 tuần có thể tốn khoảng 7.020.000đ.' },
        { id: 'card-4', title: 'Điểm cần nhớ', body: 'Vấn đề không nằm ở một ly, mà ở khoản chi lặp lại nhưng không được để ý.' },
      ],
      question: 'Một ly giá 45.000đ, uống 3 ly mỗi tuần trong 4 tuần thì tốn khoảng bao nhiêu?',
      answers: [
        { id: 'a', label: '135.000đ' }, { id: 'b', label: '360.000đ' },
        { id: 'c', label: '540.000đ' }, { id: 'd', label: '1.350.000đ' },
      ],
      correct_answer_id: 'c', explanation: '45.000 × 3 × 4 = 540.000đ.',
      reward_xp: 20, knowledge_reward: 2, sort_order: 1, is_active: true,
    },
    {
      id: 'bubble-tea-trigger', boss_id: 'bubble-tea-monster',
      title: 'Nhu cầu hay thói quen?',
      summary: 'Nhận ra điều gì đang kích hoạt quyết định mua đồ uống.',
      cards: [
        { id: 'card-1', title: 'Có lúc là nhu cầu thật', body: 'Bạn có thể mua vì đang khát hoặc thực sự muốn thưởng thức.' },
        { id: 'card-2', title: 'Có lúc là phản xạ', body: 'Đi ngang cửa hàng, thấy bạn bè mua hoặc thấy quảng cáo cũng có thể khiến bạn muốn đặt ngay.' },
        { id: 'card-3', title: 'Đó là tác nhân kích hoạt', body: 'Tác nhân kích hoạt khiến quyết định xảy ra nhanh, dù trước đó bạn không có kế hoạch mua.' },
        { id: 'card-4', title: 'Câu hỏi trước khi mua', body: 'Mình thật sự muốn uống, hay chỉ đang phản ứng với hoàn cảnh?' },
      ],
      question: 'Tình huống nào có thể là tác nhân khiến bạn mua trà sữa ngoài kế hoạch?',
      answers: [
        { id: 'a', label: 'Bạn bè rủ' }, { id: 'b', label: 'Thấy quảng cáo giảm giá' },
        { id: 'c', label: 'Đang buồn và muốn tự thưởng' }, { id: 'd', label: 'Tất cả các tình huống trên' },
      ],
      correct_answer_id: 'd',
      explanation: 'Bạn bè, quảng cáo và cảm xúc đều có thể kích hoạt một khoản chi ngoài kế hoạch.',
      reward_xp: 20, knowledge_reward: 2, sort_order: 2, is_active: true,
    },
    {
      id: 'bubble-tea-promotion', boss_id: 'bubble-tea-monster',
      title: 'Khuyến mãi có luôn là tiết kiệm?',
      summary: 'Phân biệt giảm giá thật với việc bị khuyến mãi kéo vào một khoản chi mới.',
      cards: [
        { id: 'card-1', title: 'Giảm giá chưa chắc là tiết kiệm', body: 'Giảm 20.000đ không có nghĩa bạn tiết kiệm 20.000đ.' },
        { id: 'card-2', title: 'So với kế hoạch ban đầu', body: 'Nếu ban đầu bạn không định mua, số tiền thanh toán vẫn là một khoản chi mới.' },
        { id: 'card-3', title: 'Combo cũng có thể làm bạn chi nhiều', body: 'Mua hai ly vì rẻ hơn mỗi ly vẫn có thể tốn nhiều hơn nhu cầu thực tế.' },
        { id: 'card-4', title: 'Quy tắc đơn giản', body: 'Khuyến mãi chỉ giúp tiết kiệm khi món đó đã nằm trong kế hoạch.' },
      ],
      question: 'Bạn không định mua, nhưng đặt một ly 50.000đ vì có mã giảm 20.000đ. Điều gì đã xảy ra?',
      answers: [
        { id: 'a', label: 'Tiết kiệm được 20.000đ' }, { id: 'b', label: 'Chi thêm 30.000đ ngoài kế hoạch' },
        { id: 'c', label: 'Không tốn tiền vì có mã giảm' }, { id: 'd', label: 'Không thể xác định' },
      ],
      correct_answer_id: 'b',
      explanation: 'Bạn vẫn thanh toán 30.000đ cho một món không có trong kế hoạch ban đầu.',
      reward_xp: 20, knowledge_reward: 2, sort_order: 3, is_active: true,
    },
  ];
  const state = {
    profiles: new Map(),
    userProgress: new Map(),
    expenses: [],
    userChallenges: new Map(),
    bossProgress: new Map(),
    financialLessons: new Map(lessonRows.map((lesson) => [lesson.id, lesson])),
    userLessonProgress: new Map(),
    gameSessions: [],
    challenges: new Map(challengeRows.map(([id, title, sequence_order, discipline_reward]) => [id, {
      id, title, description: title, reward_xp: 30, hp_damage: 20, discipline_reward,
      difficulty: 'easy', linked_boss_id: 'bubble-tea-monster', is_active: true, sequence_order,
    }])),
    bosses: new Map([['bubble-tea-monster', { id: 'bubble-tea-monster', name: 'Quái Vật Trà Sữa', max_hp: 100 }]]),
    businessDate: '2026-07-13',
  };
  const now = () => new Date().toISOString();
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const key = (userId, id) => `${userId}:${id}`;
  const ensureGameState = (userId) => {
    if (!state.profiles.has(userId)) return 'profile_not_found';
    if (!state.userProgress.has(userId)) state.userProgress.set(userId, { user_id: userId, xp: 0, level: 1, discipline: 0, savings: 0, knowledge: 0, wealth: 0, streak: 1, current_streak: 1, freeze_streak_left: 0 });
    if (!state.bossProgress.has(key(userId, 'bubble-tea-monster'))) state.bossProgress.set(key(userId, 'bubble-tea-monster'), { user_id: userId, boss_id: 'bubble-tea-monster', current_hp: 100, status: 'active', started_at: now(), updated_at: now() });
    const active = [...state.userChallenges.values()].find((row) => row.user_id === userId && row.status === 'active');
    const completedToday = [...state.userChallenges.values()].some((row) => row.user_id === userId && row.status === 'completed' && row.completed_date === state.businessDate);
    const bossProgress = state.bossProgress.get(key(userId, 'bubble-tea-monster'));
    if (!active && !completedToday && bossProgress.status === 'active') {
      const next = [...state.challenges.values()].find((challenge) => !state.userChallenges.has(key(userId, challenge.id)));
      if (next) state.userChallenges.set(key(userId, next.id), { user_id: userId, challenge_id: next.id, status: 'active', assigned_date: state.businessDate });
      else bossProgress.status = 'defeated';
    }
    return 'success';
  };

  const selectRows = (table, filter, orders, range) => {
    let rows = [];
    if (table === 'expenses') {
      rows = state.expenses.filter((row) => Object.entries(filter).every(([field, value]) => {
        if (field === 'spent_at_gte') return row.spent_at >= value;
        if (field === 'spent_at_lt') return row.spent_at < value;
        return row[field] === value;
      }));
    } else if (table === 'user_challenges') {
      rows = [...state.userChallenges.values()]
        .filter((row) => (!filter.user_id || row.user_id === filter.user_id) && (!filter.status || row.status === filter.status))
        .map((row) => ({ ...row, challenges: state.challenges.get(row.challenge_id) }));
    } else if (table === 'user_boss_progress') {
      rows = [...state.bossProgress.values()]
        .filter((row) => (!filter.user_id || row.user_id === filter.user_id) && (!filter.boss_id || row.boss_id === filter.boss_id) && (!filter.status || row.status === filter.status))
        .map((row) => ({ ...row, bosses: state.bosses.get(row.boss_id) }));
    } else if (table === 'game_sessions') {
      rows = state.gameSessions.filter((row) => Object.entries(filter).every(([field, value]) => {
        if (field === 'created_at_gte') return row.created_at >= value;
        if (field === 'created_at_lt') return row.created_at < value;
        return row[field] === value;
      }));
    } else if (table === 'challenges') {
      rows = [...state.challenges.values()].filter((row) => Object.entries(filter).every(([field, value]) => row[field] === value));
    } else if (table === 'financial_lessons') {
      rows = [...state.financialLessons.values()].filter((row) =>
        Object.entries(filter).every(([field, value]) => row[field] === value));
    } else if (table === 'user_lesson_progress') {
      rows = [...state.userLessonProgress.values()].filter((row) =>
        Object.entries(filter).every(([field, value]) => row[field] === value));
    } else if (table === 'profiles') {
      rows = [...state.profiles.values()].filter((row) =>
        Object.entries(filter).every(([field, value]) => row[field] === value));
    } else if (table === 'user_progress') {
      rows = [...state.userProgress.values()].filter((row) =>
        Object.entries(filter).every(([field, value]) => row[field] === value));
    }
    for (const order of orders.slice().reverse()) rows.sort((a, b) => {
      const left = a[order.column]; const right = b[order.column];
      if (left === right) return 0;
      const comparison = left > right ? 1 : -1;
      return order.ascending ? comparison : -comparison;
    });
    const count = rows.length;
    if (range) rows = rows.slice(range.from, range.to + 1);
    return { data: clone(rows), error: null, count };
  };

  const createBuilder = (table) => {
    const builder = {
      filter: {}, orders: [], rangeValue: null, operation: null, payload: null,
      select() { return this; },
      eq(column, value) { this.filter[column] = value; return this; },
      gte(column, value) { this.filter[`${column}_gte`] = value; return this; },
      lt(column, value) { this.filter[`${column}_lt`] = value; return this; },
      order(column, { ascending = true } = {}) { this.orders.push({ column, ascending }); return this; },
      range(from, to) { this.rangeValue = { from, to }; return Promise.resolve(selectRows(table, this.filter, this.orders, this.rangeValue)); },
      upsert(payload) { this.operation = 'upsert'; this.payload = payload; return this; },
      update(payload) { this.operation = 'update'; this.payload = payload; return this; },
      insert(payload) {
        this.operation = 'insert';
        this.payload = payload;
        if (table === 'game_sessions') {
          const session = { id: `session-${state.gameSessions.length + 1}`, created_at: now(), ...this.payload };
          state.gameSessions.push(session);
          return Promise.resolve({ data: [clone(session)], error: null });
        }
        return this;
      },
      async single() {
        if (table !== 'profiles' || this.operation !== 'upsert') return { data: null, error: null };
        const existing = state.profiles.get(this.payload.user_id); const timestamp = now();
        const profile = { id: existing ? existing.id : `profile-${state.profiles.size + 1}`, created_at: existing ? existing.created_at : timestamp, triggers: [], preferred_tone: 'funny', ...existing, ...this.payload, updated_at: this.payload.updated_at || timestamp };
        state.profiles.set(profile.user_id, profile); return { data: clone(profile), error: null };
      },
      async maybeSingle() {
        if (table === 'profiles') {
          const userId = this.filter.user_id;
          if (this.operation === 'update') {
            const existing = state.profiles.get(userId); if (!existing) return { data: null, error: null };
            const updated = { ...existing, ...this.payload }; state.profiles.set(userId, updated); return { data: clone(updated), error: null };
          }
          const row = state.profiles.get(userId); return { data: row ? clone(row) : null, error: null };
        }
        if (table === 'user_progress') { const row = state.userProgress.get(this.filter.user_id); return { data: row ? clone(row) : null, error: null }; }
        const response = selectRows(table, this.filter, this.orders, this.rangeValue); return { data: response.data[0] || null, error: null };
      },
      then(resolve, reject) {
        try {
          if (table === 'user_progress' && this.operation === 'upsert') {
            if (!state.userProgress.has(this.payload.user_id)) state.userProgress.set(this.payload.user_id, clone(this.payload));
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          if (table === 'user_boss_progress' && this.operation === 'update') {
            for (const [, bossProg] of state.bossProgress.entries()) {
              if ((!this.filter.user_id || bossProg.user_id === this.filter.user_id) &&
                  (!this.filter.boss_id || bossProg.boss_id === this.filter.boss_id)) {
                Object.assign(bossProg, this.payload);
              }
            }
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          if (table === 'profiles' && this.operation === 'update') {
            const prof = state.profiles.get(this.filter.user_id);
            if (prof) Object.assign(prof, this.payload);
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          if (table === 'user_progress' && this.operation === 'update') {
            const userProg = state.userProgress.get(this.filter.user_id);
            if (userProg) Object.assign(userProg, this.payload);
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          return Promise.resolve(selectRows(table, this.filter, this.orders, this.rangeValue)).then(resolve, reject);
        } catch (error) { return Promise.reject(error).then(resolve, reject); }
      },
    };
    return builder;
  };

  return {
    state,
    from: (table) => createBuilder(table),
    async rpc(name, args) {
      if (name === 'ensure_default_game_state_v1') return { data: [{ outcome: ensureGameState(args.p_user_id) }], error: null };
      if (name === 'record_expense_and_add_xp_v1') {
        if (!state.profiles.has(args.p_user_id)) return { data: [{ outcome: 'profile_not_found' }], error: null };
        ensureGameState(args.p_user_id);
        const expense = { id: `expense-${state.expenses.length + 1}`, user_id: args.p_user_id, title: args.p_title, raw_text: args.p_raw_text, amount: args.p_amount, category: args.p_category, spent_at: args.p_spent_at, created_at: now() };
        state.expenses.push(expense);
        const progress = state.userProgress.get(args.p_user_id); progress.xp += args.p_xp_reward; progress.level = Math.floor(progress.xp / 100) + 1;
        return { data: [{ outcome: 'success', expense_id: expense.id, user_id: expense.user_id, title: expense.title, raw_text: expense.raw_text, amount: expense.amount, category: expense.category, spent_at: expense.spent_at, created_at: expense.created_at, xp: progress.xp, level: progress.level }], error: null };
      }
      if (name === 'complete_financial_lesson_v1') {
        if (!state.profiles.has(args.p_user_id)) {
          return { data: [{ outcome: 'profile_not_found', lesson_id: args.p_lesson_id }], error: null };
        }
        const lesson = state.financialLessons.get(args.p_lesson_id);
        if (!lesson || !lesson.is_active) {
          return { data: [{ outcome: 'lesson_not_found', lesson_id: args.p_lesson_id }], error: null };
        }
        ensureGameState(args.p_user_id);
        const progressKey = key(args.p_user_id, args.p_lesson_id);
        const lessonProgress = state.userLessonProgress.get(progressKey);
        const progress = state.userProgress.get(args.p_user_id);
        if (lessonProgress && lessonProgress.status === 'completed') {
          return { data: [{
            outcome: 'lesson_already_completed', lesson_id: lesson.id,
            reward_xp: 0, knowledge_reward: 0, xp: progress.xp,
            level: progress.level, knowledge: progress.knowledge, explanation: null,
          }], error: null };
        }
        if (args.p_answer_id !== lesson.correct_answer_id) {
          state.userLessonProgress.set(progressKey, {
            user_id: args.p_user_id, lesson_id: lesson.id, status: 'in_progress',
            selected_answer_id: args.p_answer_id, completed_at: null, updated_at: now(),
          });
          return { data: [{
            outcome: 'incorrect_answer', lesson_id: lesson.id,
            reward_xp: 0, knowledge_reward: 0, xp: progress.xp,
            level: progress.level, knowledge: progress.knowledge,
            explanation: lesson.explanation,
          }], error: null };
        }
        state.userLessonProgress.set(progressKey, {
          user_id: args.p_user_id, lesson_id: lesson.id, status: 'completed',
          selected_answer_id: args.p_answer_id, completed_at: now(), updated_at: now(),
        });
        progress.xp += lesson.reward_xp;
        progress.level = Math.floor(progress.xp / 100) + 1;
        progress.knowledge += lesson.knowledge_reward;
        return { data: [{
          outcome: 'success', lesson_id: lesson.id, reward_xp: lesson.reward_xp,
          knowledge_reward: lesson.knowledge_reward, xp: progress.xp,
          level: progress.level, knowledge: progress.knowledge,
          explanation: lesson.explanation,
        }], error: null };
      }
      if (name === 'complete_challenge_v1') {
        if (!state.profiles.has(args.p_user_id)) return { data: [{ outcome: 'profile_not_found' }], error: null };
        const challenge = state.challenges.get(args.p_challenge_id); if (!challenge) return { data: [{ outcome: 'challenge_not_found' }], error: null };
        ensureGameState(args.p_user_id); const userChallenge = state.userChallenges.get(key(args.p_user_id, args.p_challenge_id));
        if (!userChallenge || userChallenge.status !== 'active') return { data: [{ outcome: userChallenge && userChallenge.status === 'completed' ? 'challenge_already_completed' : 'challenge_not_active' }], error: null };
        const boss = state.bosses.get(challenge.linked_boss_id); const bossProgress = state.bossProgress.get(key(args.p_user_id, challenge.linked_boss_id));
        if (!boss || !bossProgress) return { data: [{ outcome: 'boss_progress_not_found' }], error: null };
        userChallenge.status = 'completed'; userChallenge.completed_at = now(); userChallenge.completed_date = state.businessDate;
        const progress = state.userProgress.get(args.p_user_id); progress.xp += challenge.reward_xp; progress.level = Math.floor(progress.xp / 100) + 1; progress.discipline += challenge.discipline_reward; progress.wealth = progress.discipline + progress.savings + progress.knowledge;
        bossProgress.current_hp = Math.max(0, bossProgress.current_hp - challenge.hp_damage); if (bossProgress.current_hp === 0) bossProgress.status = 'defeated';
        return { data: [{ outcome: 'success', challenge_id: challenge.id, title: challenge.title, description: challenge.description, reward_xp: challenge.reward_xp, hp_damage: challenge.hp_damage, discipline_reward: challenge.discipline_reward, difficulty: challenge.difficulty, sequence_order: challenge.sequence_order, assigned_date: userChallenge.assigned_date, challenge_status: 'completed', xp: progress.xp, level: progress.level, discipline: progress.discipline, boss_id: boss.id, boss_name: boss.name, current_hp: bossProgress.current_hp, max_hp: boss.max_hp, boss_status: bossProgress.status }], error: null };
      }
      return { data: null, error: { message: `Unknown RPC ${name}` } };
    },
  };
};

module.exports = { createFakeSupabaseClient };
