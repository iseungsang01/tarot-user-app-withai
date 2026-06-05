-- Keep visit_history rows available for administrators while allowing
-- customers to remove records from their own drawer/history UI.

ALTER TABLE public.visit_history
  ADD COLUMN IF NOT EXISTS is_hidden_by_customer boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_visit_history_customer_visible
  ON public.visit_history(customer_id, visit_date DESC)
  WHERE is_deleted = false AND is_hidden_by_customer = false;
