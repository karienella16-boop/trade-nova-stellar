ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending';