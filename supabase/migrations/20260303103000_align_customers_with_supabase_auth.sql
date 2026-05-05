-- Align customers to Supabase Auth identifiers.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS auth_email text;

UPDATE public.customers
SET auth_email = regexp_replace(phone_number, '[^0-9]', '', 'g') || '@phone.local'
WHERE auth_email IS NULL OR btrim(auth_email) = '';

ALTER TABLE public.customers
  ALTER COLUMN auth_email SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_auth_email_active
  ON public.customers (auth_email)
  WHERE deleted_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_id_fkey_auth_users'
      AND conrelid = 'public.customers'::regclass
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_id_fkey_auth_users
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.set_customer_auth_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.auth_email IS NULL OR btrim(NEW.auth_email) = '' THEN
    NEW.auth_email := regexp_replace(NEW.phone_number, '[^0-9]', '', 'g') || '@phone.local';
  END IF;

  NEW.auth_email := lower(NEW.auth_email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_customer_auth_email ON public.customers;
CREATE TRIGGER trg_set_customer_auth_email
BEFORE INSERT OR UPDATE OF phone_number, auth_email
ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.set_customer_auth_email();

-- Backfill customer IDs to auth.users.id where auth email matches and no collision exists.
CREATE TEMP TABLE tmp_customer_auth_map AS
SELECT c.id AS old_id, u.id AS new_id
FROM public.customers c
JOIN auth.users u ON lower(u.email) = lower(c.auth_email)
WHERE c.id <> u.id
  AND NOT EXISTS (SELECT 1 FROM public.customers c2 WHERE c2.id = u.id);

UPDATE public.visit_history vh
SET customer_id = m.new_id
FROM tmp_customer_auth_map m
WHERE vh.customer_id = m.old_id;

UPDATE public.coupon_history ch
SET customer_id = m.new_id
FROM tmp_customer_auth_map m
WHERE ch.customer_id = m.old_id;

UPDATE public.bug_reports br
SET customer_id = m.new_id
FROM tmp_customer_auth_map m
WHERE br.customer_id = m.old_id;

UPDATE public.vote_responses vr
SET customer_id = m.new_id
FROM tmp_customer_auth_map m
WHERE vr.customer_id = m.old_id;

UPDATE public.customer_password_audit_logs cpal
SET customer_id = m.new_id
FROM tmp_customer_auth_map m
WHERE cpal.customer_id = m.old_id;

UPDATE public.customers c
SET id = m.new_id
FROM tmp_customer_auth_map m
WHERE c.id = m.old_id;

DROP TABLE tmp_customer_auth_map;
