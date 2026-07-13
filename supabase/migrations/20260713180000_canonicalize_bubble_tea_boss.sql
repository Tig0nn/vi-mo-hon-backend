-- Canonicalize the production Bubble Tea boss without editing applied migrations.
-- The legacy id is intentionally referenced only by this transactional data hotfix.

BEGIN;

DO $$
DECLARE
  v_key_columns text[];
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.bosses AS b
    WHERE b.id = 'bubble-tea-monster'
  ) THEN
    RAISE EXCEPTION 'Canonical boss bubble-tea-monster does not exist';
  END IF;

  SELECT array_agg(a.attname::text ORDER BY ck.ordinality)
  INTO v_key_columns
  FROM pg_catalog.pg_constraint AS con
  CROSS JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS ck(attnum, ordinality)
  JOIN pg_catalog.pg_attribute AS a
    ON a.attrelid = con.conrelid
   AND a.attnum = ck.attnum
  WHERE con.conrelid = 'public.user_boss_progress'::regclass
    AND con.conname = 'user_boss_progress_pkey'
    AND con.contype = 'p'
  GROUP BY con.oid;

  IF v_key_columns IS DISTINCT FROM ARRAY['user_id', 'boss_id']::text[] THEN
    RAISE EXCEPTION
      'Expected user_boss_progress_pkey on (user_id, boss_id), found %',
      v_key_columns;
  END IF;
END;
$$;

UPDATE public.bosses AS b
SET name = 'Quái Vật Trà Sữa',
    linked_category = 'food_drink'
WHERE b.id = 'bubble-tea-monster'
  AND (b.name IS DISTINCT FROM 'Quái Vật Trà Sữa'
    OR b.linked_category IS DISTINCT FROM 'food_drink');

UPDATE public.financial_lessons AS fl
SET boss_id = 'bubble-tea-monster',
    updated_at = now()
WHERE fl.boss_id = 'impulse-boss';

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.financial_lessons AS fl
    WHERE fl.id IN (
      'bubble-tea-small-costs',
      'bubble-tea-trigger',
      'bubble-tea-promotion'
    )
      AND fl.boss_id = 'bubble-tea-monster'
  ) <> 3 THEN
    RAISE EXCEPTION 'Expected all three Bubble Tea lessons on the canonical boss';
  END IF;
END;
$$;

-- `challenge-1` is the legacy duplicate of the canonical
-- `skip-bubble-tea-today` challenge. Preserve all per-user progress before
-- removing the duplicate challenge row.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.challenges AS c
    WHERE c.id = 'skip-bubble-tea-today'
      AND c.linked_boss_id = 'bubble-tea-monster'
  ) THEN
    RAISE EXCEPTION
      'Canonical challenge skip-bubble-tea-today does not exist on bubble-tea-monster';
  END IF;
END;
$$;

CREATE TEMP TABLE vmh_legacy_challenge_1_progress
ON COMMIT DROP
AS
SELECT uc.*
FROM public.user_challenges AS uc
WHERE uc.challenge_id = 'challenge-1';

-- Delete the legacy rows first. This avoids a temporary collision with the
-- partial unique index that permits only one active challenge per user.
DELETE FROM public.user_challenges AS uc
WHERE uc.challenge_id = 'challenge-1';

-- If a user already has the canonical row, merge the most meaningful state.
-- Completion wins over active; otherwise an active legacy row remains active.
UPDATE public.user_challenges AS target_uc
SET status = CASE
      WHEN target_uc.status = 'completed'
        OR source_uc.status = 'completed'
      THEN 'completed'
      WHEN target_uc.status = 'active'
        OR source_uc.status = 'active'
      THEN 'active'
      ELSE target_uc.status
    END,
    completed_at = CASE
      WHEN target_uc.status = 'completed'
        OR source_uc.status = 'completed'
      THEN COALESCE(
        CASE
          WHEN target_uc.completed_at IS NULL THEN source_uc.completed_at
          WHEN source_uc.completed_at IS NULL THEN target_uc.completed_at
          ELSE LEAST(target_uc.completed_at, source_uc.completed_at)
        END,
        now()
      )
      ELSE target_uc.completed_at
    END,
    assigned_date = CASE
      WHEN target_uc.assigned_date IS NULL THEN source_uc.assigned_date
      WHEN source_uc.assigned_date IS NULL THEN target_uc.assigned_date
      ELSE LEAST(target_uc.assigned_date, source_uc.assigned_date)
    END
FROM vmh_legacy_challenge_1_progress AS source_uc
WHERE target_uc.user_id = source_uc.user_id
  AND target_uc.challenge_id = 'skip-bubble-tea-today';

-- If a user has no canonical row, clone the complete legacy row and replace
-- only its challenge id. Using the table composite type preserves any existing
-- timestamp columns without assuming more schema than the applied migrations.
INSERT INTO public.user_challenges
SELECT populated_uc.*
FROM vmh_legacy_challenge_1_progress AS source_uc
CROSS JOIN LATERAL jsonb_populate_record(
  NULL::public.user_challenges,
  to_jsonb(source_uc)
    || jsonb_build_object('challenge_id', 'skip-bubble-tea-today')
) AS populated_uc
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_challenges AS existing_uc
  WHERE existing_uc.user_id = source_uc.user_id
    AND existing_uc.challenge_id = 'skip-bubble-tea-today'
)
ON CONFLICT ON CONSTRAINT user_challenges_pkey DO NOTHING;

DELETE FROM public.challenges AS c
WHERE c.id = 'challenge-1'
  AND c.linked_boss_id = 'impulse-boss';

