CREATE OR REPLACE FUNCTION public.validate_password_complexity(p_password text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_password IS NULL THEN
    RETURN false;
  END IF;
  RETURN (char_length(p_password) >= 6);
END;
$$;
