-- PERF-2: 데이터 보존 크론.
--
-- 배경: visit_history / vote_responses 등에 데이터 만료·아카이빙 메커니즘이 없어
--       테이블이 무한정 증가하면 스토리지 비용과 쿼리 비용이 선형으로 오른다.
--       하루 1회 보존 크론으로 오래된 데이터를 정리하고, 매 실행을
--       data_retention_log 에 1행 감사 기록한다.
--
-- 요구사항 대비 명칭/스키마 정정 (design.md "Req 5 (PERF-2)" 참고):
--   - requirements 의 readings / visits / coupons 테이블명은 실제 스키마와 다르다.
--     실제로 존재하는 대상은 visit_history / vote_responses / votes 이다.
--   - requirements 5.4 는 "visits.card_review 가 비어있지 않으면 보존"을 요구하나
--     visit_history 에는 card_review 컬럼이 존재하지 않는다(스키마 확인 완료).
--     상담 메모 텍스트는 매니저 앱 스키마 소유 데이터일 가능성이 높다.
--     따라서 이 크론은 visit_history 를 보존 대상에서 "제외"한다(매장 소유 데이터).
--     card_review 보존 규칙은 매니저 스키마가 그 컬럼을 소유·노출하기로
--     협의된 뒤에 구현한다. 이 사유는 실행마다 data_retention_log.detail 에도 남는다.
--     (docs/manager-app-db-issues.md 협의 항목과 연결.)
--
-- 삭제 대상 (Req 5.3):
--   - vote_responses: 연관 votes.ends_at 이 run_start 기준 365일보다 오래된 행.
--     vote_responses 에는 deleted_at/is_deleted 소프트 컬럼이 없으므로 하드 삭제한다.
--
-- 삭제 모드 결정론 (Req 5.2):
--   - 테이블에 deleted_at/is_deleted 가 있으면 소프트, 없으면 하드.
--   - vote_responses 는 소프트 컬럼이 없어 하드 삭제로 "결정론적"으로 선택된다.
--     (동일 입력에 대해 항상 같은 모드.)
--
-- 배치·부분 실패 (Req 5.7):
--   - 배치당 최대 1000행씩 삭제하고 각 배치를 독립 COMMIT 한다(롤백 없음).
--   - 이를 위해 FUNCTION 이 아니라 PROCEDURE 로 구현한다. plpgsql FUNCTION 내부에서는
--     트랜잭션 제어(COMMIT)가 불가하지만, 최상위에서 CALL 되는 PROCEDURE 는
--     각 배치 사이에서 COMMIT 할 수 있다. pg_cron 은 최상위에서 실행하므로 적합하다.
--   - 부분 실패 시 이미 COMMIT 된 배치는 보존되고, 실패 결과를 로그에 남긴다.
--   - 주의(plpgsql 제약): EXCEPTION 핸들러가 있는 블록은 서브트랜잭션을 형성하므로
--     그 안에서는 COMMIT 이 금지된다("invalid transaction termination", 2D000).
--     따라서 COMMIT 은 반드시 EXCEPTION 핸들러가 없는 "최상위" 실행 흐름에서만 한다.
--     배치 DELETE 만 EXCEPTION 이 있는 내부 블록으로 감싸 오류를 잡아 플래그에 담고,
--     실제 COMMIT/로그 기록은 그 블록 바깥(최상위)에서 수행한다.
--
-- 중복 실행 방지 (Req 5.9):
--   - pg_try_advisory_lock 으로 선행 실행이 안 끝났으면 즉시 skip 하고
--     outcome='skipped' 로그 1행을 남긴다.
--
-- 멱등성 (Req 5.8):
--   - 이미 삭제된 행은 선택 술어에 걸리지 않으므로 재실행 시 0행 영향.
--
-- 로깅 (Req 5.6):
--   - 성공/0행/부분실패/스킵 어느 결과든 실행당 정확히 1행을 기록한다.
--     (run 시작·종료 타임스탬프, 테이블별 영향 행수 jsonb, outcome.)
--
-- 보안: 로그 테이블은 RLS deny-all. 프로시저는 SECURITY DEFINER + search_path 고정,
--       service_role/postgres 만 EXECUTE(anon/authenticated REVOKE).
--
-- 참고: .kiro/specs/production-hardening (design.md "Req 5 (PERF-2)",
--       "Data Models > 신규: data_retention_log (PERF-2)").
--       기존 cleanup_ai_guest_sessions 크론 등록 주석 패턴을 재사용한다.


