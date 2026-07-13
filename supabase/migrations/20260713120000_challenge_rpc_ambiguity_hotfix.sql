-- Hotfix PostgreSQL 42702 errors caused by RETURNS TABLE output names
-- overlapping unqualified table columns in the challenge RPCs.

CREATE OR REPLACE FUNCTION public.ensure_default_game_state_v1(
  p_user_id text,
  p_business_date date DEFAULT NULL
)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today date := COALESCE(p_business_date, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date);
  v_boss_id text;
  v_max_hp integer;
  v_next_challenge_id text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id, 0));

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS p WHERE p.user_id = p_user_id
  ) THEN
    RETURN QUERY SELECT 'profile_not_found'::text;
    RETURN;
  END IF;

  INSERT INTO public.user_progress AS up (user_id, xp, level, discipline, savings, knowledge)
  VALUES (p_user_id, 0, 1, 0, 0, 0)
  ON CONFLICT ON CONSTRAINT user_progress_pkey DO NOTHING;

  SELECT ubp.boss_id
  INTO v_boss_id
  FROM public.user_boss_progress AS ubp
  WHERE ubp.user_id = p_user_id
    AND ubp.status = 'active'
  ORDER BY ubp.started_at ASC, ubp.boss_id ASC
  LIMIT 1
  FOR UPDATE;

  IF v_boss_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.user_boss_progress AS ubp
    WHERE ubp.user_id = p_user_id
      AND ubp.boss_id = v_boss_id
      AND ubp.current_hp <= 0
  ) THEN
    UPDATE public.user_boss_progress AS ubp
    SET current_hp = 0,
        status = 'defeated',
        updated_at = now()
    WHERE ubp.user_id = p_user_id
      AND ubp.boss_id = v_boss_id;
    v_boss_id := NULL;
  END IF;

  IF v_boss_id IS NULL THEN
    SELECT b.id, b.max_hp
    INTO v_boss_id, v_max_hp
    FROM public.bosses AS b
    WHERE b.is_active = true
    ORDER BY b.id ASC
    LIMIT 1;

    IF v_boss_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.user_boss_progress AS ubp
      WHERE ubp.user_id = p_user_id
        AND ubp.boss_id = v_boss_id
        AND ubp.status = 'defeated'
    ) THEN
      INSERT INTO public.user_boss_progress AS ubp
        (user_id, boss_id, current_hp, status, started_at, updated_at)
      VALUES (p_user_id, v_boss_id, v_max_hp, 'active', now(), now())
      ON CONFLICT ON CONSTRAINT user_boss_progress_pkey
      DO UPDATE SET
        status = 'active',
        started_at = now(),
        updated_at = now();
    ELSE
      v_boss_id := NULL;
    END IF;
  END IF;

  IF v_boss_id IS NULL OR EXISTS (
    SELECT 1
    FROM public.user_challenges AS uc
    WHERE uc.user_id = p_user_id
      AND uc.status = 'active'
  ) OR EXISTS (
    SELECT 1
    FROM public.user_challenges AS uc
    WHERE uc.user_id = p_user_id
      AND uc.status = 'completed'
      AND (uc.completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = v_today
  ) THEN
    RETURN QUERY SELECT 'success'::text;
    RETURN;
  END IF;

  SELECT c.id
  INTO v_next_challenge_id
  FROM public.challenges AS c
  WHERE c.linked_boss_id = v_boss_id
    AND c.is_active = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_challenges AS uc
      WHERE uc.user_id = p_user_id
        AND uc.challenge_id = c.id
    )
  ORDER BY c.sequence_order ASC, c.id ASC
  LIMIT 1;

  IF v_next_challenge_id IS NULL THEN
    UPDATE public.user_boss_progress AS ubp
    SET status = 'defeated',
        updated_at = now()
    WHERE ubp.user_id = p_user_id
      AND ubp.boss_id = v_boss_id;
  ELSE
    INSERT INTO public.user_challenges AS uc (user_id, challenge_id, status, assigned_date)
    VALUES (p_user_id, v_next_challenge_id, 'active', v_today)
    ON CONFLICT ON CONSTRAINT user_challenges_pkey DO NOTHING;
  END IF;

  RETURN QUERY SELECT 'success'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_challenge_v1(
  p_user_id text,
  p_challenge_id text,
  p_business_date date DEFAULT NULL
)
RETURNS TABLE(
  outcome text,
  challenge_id text,
  title text,
  description text,
  reward_xp integer,
  hp_damage integer,
  discipline_reward integer,
  difficulty text,
  sequence_order integer,
  assigned_date date,
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
  v_uc public.user_challenges%ROWTYPE;
  v_progress public.user_progress%ROWTYPE;
  v_bp public.user_boss_progress%ROWTYPE;
  v_boss public.bosses%ROWTYPE;
  v_active_boss_id text;
  v_new_hp integer;
  v_uc_found boolean;
  v_no_remaining boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id, 0));

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS p WHERE p.user_id = p_user_id
  ) THEN
    RETURN QUERY SELECT 'profile_not_found'::text, NULL::text, NULL::text, NULL::text,
      NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::integer, NULL::date,
      NULL::text, NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::text,
      NULL::integer, NULL::integer, NULL::text;
    RETURN;
  END IF;

  SELECT c.*
  INTO v_challenge
  FROM public.challenges AS c
  WHERE c.id = p_challenge_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'challenge_not_found'::text, NULL::text, NULL::text, NULL::text,
      NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::integer, NULL::date,
      NULL::text, NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::text,
      NULL::integer, NULL::integer, NULL::text;
    RETURN;
  END IF;

  SELECT uc.*
  INTO v_uc
  FROM public.user_challenges AS uc
  WHERE uc.user_id = p_user_id
    AND uc.challenge_id = p_challenge_id
  FOR UPDATE;
  v_uc_found := FOUND;

  IF v_uc_found AND v_uc.status = 'completed' THEN
    RETURN QUERY SELECT 'challenge_already_completed'::text, NULL::text, NULL::text, NULL::text,
      NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::integer, NULL::date,
      NULL::text, NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::text,
      NULL::integer, NULL::integer, NULL::text;
    RETURN;
  END IF;

  SELECT ubp.boss_id
  INTO v_active_boss_id
  FROM public.user_boss_progress AS ubp
  WHERE ubp.user_id = p_user_id
    AND ubp.status = 'active'
  ORDER BY ubp.started_at ASC, ubp.boss_id ASC
  LIMIT 1;

  IF NOT v_uc_found
     OR NOT FOUND
     OR v_uc.status <> 'active'
     OR NOT v_challenge.is_active
     OR v_challenge.linked_boss_id IS DISTINCT FROM v_active_boss_id THEN
    RETURN QUERY SELECT 'challenge_not_active'::text, NULL::text, NULL::text, NULL::text,
      NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::integer, NULL::date,
      NULL::text, NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::text,
      NULL::integer, NULL::integer, NULL::text;
    RETURN;
  END IF;

  SELECT ubp.*
  INTO v_bp
  FROM public.user_boss_progress AS ubp
  WHERE ubp.user_id = p_user_id
    AND ubp.boss_id = v_active_boss_id
  FOR UPDATE;

  SELECT b.*
  INTO v_boss
  FROM public.bosses AS b
  WHERE b.id = v_active_boss_id;

  IF v_bp.current_hp <= 0 THEN
    UPDATE public.user_boss_progress AS ubp
    SET current_hp = 0,
        status = 'defeated',
        updated_at = now()
    WHERE ubp.user_id = p_user_id
      AND ubp.boss_id = v_active_boss_id;
    RETURN QUERY SELECT 'challenge_not_active'::text, NULL::text, NULL::text, NULL::text,
      NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::integer, NULL::date,
      NULL::text, NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::text,
      NULL::integer, NULL::integer, NULL::text;
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

  v_new_hp := greatest(0, v_bp.current_hp - v_challenge.hp_damage);

  SELECT NOT EXISTS (
    SELECT 1
    FROM public.challenges AS c
    WHERE c.linked_boss_id = v_active_boss_id
      AND c.is_active = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_challenges AS uc
        WHERE uc.user_id = p_user_id
          AND uc.challenge_id = c.id
          AND uc.status = 'completed'
      )
  ) INTO v_no_remaining;

  UPDATE public.user_boss_progress AS ubp
  SET current_hp = v_new_hp,
      status = CASE
        WHEN v_new_hp = 0 OR v_no_remaining THEN 'defeated'
        ELSE ubp.status
      END,
      updated_at = now()
  WHERE ubp.user_id = p_user_id
    AND ubp.boss_id = v_active_boss_id
  RETURNING ubp.* INTO v_bp;

  RETURN QUERY SELECT 'success'::text, v_challenge.id, v_challenge.title,
    v_challenge.description, v_challenge.reward_xp, v_challenge.hp_damage,
    v_challenge.discipline_reward, v_challenge.difficulty, v_challenge.sequence_order,
    v_uc.assigned_date, 'completed'::text, v_progress.xp, v_progress.level,
    v_progress.discipline, v_boss.id, v_boss.name, v_bp.current_hp,
    v_boss.max_hp, v_bp.status;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_default_game_state_v1(text, date)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_challenge_v1(text, text, date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_default_game_state_v1(text, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_challenge_v1(text, text, date) TO service_role;
