-- Helper role functions
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','super_admin','finance_admin','support_admin','user_admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_finance_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(_user_id, ARRAY['admin','super_admin','finance_admin']::app_role[])
$$;

CREATE OR REPLACE FUNCTION public.is_support_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(_user_id, ARRAY['admin','super_admin','support_admin']::app_role[])
$$;

CREATE OR REPLACE FUNCTION public.is_user_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(_user_id, ARRAY['admin','super_admin','user_admin']::app_role[])
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(_user_id, ARRAY['admin','super_admin']::app_role[])
$$;

-- BANK ACCOUNTS
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text NOT NULL,
  account_name text NOT NULL,
  account_number text NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users view active bank accounts" ON public.bank_accounts
  FOR SELECT TO authenticated USING (is_active = true OR public.is_finance_admin(auth.uid()));
CREATE POLICY "Finance admins manage bank accounts" ON public.bank_accounts
  FOR ALL TO authenticated USING (public.is_finance_admin(auth.uid())) WITH CHECK (public.is_finance_admin(auth.uid()));
CREATE TRIGGER trg_bank_accounts_updated BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- USDT WALLETS
CREATE TABLE public.usdt_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network text NOT NULL,
  address text NOT NULL,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usdt_wallets TO authenticated;
GRANT ALL ON public.usdt_wallets TO service_role;
ALTER TABLE public.usdt_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users view active wallets" ON public.usdt_wallets
  FOR SELECT TO authenticated USING (is_active = true OR public.is_finance_admin(auth.uid()));
CREATE POLICY "Finance admins manage usdt wallets" ON public.usdt_wallets
  FOR ALL TO authenticated USING (public.is_finance_admin(auth.uid())) WITH CHECK (public.is_finance_admin(auth.uid()));
CREATE TRIGGER trg_usdt_wallets_updated BEFORE UPDATE ON public.usdt_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- SUPPORT TICKETS
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  assigned_to uuid,
  last_reply_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_support_admin(auth.uid()));
CREATE POLICY "Users create own tickets" ON public.support_tickets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Support admins update tickets" ON public.support_tickets
  FOR UPDATE TO authenticated USING (public.is_support_admin(auth.uid())) WITH CHECK (public.is_support_admin(auth.uid()));
CREATE TRIGGER trg_support_tickets_updated BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- SUPPORT MESSAGES
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ticket participants view messages" ON public.support_messages
  FOR SELECT TO authenticated USING (
    public.is_support_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
  );
CREATE POLICY "Ticket participants send messages" ON public.support_messages
  FOR INSERT TO authenticated WITH CHECK (
    sender_id = auth.uid() AND (
      public.is_support_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
    )
  );

-- ACTIVITY LOGS
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event_type text NOT NULL,
  description text,
  record_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view activity" ON public.activity_logs
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Users log own activity" ON public.activity_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- ADMIN AUDIT LOGS (immutable)
CREATE TABLE public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_user_id uuid,
  target_table text,
  target_record_id uuid,
  reason text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view audit logs" ON public.admin_audit_logs
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins write audit logs" ON public.admin_audit_logs
  FOR INSERT TO authenticated WITH CHECK (admin_id = auth.uid() AND public.is_admin(auth.uid()));

-- PLAN PAYMENTS review fields
ALTER TABLE public.plan_payments
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

-- WITHDRAWALS review fields
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS balance_deducted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS decline_reason text;

-- Admin visibility on existing tables
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "User admins update profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_user_admin(auth.uid())) WITH CHECK (public.is_user_admin(auth.uid()));
CREATE POLICY "Admins view all checkins" ON public.checkins
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins view all user tasks" ON public.user_tasks
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins view all referrals" ON public.referrals
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Grant super admin to the designated account if it exists
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::app_role FROM auth.users WHERE lower(email) = 'arowojolu17@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;