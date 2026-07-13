-- Short financial lessons linked to the existing impulse-spending boss.
-- This migration is additive and safe to rerun before it is applied remotely.

CREATE TABLE IF NOT EXISTS public.financial_lessons (
  id text PRIMARY KEY,
  boss_id text NOT NULL REFERENCES public.bosses(id),
  title text NOT NULL,
  summary text NOT NULL,
  cards jsonb NOT NULL,
  question text NOT NULL,
  answers jsonb NOT NULL,
  correct_answer_id text NOT NULL,
  explanation text NOT NULL,
  reward_xp integer NOT NULL DEFAULT 20,
  knowledge_reward integer NOT NULL DEFAULT 2,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_lessons_reward_xp_nonnegative CHECK (reward_xp >= 0),
  CONSTRAINT financial_lessons_knowledge_reward_nonnegative CHECK (knowledge_reward >= 0),
  CONSTRAINT financial_lessons_sort_order_positive CHECK (sort_order > 0),
  CONSTRAINT financial_lessons_cards_nonempty_array
    CHECK (jsonb_typeof(cards) = 'array' AND jsonb_array_length(cards) > 0),
  CONSTRAINT financial_lessons_answers_nonempty_array
    CHECK (jsonb_typeof(answers) = 'array' AND jsonb_array_length(answers) > 0),
  CONSTRAINT financial_lessons_boss_sort_order_unique UNIQUE (boss_id, sort_order)
);

