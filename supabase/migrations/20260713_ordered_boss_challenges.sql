-- Ordered, one-at-a-time boss challenges. Safe for existing rows; no table is dropped.

ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS sequence_order integer;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY linked_boss_id ORDER BY id)::integer AS position
  FROM public.challenges
  WHERE sequence_order IS NULL
)
UPDATE public.challenges AS c SET sequence_order = ranked.position FROM ranked WHERE c.id = ranked.id;

ALTER TABLE public.challenges ALTER COLUMN sequence_order SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE public.challenges ADD CONSTRAINT challenges_sequence_order_positive CHECK (sequence_order > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS challenges_boss_sequence_order_uidx
  ON public.challenges (linked_boss_id, sequence_order) WHERE linked_boss_id IS NOT NULL;

ALTER TABLE public.user_challenges ADD COLUMN IF NOT EXISTS assigned_date date;
UPDATE public.user_challenges
SET assigned_date = (COALESCE(created_at, now()) AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
WHERE assigned_date IS NULL;
ALTER TABLE public.user_challenges
  ALTER COLUMN assigned_date SET DEFAULT ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date),
  ALTER COLUMN assigned_date SET NOT NULL;
CREATE INDEX IF NOT EXISTS user_challenges_user_status_assigned_idx
  ON public.user_challenges (user_id, status, assigned_date);
CREATE UNIQUE INDEX IF NOT EXISTS user_challenges_one_active_uidx
  ON public.user_challenges (user_id) WHERE status = 'active';

ALTER TABLE public.user_boss_progress ADD COLUMN IF NOT EXISTS started_at timestamptz;
UPDATE public.user_boss_progress SET started_at = COALESCE(updated_at, now()) WHERE started_at IS NULL;
ALTER TABLE public.user_boss_progress ALTER COLUMN started_at SET DEFAULT now(), ALTER COLUMN started_at SET NOT NULL;

INSERT INTO public.challenges
  (id, title, description, challenge_type, reward_xp, hp_damage, discipline_reward, difficulty, linked_boss_id, is_active, sequence_order)
VALUES
  ('challenge-1', 'Không uống trà sữa hôm nay', 'Không uống trà sữa trong ngày hôm nay.', 'daily', 30, 20, 5, 'easy', 'impulse-boss', true, 1),
  ('challenge-2', 'Ghi lại mọi khoản mua đồ uống', 'Ghi lại mọi khoản tiền dùng để mua đồ uống.', 'daily', 30, 20, 5, 'easy', 'impulse-boss', true, 2),
  ('challenge-3', 'Không mua đồ uống sau 20:00', 'Không mua thêm đồ uống sau 20:00.', 'daily', 30, 20, 5, 'easy', 'impulse-boss', true, 3),
  ('challenge-4', 'Chọn món rẻ hơn bình thường', 'Khi mua đồ uống, chọn món rẻ hơn lựa chọn thường ngày.', 'daily', 30, 20, 5, 'easy', 'impulse-boss', true, 4),
  ('challenge-5', 'Giữ chi tiêu đồ uống dưới 30.000đ', 'Giữ tổng chi tiêu đồ uống trong ngày dưới 30.000đ.', 'daily', 30, 20, 8, 'easy', 'impulse-boss', true, 5)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, challenge_type = EXCLUDED.challenge_type,
  reward_xp = EXCLUDED.reward_xp, hp_damage = EXCLUDED.hp_damage,
  discipline_reward = EXCLUDED.discipline_reward, difficulty = EXCLUDED.difficulty,
  linked_boss_id = EXCLUDED.linked_boss_id, is_active = EXCLUDED.is_active,
  sequence_order = EXCLUDED.sequence_order;

DROP FUNCTION IF EXISTS public.ensure_default_game_state_v1(text);
CREATE OR REPLACE FUNCTION public.ensure_default_game_state_v1(p_user_id text, p_business_date date DEFAULT NULL)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_today date := COALESCE(p_business_date, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date);
  v_boss_id text;
  v_max_hp integer;
  v_next_challenge_id text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id, 0));
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = p_user_id) THEN
    RETURN QUERY SELECT 'profile_not_found'::text; RETURN;
  END IF;
  INSERT INTO public.user_progress (user_id, xp, level, discipline, savings, knowledge)
  VALUES (p_user_id, 0, 1, 0, 0, 0) ON CONFLICT (user_id) DO NOTHING;

  SELECT ubp.boss_id INTO v_boss_id FROM public.user_boss_progress ubp
  WHERE ubp.user_id = p_user_id AND ubp.status = 'active'
  ORDER BY ubp.started_at ASC, ubp.boss_id ASC LIMIT 1 FOR UPDATE;

  IF v_boss_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_boss_progress ubp
    WHERE ubp.user_id = p_user_id AND ubp.boss_id = v_boss_id AND ubp.current_hp <= 0
  ) THEN
    UPDATE public.user_boss_progress SET current_hp = 0, status = 'defeated', updated_at = now()
    WHERE user_id = p_user_id AND boss_id = v_boss_id;
    v_boss_id := NULL;
  END IF;

  IF v_boss_id IS NULL THEN
    SELECT b.id, b.max_hp INTO v_boss_id, v_max_hp FROM public.bosses b
    WHERE b.is_active = true ORDER BY b.id ASC LIMIT 1;
    IF v_boss_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.user_boss_progress ubp WHERE ubp.user_id = p_user_id AND ubp.boss_id = v_boss_id AND ubp.status = 'defeated'
    ) THEN
      INSERT INTO public.user_boss_progress (user_id, boss_id, current_hp, status, started_at, updated_at)
      VALUES (p_user_id, v_boss_id, v_max_hp, 'active', now(), now())
      ON CONFLICT (user_id, boss_id) DO UPDATE SET status = 'active', started_at = now(), updated_at = now();
    ELSE
      v_boss_id := NULL;
    END IF;
  END IF;

  IF v_boss_id IS NULL OR EXISTS (
    SELECT 1 FROM public.user_challenges uc WHERE uc.user_id = p_user_id AND uc.status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM public.user_challenges uc WHERE uc.user_id = p_user_id AND uc.status = 'completed'
      AND (uc.completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = v_today
  ) THEN RETURN QUERY SELECT 'success'::text; RETURN; END IF;

  SELECT c.id INTO v_next_challenge_id FROM public.challenges c
  WHERE c.linked_boss_id = v_boss_id AND c.is_active = true
    AND NOT EXISTS (SELECT 1 FROM public.user_challenges uc WHERE uc.user_id = p_user_id AND uc.challenge_id = c.id)
  ORDER BY c.sequence_order ASC, c.id ASC LIMIT 1;

  IF v_next_challenge_id IS NULL THEN
    UPDATE public.user_boss_progress SET status = 'defeated', updated_at = now()
    WHERE user_id = p_user_id AND boss_id = v_boss_id;
  ELSE
    INSERT INTO public.user_challenges (user_id, challenge_id, status, assigned_date)
    VALUES (p_user_id, v_next_challenge_id, 'active', v_today)
    ON CONFLICT (user_id, challenge_id) DO NOTHING;
  END IF;
  RETURN QUERY SELECT 'success'::text;
END; $$;

DROP FUNCTION IF EXISTS public.complete_challenge_v1(text, text);
CREATE OR REPLACE FUNCTION public.complete_challenge_v1(p_user_id text, p_challenge_id text, p_business_date date DEFAULT NULL)
RETURNS TABLE(outcome text, challenge_id text, title text, description text, reward_xp integer,
  hp_damage integer, discipline_reward integer, difficulty text, sequence_order integer,
  assigned_date date, challenge_status text, xp integer, level integer, discipline integer,
  boss_id text, boss_name text, current_hp integer, max_hp integer, boss_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_challenge public.challenges%ROWTYPE; v_uc public.user_challenges%ROWTYPE;
  v_progress public.user_progress%ROWTYPE; v_bp public.user_boss_progress%ROWTYPE;
  v_boss public.bosses%ROWTYPE; v_active_boss_id text; v_new_hp integer;
  v_uc_found boolean; v_no_remaining boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id, 0));
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = p_user_id) THEN
    RETURN QUERY SELECT 'profile_not_found'::text, NULL::text, NULL::text, NULL::text, NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::integer, NULL::date, NULL::text, NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::text, NULL::integer, NULL::integer, NULL::text; RETURN;
  END IF;
  SELECT c.* INTO v_challenge FROM public.challenges c WHERE c.id = p_challenge_id;
  IF NOT FOUND THEN RETURN QUERY SELECT 'challenge_not_found'::text, NULL::text, NULL::text, NULL::text, NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::integer, NULL::date, NULL::text, NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::text, NULL::integer, NULL::integer, NULL::text; RETURN; END IF;
  SELECT uc.* INTO v_uc FROM public.user_challenges uc WHERE uc.user_id = p_user_id AND uc.challenge_id = p_challenge_id FOR UPDATE;
  v_uc_found := FOUND;
  IF FOUND AND v_uc.status = 'completed' THEN RETURN QUERY SELECT 'challenge_already_completed'::text, NULL::text, NULL::text, NULL::text, NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::integer, NULL::date, NULL::text, NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::text, NULL::integer, NULL::integer, NULL::text; RETURN; END IF;
  SELECT ubp.boss_id INTO v_active_boss_id FROM public.user_boss_progress ubp WHERE ubp.user_id = p_user_id AND ubp.status = 'active' ORDER BY ubp.started_at ASC, ubp.boss_id ASC LIMIT 1;
  IF NOT v_uc_found OR NOT FOUND OR v_uc.status <> 'active' OR NOT v_challenge.is_active OR v_challenge.linked_boss_id IS DISTINCT FROM v_active_boss_id THEN RETURN QUERY SELECT 'challenge_not_active'::text, NULL::text, NULL::text, NULL::text, NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::integer, NULL::date, NULL::text, NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::text, NULL::integer, NULL::integer, NULL::text; RETURN; END IF;
  SELECT ubp.* INTO v_bp FROM public.user_boss_progress ubp WHERE ubp.user_id = p_user_id AND ubp.boss_id = v_active_boss_id FOR UPDATE;
  SELECT b.* INTO v_boss FROM public.bosses b WHERE b.id = v_active_boss_id;
  IF v_bp.current_hp <= 0 THEN
    UPDATE public.user_boss_progress SET current_hp = 0, status = 'defeated', updated_at = now()
    WHERE user_id = p_user_id AND boss_id = v_active_boss_id;
    RETURN QUERY SELECT 'challenge_not_active'::text, NULL::text, NULL::text, NULL::text, NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::integer, NULL::date, NULL::text, NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::text, NULL::integer, NULL::integer, NULL::text; RETURN;
  END IF;
  UPDATE public.user_challenges SET status = 'completed', completed_at = now() WHERE user_id = p_user_id AND challenge_id = p_challenge_id;
  UPDATE public.user_progress up SET xp = up.xp + v_challenge.reward_xp,
    level = floor((up.xp + v_challenge.reward_xp) / 100.0)::integer + 1,
    discipline = up.discipline + v_challenge.discipline_reward, updated_at = now()
  WHERE up.user_id = p_user_id RETURNING up.* INTO v_progress;
  v_new_hp := greatest(0, v_bp.current_hp - v_challenge.hp_damage);
  SELECT NOT EXISTS (
    SELECT 1 FROM public.challenges c
    WHERE c.linked_boss_id = v_active_boss_id AND c.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM public.user_challenges uc
        WHERE uc.user_id = p_user_id AND uc.challenge_id = c.id AND uc.status = 'completed'
      )
  ) INTO v_no_remaining;
  UPDATE public.user_boss_progress ubp SET current_hp = v_new_hp,
    status = CASE WHEN v_new_hp = 0 OR v_no_remaining THEN 'defeated' ELSE ubp.status END, updated_at = now()
  WHERE ubp.user_id = p_user_id AND ubp.boss_id = v_active_boss_id RETURNING ubp.* INTO v_bp;
  RETURN QUERY SELECT 'success'::text, v_challenge.id, v_challenge.title, v_challenge.description,
    v_challenge.reward_xp, v_challenge.hp_damage, v_challenge.discipline_reward, v_challenge.difficulty,
    v_challenge.sequence_order, v_uc.assigned_date, 'completed'::text, v_progress.xp, v_progress.level,
    v_progress.discipline, v_boss.id, v_boss.name, v_bp.current_hp, v_boss.max_hp, v_bp.status;
END; $$;

REVOKE ALL ON FUNCTION public.ensure_default_game_state_v1(text, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_challenge_v1(text, text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_default_game_state_v1(text, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_challenge_v1(text, text, date) TO service_role;