-- ---------------------------------------------------------------------------
-- 보존 실행 감사 로그 테이블.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.data_retention_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_started_at timestamptz NOT NULL,
  run_finished_at timestamptz,
  rows_affected jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {"vote_responses": 42, ...}
  outcome text NOT NULL CHECK (outcome IN ('success', 'partial_failure', 'skipped', 'no_rows')),
  detail text NOT NULL DEFAULT ''
);

-- 클라이언트 직접 접근 차단 (RLS deny-all). service_role/postgres 만 접근.
ALTER TABLE public.data_retention_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No Direct Access data_retention_log" ON public.data_retention_log;
CREATE POLICY "No Direct Access data_retention_log" ON public.data_retention_log
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.data_retention_log FROM anon, authenticated;


-- ---------------------------------------------------------------------------
-- 보존 크론 프로시저.
--
-- PROCEDURE 로 정의해 배치 사이 COMMIT(독립 커밋)을 가능하게 한다.
-- pg_cron 이나 운영자가 CALL public.run_data_retention(); 로 최상위 실행한다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE public.run_data_retention()
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- 동일 잡 이름을 안정적 정수 키로 매핑 (advisory lock 용).
  c_lock_key       constant bigint := hashtextextended('run_data_retention', 0);
  c_batch_size     constant int    := 1000;
  c_vote_retention constant interval := interval '365 days';

  -- visit_history 제외 사유 (Req 5.4 정정). 모든 결과 로그의 detail 접미로 붙인다.
  c_exclusion_note constant text :=
    'visit_history intentionally excluded: no card_review column in user-app schema '
    || 'and it is store(manager-app)-owned data; retention pending manager-schema agreement '
    || '(Req 5.4 correction, see docs/manager-app-db-issues.md).';

  v_run_start   timestamptz := now();
  v_got_lock    boolean;
  v_batch       int;
  v_vote_resp   bigint := 0;    -- vote_responses 하드 삭제 누적 행수
  v_failed      boolean := false;
  v_err         text := '';
  v_outcome     text;
  v_detail      text := '';
