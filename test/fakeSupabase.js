const createFakeSupabaseClient = () => {
  const state = {
    profiles: new Map(),
    userProgress: new Map(),
    expenses: [],
    userChallenges: new Map(),
    bossProgress: new Map(),
    challenges: new Map([['challenge-1', {
      id: 'challenge-1', title: 'Không uống trà sữa hôm nay', description: 'Skip bubble tea for today.',
      reward_xp: 30, hp_damage: 20, discipline_reward: 5, difficulty: 'easy', linked_boss_id: 'impulse-boss', is_active: true,
    }]]),
    bosses: new Map([['impulse-boss', { id: 'impulse-boss', name: 'Impulse Boss', max_hp: 100 }]]),
  };
  const now = () => new Date().toISOString();
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const key = (userId, id) => `${userId}:${id}`;
  const ensureGameState = (userId) => {
    if (!state.profiles.has(userId)) return 'profile_not_found';
    if (!state.userProgress.has(userId)) state.userProgress.set(userId, { user_id: userId, xp: 0, level: 1, discipline: 0, savings: 0, knowledge: 0, wealth: 0 });
    if (!state.userChallenges.has(key(userId, 'challenge-1'))) state.userChallenges.set(key(userId, 'challenge-1'), { user_id: userId, challenge_id: 'challenge-1', status: 'active' });
    if (!state.bossProgress.has(key(userId, 'impulse-boss'))) state.bossProgress.set(key(userId, 'impulse-boss'), { user_id: userId, boss_id: 'impulse-boss', current_hp: 100, status: 'active', updated_at: now() });
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
        .filter((row) => (!filter.user_id || row.user_id === filter.user_id) && (!filter.boss_id || row.boss_id === filter.boss_id))
        .map((row) => ({ ...row, bosses: state.bosses.get(row.boss_id) }));
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
      if (name === 'complete_challenge_v1') {
        if (!state.profiles.has(args.p_user_id)) return { data: [{ outcome: 'profile_not_found' }], error: null };
        const challenge = state.challenges.get(args.p_challenge_id); if (!challenge) return { data: [{ outcome: 'challenge_not_found' }], error: null };
        ensureGameState(args.p_user_id); const userChallenge = state.userChallenges.get(key(args.p_user_id, args.p_challenge_id));
        if (!userChallenge || userChallenge.status !== 'active') return { data: [{ outcome: userChallenge && userChallenge.status === 'completed' ? 'challenge_already_completed' : 'challenge_not_active' }], error: null };
        const boss = state.bosses.get(challenge.linked_boss_id); const bossProgress = state.bossProgress.get(key(args.p_user_id, challenge.linked_boss_id));
        if (!boss || !bossProgress) return { data: [{ outcome: 'boss_progress_not_found' }], error: null };
        userChallenge.status = 'completed'; userChallenge.completed_at = now();
        const progress = state.userProgress.get(args.p_user_id); progress.xp += challenge.reward_xp; progress.level = Math.floor(progress.xp / 100) + 1; progress.discipline += challenge.discipline_reward; progress.wealth = progress.discipline + progress.savings + progress.knowledge;
        bossProgress.current_hp = Math.max(0, bossProgress.current_hp - challenge.hp_damage); if (bossProgress.current_hp === 0) bossProgress.status = 'defeated';
        return { data: [{ outcome: 'success', challenge_id: challenge.id, title: challenge.title, description: challenge.description, reward_xp: challenge.reward_xp, hp_damage: challenge.hp_damage, discipline_reward: challenge.discipline_reward, difficulty: challenge.difficulty, challenge_status: 'completed', xp: progress.xp, level: progress.level, discipline: progress.discipline, boss_id: boss.id, boss_name: boss.name, current_hp: bossProgress.current_hp, max_hp: boss.max_hp, boss_status: bossProgress.status }], error: null };
      }
      return { data: null, error: { message: `Unknown RPC ${name}` } };
    },
  };
};

module.exports = { createFakeSupabaseClient };
