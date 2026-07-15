
-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.kyc_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
CREATE TYPE public.tx_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
CREATE TYPE public.tx_type AS ENUM ('deposit', 'withdrawal', 'mining_reward', 'referral_reward', 'bonus', 'plan_purchase', 'checkin_reward', 'task_reward', 'transfer');
CREATE TYPE public.crypto_network AS ENUM ('USDT_TRC20', 'USDT_BEP20', 'USDT_ERC20', 'BTC', 'ETH');
CREATE TYPE public.plan_tier AS ENUM ('starter', 'silver', 'gold', 'platinum');

-- ============================================
-- PROFILES
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_id TEXT NOT NULL UNIQUE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  kyc_status public.kyc_status NOT NULL DEFAULT 'unverified',
  vip_level INT NOT NULL DEFAULT 0,
  referral_code TEXT NOT NULL UNIQUE,
  referred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
  login_alerts_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============================================
-- ROLES
-- ============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- WALLETS
-- ============================================
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  main_balance NUMERIC(20,8) NOT NULL DEFAULT 0,
  mining_balance NUMERIC(20,8) NOT NULL DEFAULT 0,
  bonus_balance NUMERIC(20,8) NOT NULL DEFAULT 0,
  referral_balance NUMERIC(20,8) NOT NULL DEFAULT 0,
  total_earned NUMERIC(20,8) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own wallet" ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all wallets" ON public.wallets FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- PLANS
-- ============================================
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier public.plan_tier NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price NUMERIC(20,8) NOT NULL,
  hash_rate_ghs NUMERIC(20,4) NOT NULL,
  daily_earnings NUMERIC(20,8) NOT NULL,
  duration_days INT NOT NULL,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active plans" ON public.plans FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage plans" ON public.plans FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- USER MINING SESSIONS
-- ============================================
CREATE TABLE public.user_mining (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  hash_rate_ghs NUMERIC(20,4) NOT NULL,
  daily_earnings NUMERIC(20,8) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accrued NUMERIC(20,8) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_mining TO authenticated;
GRANT ALL ON public.user_mining TO service_role;
ALTER TABLE public.user_mining ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own mining" ON public.user_mining FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all mining" ON public.user_mining FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- DEPOSIT ADDRESSES (admin-managed)
-- ============================================
CREATE TABLE public.deposit_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network public.crypto_network NOT NULL UNIQUE,
  address TEXT NOT NULL,
  memo TEXT,
  min_deposit NUMERIC(20,8) NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.deposit_addresses TO authenticated;
GRANT ALL ON public.deposit_addresses TO service_role;
ALTER TABLE public.deposit_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view addresses" ON public.deposit_addresses FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admins manage addresses" ON public.deposit_addresses FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- DEPOSITS
-- ============================================
CREATE TABLE public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  network public.crypto_network NOT NULL,
  amount NUMERIC(20,8) NOT NULL,
  tx_hash TEXT,
  from_address TEXT,
  status public.tx_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT ON public.deposits TO authenticated;
GRANT ALL ON public.deposits TO service_role;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own deposits" ON public.deposits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own deposits" ON public.deposits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage deposits" ON public.deposits FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- WITHDRAWALS
-- ============================================
CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  network public.crypto_network NOT NULL,
  to_address TEXT NOT NULL,
  amount NUMERIC(20,8) NOT NULL,
  fee NUMERIC(20,8) NOT NULL DEFAULT 0,
  status public.tx_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own withdrawals" ON public.withdrawals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own withdrawals" ON public.withdrawals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage withdrawals" ON public.withdrawals FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- TRANSACTIONS (unified history)
-- ============================================
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.tx_type NOT NULL,
  amount NUMERIC(20,8) NOT NULL,
  status public.tx_status NOT NULL DEFAULT 'completed',
  description TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transactions" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all transactions" ON public.transactions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- REFERRALS
-- ============================================
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  commission_earned NUMERIC(20,8) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own referrals" ON public.referrals FOR SELECT TO authenticated USING (auth.uid() = referrer_id);

-- ============================================
-- DAILY CHECK-INS
-- ============================================
CREATE TABLE public.checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL,
  reward NUMERIC(20,8) NOT NULL,
  streak INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, checkin_date)
);
GRANT SELECT, INSERT ON public.checkins TO authenticated;
GRANT ALL ON public.checkins TO service_role;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own checkins" ON public.checkins FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own checkins" ON public.checkins FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============================================
-- TASKS
-- ============================================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  reward NUMERIC(20,8) NOT NULL,
  is_repeatable BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.tasks TO anon, authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone views active tasks" ON public.tasks FOR SELECT USING (is_active = true);