BEGIN
  -- --- 중복 실행 방지 (Req 5.9) ---------------------------------------------
  -- 세션 레벨 advisory lock. 선행 실행이 아직 락을 쥐고 있으면 즉시 skip.
  -- (이 블록에는 EXCEPTION 핸들러가 없으므로 최상위 흐름 → COMMIT 허용.)
  v_got_lock := pg_try_advisory_lock(c_lock_key);

  IF NOT v_got_lock THEN
    INSERT INTO public.data_retention_log
      (run_started_at, run_finished_at, rows_affected, outcome, detail)
    VALUES
      (v_run_start, now(), '{}'::jsonb, 'skipped',
       'A prior run_data_retention execution is still in progress; this run was skipped (Req 5.9). '
       || c_exclusion_note);
    COMMIT;
    RETURN;
  END IF;

  -- --- vote_responses 하드 삭제 (Req 5.3, 5.2 하드 모드) ----------------------
  -- 대상: 연관 votes.ends_at 이 run_start 기준 365일보다 오래된 응답 행.
  -- vote_responses 에는 소프트 컬럼이 없으므로 하드 삭제(결정론적).
  -- 배치당 최대 1000행씩 지우고 각 배치를 독립 COMMIT 한다(Req 5.7).
  -- 이미 삭제된 행은 선택되지 않으므로 재실행 시 0행 영향(Req 5.8 멱등).
  --
  -- plpgsql 제약 회피: COMMIT 은 EXCEPTION 핸들러가 있는 블록 안에서 금지되므로
  -- 배치 DELETE 만 내부 서브블록(EXCEPTION 포함)으로 감싸 오류를 잡고, 실제 COMMIT 은
  -- 그 서브블록 "바깥"(최상위 LOOP 흐름)에서 수행한다.
  LOOP
    BEGIN
      DELETE FROM public.vote_responses vr
      WHERE vr.id IN (
        SELECT vr2.id
        FROM public.vote_responses vr2
        JOIN public.votes v ON v.id = vr2.vote_id
        WHERE v.ends_at IS NOT NULL
          AND v.ends_at < v_run_start - c_vote_retention
        LIMIT c_batch_size
      );
      GET DIAGNOSTICS v_batch = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
      -- 이 배치는 서브트랜잭션 롤백된다(부분 진행 없음). 이전에 COMMIT 된 배치는 유지.
      v_failed := true;
      v_err := SQLERRM;
      v_batch := 0;
    END;

    v_vote_resp := v_vote_resp + v_batch;

    IF v_failed THEN
      EXIT;  -- 실패 시 루프 종료 → 최상위에서 부분실패 로깅
    END IF;

    -- 각 배치 독립 커밋(최상위 흐름). 부분 실패 시에도 커밋된 배치는 보존(Req 5.7).
    COMMIT;

    EXIT WHEN v_batch < c_batch_size;  -- 마지막(부분) 배치면 종료
  END LOOP;

  -- --- 결과 판정 + 로깅 (Req 5.6) --------------------------------------------
  -- visit_history 는 의도적으로 제외한다(Req 5.4 정정): card_review 컬럼 부재 +
  -- 매장(매니저 앱) 소유 데이터. 사유를 로그 detail 에 남긴다.
  IF v_failed THEN
    v_outcome := 'partial_failure';
    v_detail  := 'partial_failure during vote_responses retention: ' || v_err
              || ' | committed batches retained (no rollback). ' || c_exclusion_note;
  ELSIF v_vote_resp = 0 THEN
    v_outcome := 'no_rows';
    v_detail  := 'no eligible vote_responses rows to delete. ' || c_exclusion_note;
  ELSE
    v_outcome := 'success';
    v_detail  := 'vote_responses hard-deleted where votes.ends_at older than 365 days. '
              || c_exclusion_note;
  END IF;

  -- 실행당 정확히 1행 기록(성공/0행/부분실패). (최상위 흐름 → COMMIT 허용.)
  INSERT INTO public.data_retention_log
    (run_started_at, run_finished_at, rows_affected, outcome, detail)
  VALUES
    (v_run_start, now(),
     jsonb_build_object('vote_responses', v_vote_resp),
     v_outcome, v_detail);
  COMMIT;

  PERFORM pg_advisory_unlock(c_lock_key);
END;
$$;

-- 클라이언트 롤에는 노출하지 않는다. service_role/postgres 만 CALL 가능.
REVOKE ALL ON PROCEDURE public.run_data_retention() FROM PUBLIC, anon, authenticated;

-- 주기 실행 예시 (pg_cron 활성화 후 운영자가 1회 등록):
--   0 18 * * *  (UTC 18:00 = KST 03:00). Req 5.1: 하루 1회, 3600초 내 완료.
--   pg_cron 은 CALL 을 지원하는 버전에서 다음처럼 등록한다:
--     SELECT cron.schedule('run-data-retention', '0 18 * * *',
--                          $cron$ CALL public.run_data_retention(); $cron$);
--   (마이그레이션은 cron.schedule 을 강제 실행하지 않는다. 운영자가 1회 등록한다.)
