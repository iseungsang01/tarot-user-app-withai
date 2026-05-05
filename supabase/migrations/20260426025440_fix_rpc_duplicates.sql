DROP FUNCTION IF EXISTS public.login_customer(text, text);
DROP FUNCTION IF EXISTS public.login_customer(text, text, text);

CREATE OR REPLACE FUNCTION public.login_customer(
    p_phone text,
    p_password text,
    p_client_fingerprint text DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_customer public.customers%ROWTYPE;
    v_phone_hash text;
    v_device_hash text;
    v_phone_lock_expires_at timestamptz;
    v_device_lock_expires_at timestamptz;
    v_lock_expires_at timestamptz;
    v_max_failed_attempts integer := 5;
    v_lock_minutes integer := 5;
BEGIN
    v_phone_hash := encode(extensions.digest(p_phone, 'sha256'), 'hex');
    v_device_hash := encode(extensions.digest(COALESCE(NULLIF(trim(p_client_fingerprint), ''), 'unknown'), 'sha256'), 'hex');

    SELECT lock_expires_at
    INTO v_phone_lock_expires_at
    FROM public.login_attempt_tracker
    WHERE phone_hash = v_phone_hash
      AND ip_device_hash = '__phone__';

    SELECT lock_expires_at
    INTO v_device_lock_expires_at
    FROM public.login_attempt_tracker
    WHERE phone_hash = v_phone_hash
      AND ip_device_hash = v_device_hash;

    v_lock_expires_at := GREATEST(
        COALESCE(v_phone_lock_expires_at, '-infinity'::timestamptz),
        COALESCE(v_device_lock_expires_at, '-infinity'::timestamptz)
    );

    IF v_lock_expires_at > NOW() THEN
        RETURN jsonb_build_object(
            'success', false,
            'locked', true,
            'lock_expires_at', v_lock_expires_at,
            'message', '로그인 시도가 많아 잠시 제한되었습니다. 잠시 후 다시 시도해주세요.'
        );
    END IF;

    SELECT * INTO v_customer
    FROM public.customers
    WHERE phone_number = p_phone AND deleted_at IS NULL;

    IF v_customer.id IS NULL OR v_customer.password != extensions.crypt(p_password, v_customer.password) THEN
        INSERT INTO public.login_attempt_tracker (phone_hash, ip_device_hash, failed_attempts, lock_expires_at, last_failed_at, updated_at)
        VALUES (
            v_phone_hash,
            '__phone__',
            1,
            NULL,
            NOW(),
            NOW()
        )
        ON CONFLICT (phone_hash, ip_device_hash)
        DO UPDATE SET
            failed_attempts = CASE
                WHEN COALESCE(public.login_attempt_tracker.lock_expires_at, '-infinity'::timestamptz) > NOW() THEN public.login_attempt_tracker.failed_attempts
                ELSE public.login_attempt_tracker.failed_attempts + 1
            END,
            lock_expires_at = CASE
                WHEN COALESCE(public.login_attempt_tracker.lock_expires_at, '-infinity'::timestamptz) > NOW() THEN public.login_attempt_tracker.lock_expires_at
                WHEN public.login_attempt_tracker.failed_attempts + 1 >= v_max_failed_attempts THEN NOW() + make_interval(mins => v_lock_minutes)
                ELSE NULL
            END,
            last_failed_at = NOW(),
            updated_at = NOW();

        INSERT INTO public.login_attempt_tracker (phone_hash, ip_device_hash, failed_attempts, lock_expires_at, last_failed_at, updated_at)
        VALUES (
            v_phone_hash,
            v_device_hash,
            1,
            NULL,
            NOW(),
            NOW()
        )
        ON CONFLICT (phone_hash, ip_device_hash)
        DO UPDATE SET
            failed_attempts = CASE
                WHEN COALESCE(public.login_attempt_tracker.lock_expires_at, '-infinity'::timestamptz) > NOW() THEN public.login_attempt_tracker.failed_attempts
                ELSE public.login_attempt_tracker.failed_attempts + 1
            END,
            lock_expires_at = CASE
                WHEN COALESCE(public.login_attempt_tracker.lock_expires_at, '-infinity'::timestamptz) > NOW() THEN public.login_attempt_tracker.lock_expires_at
                WHEN public.login_attempt_tracker.failed_attempts + 1 >= v_max_failed_attempts THEN NOW() + make_interval(mins => v_lock_minutes)
                ELSE NULL
            END,
            last_failed_at = NOW(),
            updated_at = NOW();

        RETURN jsonb_build_object('success', false, 'message', '전화번호 또는 비밀번호가 일치하지 않습니다.');
    END IF;

    DELETE FROM public.login_attempt_tracker
    WHERE phone_hash = v_phone_hash
      AND ip_device_hash IN ('__phone__', v_device_hash);

    RETURN jsonb_build_object('success', true, 'id', v_customer.id, 'nickname', v_customer.nickname);
END;
$$;
