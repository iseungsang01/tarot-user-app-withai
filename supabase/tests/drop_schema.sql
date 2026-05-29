-- ==========================================
-- ⚠️ 경고: 이 스크립트는 서비스의 모든 데이터를 삭제합니다!
-- 프로젝트 초기화 목적(로컬 테스트 또는 스키마 재생성)으로만 사용하세요.
-- 기존 스키마를 모두 DROP하고 깨끗한 상태로 만듭니다.
-- ==========================================

-- 1. 모든 함수(RPC), 뷰, 트리거 등 삭제
DROP FUNCTION IF EXISTS public.register_customer(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.login_customer(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.update_my_nickname(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.delete_my_account(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.increment_visit_count(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.verify_admin_password(text) CASCADE;
DROP FUNCTION IF EXISTS public.verify_admin_login(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.update_admin_settings(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.verify_password(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.update_customer_password(uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.validate_password_complexity(text) CASCADE;
DROP FUNCTION IF EXISTS public.get_my_ai_monthly_usage(text, date) CASCADE;
DROP FUNCTION IF EXISTS public.increment_my_ai_monthly_usage(text, text, date, integer) CASCADE;
DROP TABLE IF EXISTS public.ai_monthly_usage CASCADE;
DROP FUNCTION IF EXISTS public.increment_ai_proxy_rate_limit(text, text, text, timestamptz, integer) CASCADE;
DROP FUNCTION IF EXISTS public.apply_ai_proxy_token_usage(uuid, date, text, bigint, bigint, bigint) CASCADE;

-- 2. 모든 테이블 삭제
DROP TABLE IF EXISTS public.ai_proxy_token_quotas CASCADE;
DROP TABLE IF EXISTS public.ai_proxy_rate_limits CASCADE;
DROP TABLE IF EXISTS public.customer_password_audit_logs CASCADE;
DROP TABLE IF EXISTS public.login_attempt_tracker CASCADE;
DROP TABLE IF EXISTS public.app_configs CASCADE;
DROP TABLE IF EXISTS public.vote_responses CASCADE;
DROP TABLE IF EXISTS public.votes CASCADE;
DROP TABLE IF EXISTS public.bug_reports CASCADE;
DROP TABLE IF EXISTS public.notices CASCADE;
DROP TABLE IF EXISTS public.coupon_history CASCADE;
DROP TABLE IF EXISTS public.visit_history CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;

-- ※ 참고: 위 스크립트를 실행해 기존 데이터와 스키마를 완전히 지운 뒤, 
-- `supabase/schema.sql` 파일을 실행하면 텅 빈 초기 상태부터 다시 시작하실 수 있습니다.