CREATE TABLE IF NOT EXISTS public.user_lesson_progress (
  user_id text NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  lesson_id text NOT NULL REFERENCES public.financial_lessons(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'in_progress',
  selected_answer_id text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_lesson_progress_status_valid
    CHECK (status IN ('in_progress', 'completed')),
  CONSTRAINT user_lesson_progress_pkey PRIMARY KEY (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS user_lesson_progress_user_status_idx
  ON public.user_lesson_progress (user_id, status);

ALTER TABLE public.financial_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_lesson_progress ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.financial_lessons, public.user_lesson_progress
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.financial_lessons TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_lesson_progress TO service_role;

INSERT INTO public.financial_lessons AS fl (
  id, boss_id, title, summary, cards, question, answers,
  correct_answer_id, explanation, reward_xp, knowledge_reward,
  sort_order, is_active, updated_at
)
VALUES
  (
    'bubble-tea-small-costs',
    'impulse-boss',
    '45.000đ có thật sự nhỏ?',
    'Nhìn thấy chi phí tích lũy của những khoản nhỏ lặp lại.',
    '[
      {"id":"card-1","title":"Một lần thì nhỏ","body":"Một ly trà sữa 45.000đ nghe có vẻ không đáng kể."},
      {"id":"card-2","title":"Lặp lại thì khác","body":"Uống 3 ly mỗi tuần tương đương khoảng 540.000đ trong 4 tuần."},
      {"id":"card-3","title":"Một năm là bao nhiêu?","body":"Duy trì thói quen đó trong 52 tuần có thể tốn khoảng 7.020.000đ."},
      {"id":"card-4","title":"Điểm cần nhớ","body":"Vấn đề không nằm ở một ly, mà ở khoản chi lặp lại nhưng không được để ý."}
    ]'::jsonb,
    'Một ly giá 45.000đ, uống 3 ly mỗi tuần trong 4 tuần thì tốn khoảng bao nhiêu?',
    '[
      {"id":"a","label":"135.000đ"},
      {"id":"b","label":"360.000đ"},
      {"id":"c","label":"540.000đ"},
      {"id":"d","label":"1.350.000đ"}
    ]'::jsonb,
    'c',
    '45.000 × 3 × 4 = 540.000đ.',
    20,
    2,
    1,
    true,
    now()
  ),
  (
    'bubble-tea-trigger',
    'impulse-boss',
    'Nhu cầu hay thói quen?',
    'Nhận ra điều gì đang kích hoạt quyết định mua đồ uống.',
    '[
      {"id":"card-1","title":"Có lúc là nhu cầu thật","body":"Bạn có thể mua vì đang khát hoặc thực sự muốn thưởng thức."},
      {"id":"card-2","title":"Có lúc là phản xạ","body":"Đi ngang cửa hàng, thấy bạn bè mua hoặc thấy quảng cáo cũng có thể khiến bạn muốn đặt ngay."},
      {"id":"card-3","title":"Đó là tác nhân kích hoạt","body":"Tác nhân kích hoạt khiến quyết định xảy ra nhanh, dù trước đó bạn không có kế hoạch mua."},
      {"id":"card-4","title":"Câu hỏi trước khi mua","body":"Mình thật sự muốn uống, hay chỉ đang phản ứng với hoàn cảnh?"}
    ]'::jsonb,
    'Tình huống nào có thể là tác nhân khiến bạn mua trà sữa ngoài kế hoạch?',
    '[
      {"id":"a","label":"Bạn bè rủ"},
      {"id":"b","label":"Thấy quảng cáo giảm giá"},
      {"id":"c","label":"Đang buồn và muốn tự thưởng"},
      {"id":"d","label":"Tất cả các tình huống trên"}
    ]'::jsonb,
    'd',
    'Bạn bè, quảng cáo và cảm xúc đều có thể kích hoạt một khoản chi ngoài kế hoạch.',
    20,
    2,
    2,
    true,
    now()
  ),
  (
    'bubble-tea-promotion',
    'impulse-boss',
    'Khuyến mãi có luôn là tiết kiệm?',
    'Phân biệt giảm giá thật với việc bị khuyến mãi kéo vào một khoản chi mới.',
    '[
      {"id":"card-1","title":"Giảm giá chưa chắc là tiết kiệm","body":"Giảm 20.000đ không có nghĩa bạn tiết kiệm 20.000đ."},
      {"id":"card-2","title":"So với kế hoạch ban đầu","body":"Nếu ban đầu bạn không định mua, số tiền thanh toán vẫn là một khoản chi mới."},
      {"id":"card-3","title":"Combo cũng có thể làm bạn chi nhiều","body":"Mua hai ly vì rẻ hơn mỗi ly vẫn có thể tốn nhiều hơn nhu cầu thực tế."},
      {"id":"card-4","title":"Quy tắc đơn giản","body":"Khuyến mãi chỉ giúp tiết kiệm khi món đó đã nằm trong kế hoạch."}
    ]'::jsonb,
    'Bạn không định mua, nhưng đặt một ly 50.000đ vì có mã giảm 20.000đ. Điều gì đã xảy ra?',
    '[
      {"id":"a","label":"Tiết kiệm được 20.000đ"},
      {"id":"b","label":"Chi thêm 30.000đ ngoài kế hoạch"},
      {"id":"c","label":"Không tốn tiền vì có mã giảm"},
      {"id":"d","label":"Không thể xác định"}
    ]'::jsonb,
    'b',
    'Bạn vẫn thanh toán 30.000đ cho một món không có trong kế hoạch ban đầu.',
    20,
    2,
    3,
    true,
    now()
  )