CREATE TABLE public.user_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reward NUMERIC(20,8) NOT NULL
);
GRANT SELECT, INSERT ON public.user_tasks TO authenticated;
GRANT ALL ON public.user_tasks TO service_role;
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own tasks" ON public.user_tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own tasks" ON public.user_tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_wallets_updated BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Handle new user: create profile + wallet + referral link
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_display_id TEXT;
  new_referral_code TEXT;
  ref_code TEXT;
  referrer UUID;
BEGIN
  new_display_id := 'TN' || LPAD(FLOOR(RANDOM() * 99999999)::TEXT, 8, '0');
  new_referral_code := UPPER(SUBSTRING(MD5(NEW.id::TEXT || RANDOM()::TEXT) FROM 1 FOR 8));
  ref_code := NEW.raw_user_meta_data ->> 'referral_code';

  IF ref_code IS NOT NULL THEN
    SELECT user_id INTO referrer FROM public.profiles WHERE referral_code = UPPER(ref_code) LIMIT 1;
  END IF;

  INSERT INTO public.profiles (user_id, display_id, full_name, email, referral_code, referred_by)
  VALUES (
    NEW.id,
    new_display_id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email,
    new_referral_code,
    referrer
  );

  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');

  IF referrer IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_id) VALUES (referrer, NEW.id);
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- SEED PLANS
-- ============================================
INSERT INTO public.plans (tier, name, price, hash_rate_ghs, daily_earnings, duration_days, features, sort_order) VALUES
('starter',  'Starter Plan',  50,    100,   1.5,   30, '["100 GH/s power","1.5 USDT/day","30 day duration","Basic support"]'::jsonb, 1),
('silver',   'Silver Plan',   250,   600,   9,     45, '["600 GH/s power","9 USDT/day","45 day duration","Priority support","5% referral bonus"]'::jsonb, 2),
('gold',     'Gold Plan',     1000,  2800,  42,    60, '["2.8 TH/s power","42 USDT/day","60 day duration","VIP support","8% referral bonus","Daily bonus rewards"]'::jsonb, 3),
('platinum', 'Platinum Plan', 5000,  16000, 240,   90, '["16 TH/s power","240 USDT/day","90 day duration","Dedicated manager","12% referral bonus","Weekly bonuses","Higher withdrawal limits"]'::jsonb, 4);

-- ============================================
-- SEED TASKS
-- ============================================
INSERT INTO public.tasks (code, title, description, reward, is_repeatable, sort_order) VALUES
('daily_login',    'Daily Login',         'Log in every day to earn a reward',            0.10, true,  1),
('verify_account', 'Verify Your Account', 'Complete KYC verification',                    5.00, false, 2),
('invite_friend',  'Invite a Friend',     'Refer a friend and both get rewarded',         2.00, true,  3),
('join_telegram',  'Join Telegram',       'Join our official Telegram community',         1.00, false, 4),
('join_whatsapp',  'Join WhatsApp',       'Join our WhatsApp announcements channel',      1.00, false, 5),
('watch_tutorial', 'Watch Tutorial',      'Watch the mining tutorial video',              0.50, false, 6);

-- ============================================
-- SEED DEPOSIT ADDRESSES (placeholder — admin edits)
-- ============================================
INSERT INTO public.deposit_addresses (network, address, min_deposit) VALUES
('USDT_TRC20', 'TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 10),
('USDT_BEP20', '0xXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 10),
('USDT_ERC20', '0xXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 20),
('BTC',        'bc1qxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 0.001),
('ETH',        '0xXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 0.01);