-- Keep the other legacy challenges because their content is distinct. Append
-- them after the canonical boss's current sequence so the unique
-- (linked_boss_id, sequence_order) index cannot collide.
WITH canonical_order AS (
  SELECT COALESCE(MAX(c.sequence_order), 0)::integer AS max_order
  FROM public.challenges AS c
  WHERE c.linked_boss_id = 'bubble-tea-monster'
),
legacy_order AS (
  SELECT
    c.id,
    canonical_order.max_order
      + row_number() OVER (
          ORDER BY c.sequence_order ASC, c.id ASC
        )::integer AS new_sequence_order
  FROM public.challenges AS c
  CROSS JOIN canonical_order
  WHERE c.linked_boss_id = 'impulse-boss'
)
UPDATE public.challenges AS c
SET linked_boss_id = 'bubble-tea-monster',
    sequence_order = legacy_order.new_sequence_order
FROM legacy_order
WHERE c.id = legacy_order.id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.challenges AS c
    WHERE c.linked_boss_id = 'impulse-boss'
  ) THEN
    RAISE EXCEPTION 'Legacy boss still owns challenges after canonical merge';
  END IF;

  IF (
    SELECT count(*)
    FROM public.challenges AS c
    WHERE c.linked_boss_id = 'bubble-tea-monster'
      AND c.is_active = true
  ) < 6 THEN
    RAISE EXCEPTION
      'Expected at least six active Bubble Tea challenges after canonical merge';
  END IF;
END;
$$;

-- When both rows exist, retain the most advanced state before removing the duplicate.
UPDATE public.user_boss_progress AS target_progress
SET current_hp = LEAST(target_progress.current_hp, source_progress.current_hp),
    status = CASE
      WHEN target_progress.status = 'defeated'
        OR source_progress.status = 'defeated'
        OR LEAST(target_progress.current_hp, source_progress.current_hp) <= 0
      THEN 'defeated'
      ELSE target_progress.status
    END,
    started_at = LEAST(target_progress.started_at, source_progress.started_at),
    updated_at = GREATEST(target_progress.updated_at, source_progress.updated_at)
FROM public.user_boss_progress AS source_progress
WHERE target_progress.user_id = source_progress.user_id
  AND target_progress.boss_id = 'bubble-tea-monster'
  AND source_progress.boss_id = 'impulse-boss';

DELETE FROM public.user_boss_progress AS source_progress
WHERE source_progress.boss_id = 'impulse-boss'
  AND EXISTS (
    SELECT 1
    FROM public.user_boss_progress AS target_progress
    WHERE target_progress.user_id = source_progress.user_id
      AND target_progress.boss_id = 'bubble-tea-monster'
  );

-- Rows without a canonical counterpart can now be renamed without a key collision.
UPDATE public.user_boss_progress AS source_progress
SET boss_id = 'bubble-tea-monster'
WHERE source_progress.boss_id = 'impulse-boss';

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
    SELECT 1
    FROM public.profiles AS p
    WHERE p.user_id = p_user_id
  ) THEN
    RETURN QUERY SELECT 'profile_not_found'::text;
    RETURN;
  END IF;

  INSERT INTO public.user_progress AS up
    (user_id, xp, level, discipline, savings, knowledge)
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
    WHERE b.id = 'bubble-tea-monster'
      AND b.is_active = true
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
    INSERT INTO public.user_challenges AS uc
      (user_id, challenge_id, status, assigned_date)
    VALUES (p_user_id, v_next_challenge_id, 'active', v_today)
    ON CONFLICT ON CONSTRAINT user_challenges_pkey DO NOTHING;
  END IF;

  RETURN QUERY SELECT 'success'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_default_game_state_v1(text, date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_default_game_state_v1(text, date)
  TO service_role;

-- Check every single-column foreign key that references bosses(id), rather
-- than relying only on the currently known tables.
DO $$
DECLARE
  v_reference record;
  v_reference_count bigint;
BEGIN
  FOR v_reference IN
    SELECT
      source_namespace.nspname AS schema_name,
      source_table.relname AS table_name,
      source_column.attname AS column_name
    FROM pg_catalog.pg_constraint AS con
    JOIN pg_catalog.pg_class AS source_table
      ON source_table.oid = con.conrelid
    JOIN pg_catalog.pg_namespace AS source_namespace
      ON source_namespace.oid = source_table.relnamespace
    CROSS JOIN LATERAL unnest(con.conkey)
      WITH ORDINALITY AS source_key(attnum, ordinality)
    JOIN LATERAL unnest(con.confkey)
      WITH ORDINALITY AS target_key(attnum, ordinality)
      ON target_key.ordinality = source_key.ordinality
    JOIN pg_catalog.pg_attribute AS source_column
      ON source_column.attrelid = con.conrelid
     AND source_column.attnum = source_key.attnum
    JOIN pg_catalog.pg_attribute AS target_column
      ON target_column.attrelid = con.confrelid
     AND target_column.attnum = target_key.attnum
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.bosses'::regclass
      AND target_column.attname = 'id'
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %I.%I AS referenced_row WHERE referenced_row.%I = $1',
      v_reference.schema_name,
      v_reference.table_name,
      v_reference.column_name
    )
    INTO v_reference_count
    USING 'impulse-boss';

    IF v_reference_count > 0 THEN
      RAISE EXCEPTION
        'Legacy boss still has % reference(s) in %.% column %',
        v_reference_count,
        v_reference.schema_name,
        v_reference.table_name,
        v_reference.column_name;
    END IF;
  END LOOP;
END;
$$;

DELETE FROM public.bosses AS b
WHERE b.id = 'impulse-boss';

COMMIT;