ON CONFLICT (id) DO UPDATE SET
  boss_id = EXCLUDED.boss_id,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  cards = EXCLUDED.cards,
  question = EXCLUDED.question,
  answers = EXCLUDED.answers,
  correct_answer_id = EXCLUDED.correct_answer_id,
  explanation = EXCLUDED.explanation,
  reward_xp = EXCLUDED.reward_xp,
  knowledge_reward = EXCLUDED.knowledge_reward,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.complete_financial_lesson_v1(
  p_user_id text,
  p_lesson_id text,
  p_answer_id text
)
RETURNS TABLE(
  outcome text,
  lesson_id text,
  reward_xp integer,
  knowledge_reward integer,
  xp integer,
  level integer,
  knowledge integer,
  explanation text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lesson public.financial_lessons%ROWTYPE;
  v_lesson_progress public.user_lesson_progress%ROWTYPE;
  v_progress public.user_progress%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user_id || E'\x1f' || p_lesson_id, 0)
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.user_id = p_user_id
  ) THEN
    RETURN QUERY SELECT 'profile_not_found'::text, p_lesson_id,
      0::integer, 0::integer, NULL::integer, NULL::integer,
      NULL::integer, NULL::text;
    RETURN;
  END IF;

  SELECT fl.*
  INTO v_lesson
  FROM public.financial_lessons AS fl
  WHERE fl.id = p_lesson_id
    AND fl.is_active = true;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'lesson_not_found'::text, p_lesson_id,
      0::integer, 0::integer, NULL::integer, NULL::integer,
      NULL::integer, NULL::text;
    RETURN;
  END IF;

  INSERT INTO public.user_progress AS up
    (user_id, xp, level, discipline, savings, knowledge)
  VALUES (p_user_id, 0, 1, 0, 0, 0)
  ON CONFLICT ON CONSTRAINT user_progress_pkey DO NOTHING;

  SELECT ulp.*
  INTO v_lesson_progress
  FROM public.user_lesson_progress AS ulp
  WHERE ulp.user_id = p_user_id
    AND ulp.lesson_id = p_lesson_id
  FOR UPDATE;

  IF FOUND AND v_lesson_progress.status = 'completed' THEN
    SELECT up.*
    INTO v_progress
    FROM public.user_progress AS up
    WHERE up.user_id = p_user_id;

    RETURN QUERY SELECT 'lesson_already_completed'::text, v_lesson.id,
      0::integer, 0::integer, v_progress.xp, v_progress.level,
      v_progress.knowledge, NULL::text;
    RETURN;
  END IF;

  IF p_answer_id IS DISTINCT FROM v_lesson.correct_answer_id THEN
    INSERT INTO public.user_lesson_progress AS ulp
      (user_id, lesson_id, status, selected_answer_id, completed_at, updated_at)
    VALUES (p_user_id, v_lesson.id, 'in_progress', p_answer_id, NULL, now())
    ON CONFLICT ON CONSTRAINT user_lesson_progress_pkey DO UPDATE SET
      status = 'in_progress',
      selected_answer_id = EXCLUDED.selected_answer_id,
      completed_at = NULL,
      updated_at = now();

    SELECT up.*
    INTO v_progress
    FROM public.user_progress AS up
    WHERE up.user_id = p_user_id;

    RETURN QUERY SELECT 'incorrect_answer'::text, v_lesson.id,
      0::integer, 0::integer, v_progress.xp, v_progress.level,
      v_progress.knowledge, v_lesson.explanation;
    RETURN;
  END IF;

  INSERT INTO public.user_lesson_progress AS ulp
    (user_id, lesson_id, status, selected_answer_id, completed_at, updated_at)
  VALUES (p_user_id, v_lesson.id, 'completed', p_answer_id, now(), now())
  ON CONFLICT ON CONSTRAINT user_lesson_progress_pkey DO UPDATE SET
    status = 'completed',
    selected_answer_id = EXCLUDED.selected_answer_id,
    completed_at = now(),
    updated_at = now();

  UPDATE public.user_progress AS up
  SET xp = up.xp + v_lesson.reward_xp,
      level = floor((up.xp + v_lesson.reward_xp) / 100.0)::integer + 1,
      knowledge = up.knowledge + v_lesson.knowledge_reward,
      updated_at = now()
  WHERE up.user_id = p_user_id
  RETURNING up.* INTO v_progress;

  RETURN QUERY SELECT 'success'::text, v_lesson.id,
    v_lesson.reward_xp, v_lesson.knowledge_reward, v_progress.xp,
    v_progress.level, v_progress.knowledge, v_lesson.explanation;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_financial_lesson_v1(text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_financial_lesson_v1(text, text, text)
  TO service_role;
