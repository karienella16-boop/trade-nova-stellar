DO $$ BEGIN
  CREATE TYPE public.account_status AS ENUM ('pending','active','blocked','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status public.account_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

UPDATE public.profiles SET account_status = 'active' WHERE account_status = 'pending';

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  NEW.account_status := OLD.account_status;
  NEW.email_verified := OLD.email_verified;
  NEW.last_login_at := OLD.last_login_at;
  NEW.referral_code := OLD.referral_code;
  NEW.referred_by := OLD.referred_by;
  NEW.display_id := OLD.display_id;
  NEW.vip_level := OLD.vip_level;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_profiles_protect ON public.profiles;
CREATE TRIGGER trg_profiles_protect BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

CREATE TABLE IF NOT EXISTS public.otp_request_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  purpose text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS otp_request_log_email_created_idx ON public.otp_request_log (email, created_at DESC);
GRANT ALL ON public.otp_request_log TO service_role;
ALTER TABLE public.otp_request_log ENABLE ROW LEVEL SECURITY;