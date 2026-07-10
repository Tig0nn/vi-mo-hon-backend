-- Reuses the existing Supabase tables. This migration is safe to rerun.

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'easy',
  ADD COLUMN IF NOT EXISTS discipline_reward integer NOT NULL DEFAULT 5;

INSERT INTO public.bosses (id, name, description, max_hp, linked_category, is_active)
VALUES (
  'impulse-boss',
  'Impulse Boss',
  'A small boss representing impulsive spending habits.',
  100,
  'food_drink',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.challenges (
  id, title, description, challenge_type, reward_xp, hp_damage,
  discipline_reward, difficulty, linked_boss_id, is_active
)
VALUES (
  'challenge-1',
  'Không uống trà sữa hôm nay',
  'Skip bubble tea for today.',
  'daily',
  30,
  20,
  5,
  'easy',
  'impulse-boss',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_progress (user_id, xp, level, discipline, savings, knowledge)
SELECT p.user_id, 0, 1, 0, 0, 0
FROM public.profiles p
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_challenges (user_id, challenge_id, status)
SELECT p.user_id, 'challenge-1', 'active'
FROM public.profiles p
ON CONFLICT (user_id, challenge_id) DO NOTHING;

INSERT INTO public.user_boss_progress (user_id, boss_id, current_hp, status, updated_at)
SELECT p.user_id, b.id, b.max_hp, 'active', now()
FROM public.profiles p
JOIN public.bosses b ON b.id = 'impulse-boss'
ON CONFLICT (user_id, boss_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_default_game_state_v1(p_user_id text)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_max_hp integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.user_id = p_user_id
  ) THEN
    RETURN QUERY SELECT 'profile_not_found'::text;
    RETURN;
  END IF;

  INSERT INTO public.user_progress (user_id, xp, level, discipline, savings, knowledge)
  VALUES (p_user_id, 0, 1, 0, 0, 0)
  ON CONFLICT ON CONSTRAINT user_progress_pkey DO NOTHING;

  INSERT INTO public.user_challenges (user_id, challenge_id, status)
  VALUES (p_user_id, 'challenge-1', 'active')
  ON CONFLICT ON CONSTRAINT user_challenges_pkey DO NOTHING;

  SELECT b.max_hp
  INTO v_max_hp
  FROM public.bosses AS b
  WHERE b.id = 'impulse-boss';

  IF v_max_hp IS NOT NULL THEN
    INSERT INTO public.user_boss_progress (user_id, boss_id, current_hp, status, updated_at)
    VALUES (p_user_id, 'impulse-boss', v_max_hp, 'active', now())
    ON CONFLICT ON CONSTRAINT user_boss_progress_pkey DO NOTHING;
  END IF;

  RETURN QUERY SELECT 'success'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_expense_and_add_xp_v1(
  p_user_id text,
  p_title text,
  p_amount bigint,
  p_category text,
  p_raw_text text,
  p_spent_at timestamptz,
  p_xp_reward integer DEFAULT 5
)
RETURNS TABLE(
  outcome text,
  expense_id uuid,
  user_id text,
  title text,
  raw_text text,
  amount bigint,
  category text,
  spent_at timestamptz,
  created_at timestamptz,
  xp integer,
  level integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expense public.expenses%ROWTYPE;
  v_progress public.user_progress%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.user_id = p_user_id
  ) THEN
    RETURN QUERY SELECT 'profile_not_found'::text, NULL::uuid, NULL::text, NULL::text,
      NULL::text, NULL::bigint, NULL::text, NULL::timestamptz, NULL::timestamptz, NULL::integer, NULL::integer;
    RETURN;
  END IF;

  INSERT INTO public.user_progress (user_id, xp, level, discipline, savings, knowledge)
  VALUES (p_user_id, 0, 1, 0, 0, 0)
  ON CONFLICT ON CONSTRAINT user_progress_pkey DO NOTHING;

  INSERT INTO public.expenses AS e (user_id, title, amount, category, raw_text, spent_at)
  VALUES (p_user_id, p_title, p_amount, p_category, p_raw_text, COALESCE(p_spent_at, now()))
  RETURNING e.* INTO v_expense;

  UPDATE public.user_progress AS up
  SET xp = up.xp + p_xp_reward,
      level = floor((up.xp + p_xp_reward) / 100.0)::integer + 1,
      updated_at = now()
  WHERE up.user_id = p_user_id
  RETURNING up.* INTO v_progress;

  RETURN QUERY SELECT 'success'::text, v_expense.id, v_expense.user_id, v_expense.title,
    v_expense.raw_text, v_expense.amount, v_expense.category, v_expense.spent_at,
    v_expense.created_at, v_progress.xp, v_progress.level;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_challenge_v1(p_user_id text, p_challenge_id text)
RETURNS TABLE(
  outcome text,
  challenge_id text,
  title text,
  description text,
  reward_xp integer,
  hp_damage integer,
  discipline_reward integer,
  difficulty text,
  challenge_status text,
  xp integer,
  level integer,
  discipline integer,
  boss_id text,
  boss_name text,
  current_hp integer,
  max_hp integer,
  boss_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_challenge public.challenges%ROWTYPE;
  v_user_challenge public.user_challenges%ROWTYPE;
  v_progress public.user_progress%ROWTYPE;
  v_boss_progress public.user_boss_progress%ROWTYPE;
  v_boss public.bosses%ROWTYPE;
  v_new_hp integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.user_id = p_user_id
  ) THEN
    RETURN QUERY SELECT 'profile_not_found'::text, NULL::text, NULL::text, NULL::text,
      NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::text, NULL::integer,
      NULL::integer, NULL::integer, NULL::text, NULL::text, NULL::integer, NULL::integer, NULL::text;
    RETURN;
  END IF;

  SELECT c.*
  INTO v_challenge
  FROM public.challenges AS c
  WHERE c.id = p_challenge_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'challenge_not_found'::text, NULL::text, NULL::text, NULL::text,
      NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::text, NULL::integer,
      NULL::integer, NULL::integer, NULL::text, NULL::text, NULL::integer, NULL::integer, NULL::text;
    RETURN;
  END IF;

  PERFORM public.ensure_default_game_state_v1(p_user_id);

  SELECT uc.*
  INTO v_user_challenge
  FROM public.user_challenges AS uc
  WHERE uc.user_id = p_user_id
    AND uc.challenge_id = p_challenge_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'challenge_not_active'::text, NULL::text, NULL::text, NULL::text,
      NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::text, NULL::integer,
      NULL::integer, NULL::integer, NULL::text, NULL::text, NULL::integer, NULL::integer, NULL::text;
    RETURN;
  END IF;

  IF v_user_challenge.status = 'completed' THEN
    RETURN QUERY SELECT 'challenge_already_completed'::text, NULL::text, NULL::text, NULL::text,
      NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::text, NULL::integer,
      NULL::integer, NULL::integer, NULL::text, NULL::text, NULL::integer, NULL::integer, NULL::text;
    RETURN;
  END IF;

  IF v_user_challenge.status <> 'active'
     OR NOT v_challenge.is_active
     OR v_challenge.linked_boss_id IS NULL THEN
    RETURN QUERY SELECT 'challenge_not_active'::text, NULL::text, NULL::text, NULL::text,
      NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::text, NULL::integer,
      NULL::integer, NULL::integer, NULL::text, NULL::text, NULL::integer, NULL::integer, NULL::text;
    RETURN;
  END IF;

  SELECT ubp.*
  INTO v_boss_progress
  FROM public.user_boss_progress AS ubp
  WHERE ubp.user_id = p_user_id
    AND ubp.boss_id = v_challenge.linked_boss_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'boss_progress_not_found'::text, NULL::text, NULL::text, NULL::text,
      NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::text, NULL::integer,
      NULL::integer, NULL::integer, NULL::text, NULL::text, NULL::integer, NULL::integer, NULL::text;
    RETURN;
  END IF;

  SELECT b.*
  INTO v_boss
  FROM public.bosses AS b
  WHERE b.id = v_challenge.linked_boss_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'boss_progress_not_found'::text, NULL::text, NULL::text, NULL::text,
      NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::text, NULL::integer,
      NULL::integer, NULL::integer, NULL::text, NULL::text, NULL::integer, NULL::integer, NULL::text;
    RETURN;
  END IF;

  UPDATE public.user_challenges AS uc
  SET status = 'completed',
      completed_at = now()
  WHERE uc.user_id = p_user_id
    AND uc.challenge_id = p_challenge_id;

  UPDATE public.user_progress AS up
  SET xp = up.xp + v_challenge.reward_xp,
      level = floor((up.xp + v_challenge.reward_xp) / 100.0)::integer + 1,
      discipline = up.discipline + v_challenge.discipline_reward,
      updated_at = now()
  WHERE up.user_id = p_user_id
  RETURNING up.* INTO v_progress;

  v_new_hp := greatest(0, v_boss_progress.current_hp - v_challenge.hp_damage);

  UPDATE public.user_boss_progress AS ubp
  SET current_hp = v_new_hp,
      status = CASE
        WHEN v_new_hp = 0 THEN 'defeated'
        ELSE ubp.status
      END,
      updated_at = now()
  WHERE ubp.user_id = p_user_id
    AND ubp.boss_id = v_challenge.linked_boss_id
  RETURNING ubp.* INTO v_boss_progress;

  RETURN QUERY SELECT 'success'::text, v_challenge.id, v_challenge.title, v_challenge.description,
    v_challenge.reward_xp, v_challenge.hp_damage, v_challenge.discipline_reward, v_challenge.difficulty,
    'completed'::text, v_progress.xp, v_progress.level, v_progress.discipline, v_boss.id, v_boss.name,
    v_boss_progress.current_hp, v_boss.max_hp, v_boss_progress.status;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_default_game_state_v1(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_expense_and_add_xp_v1(text, text, bigint, text, text, timestamptz, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_challenge_v1(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_default_game_state_v1(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_expense_and_add_xp_v1(text, text, bigint, text, text, timestamptz, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_challenge_v1(text, text) TO service_role;