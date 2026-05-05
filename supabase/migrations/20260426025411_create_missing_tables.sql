-- login_attempt_tracker
CREATE TABLE IF NOT EXISTS public.login_attempt_tracker (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    phone_hash text NOT NULL,
    ip_device_hash text NOT NULL,
    failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
    lock_expires_at timestamptz,
    last_failed_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    UNIQUE (phone_hash, ip_device_hash)
);

CREATE INDEX IF NOT EXISTS idx_login_attempt_tracker_phone_hash ON public.login_attempt_tracker(phone_hash);
CREATE INDEX IF NOT EXISTS idx_login_attempt_tracker_lock_expires_at ON public.login_attempt_tracker(lock_expires_at);

ALTER TABLE public.login_attempt_tracker ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No Direct Access login_attempt_tracker" ON public.login_attempt_tracker
FOR ALL
USING (false)
WITH CHECK (false);


-- customer_password_audit_logs
CREATE TABLE IF NOT EXISTS public.customer_password_audit_logs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    changed_at timestamptz NOT NULL DEFAULT NOW(),
    changed_by text NOT NULL DEFAULT 'customer',
    reason text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_customer_password_audit_customer ON public.customer_password_audit_logs(customer_id, changed_at DESC);

ALTER TABLE public.customer_password_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow All Select" ON public.customer_password_audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow All Insert" ON public.customer_password_audit_logs FOR INSERT WITH CHECK (true);
