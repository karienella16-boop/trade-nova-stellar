
CREATE TABLE public.plan_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_number INT NOT NULL,
  tier_name TEXT NOT NULL,
  duration_days INT NOT NULL,
  amount_usd NUMERIC(18,2) NOT NULL,
  amount_ngn NUMERIC(18,2),
  method TEXT NOT NULL CHECK (method IN ('usdt','bank')),
  network TEXT,
  tx_hash TEXT,
  reference TEXT NOT NULL,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_payments TO authenticated;
GRANT ALL ON public.plan_payments TO service_role;
ALTER TABLE public.plan_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own payments" ON public.plan_payments FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users insert own payments" ON public.plan_payments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update payments" ON public.plan_payments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER plan_payments_updated BEFORE UPDATE ON public.plan_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.payment_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  usdt_trc20 TEXT DEFAULT '',
  usdt_bep20 TEXT DEFAULT '',
  usdt_erc20 TEXT DEFAULT '',
  bank_name TEXT DEFAULT '',
  bank_account_name TEXT DEFAULT '',
  bank_account_number TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_config TO authenticated;
GRANT ALL ON public.payment_config TO service_role;
ALTER TABLE public.payment_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Any signed-in user can read config" ON public.payment_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage config" ON public.payment_config FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.payment_config (id, usdt_trc20, usdt_bep20, usdt_erc20, bank_name, bank_account_name, bank_account_number)
VALUES (1,
  'TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  '0xXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  '0xXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  'Access Bank',
  'TradeNova Mining Ltd',
  '0123456789'
);

CREATE POLICY "Users upload own receipts" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users read own receipts" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'receipts' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));
