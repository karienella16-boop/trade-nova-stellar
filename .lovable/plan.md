# TradeNova Mining — Build Plan

This is a large platform. I'll build it in phases so you can see progress and steer. Everything is real (Lovable Cloud auth + database), with deposits/withdrawals as admin-managed request workflows.

## Design System (all phases)
Premium dark theme:
- Black base (`#0A0A0A` / near-black surfaces)
- Emerald green primary (mining/growth)
- Gold accent (VIP / rewards)
- White text, subtle metallic gradients & glow shadows
- Rounded cards, monospaced hash-rate readouts, animated progress bars

## Phase 1 — Foundation (this turn)
1. Enable Lovable Cloud
2. Design tokens in `src/styles.css` (black/green/gold/white)
3. Auth: email/password + Google sign-in, `/auth` page
4. Database schema:
   - `profiles` (name, phone, kyc_status, vip_level, user_id_display, referral_code, referred_by)
   - `user_roles` + `has_role()` (admin/user)
   - `wallets` (main, mining, bonus, referral balances)
   - `plans` (starter/silver/gold/platinum — seeded)
   - `user_mining` (active plan, started_at, expires_at, hash_rate, accrued)
   - `deposits` (network, amount, tx_hash, status)
   - `withdrawals` (network, address, amount, status)
   - `transactions` (unified history)
   - `referrals`, `checkins`, `tasks`, `user_tasks`
   - `deposit_addresses` (admin-configured receiving addresses per network)
5. RLS policies + GRANTs on every table
6. App shell: mobile-first bottom nav (Home / Mining / Wallet / Referrals / Profile)
7. Dashboard page with all stats
8. Mining page with start/stop, progress bar, live earnings tick

## Phase 2 (next turn)
- Mining Plans page (buy plan → deducts main balance, activates mining)
- Wallet page + Deposit flow (show admin address + QR + copy, submit tx hash)
- Withdrawal flow (request, pending list)
- Transaction history

## Phase 3
- Referral program (link, code, leaderboard, commission on plan purchases)
- Daily check-in (streak rewards)
- Task Center
- VIP Levels page
- Profile / Security (change password, 2FA toggle, logout)
- Support page (WhatsApp/Telegram/Email links + FAQ)

## Phase 4
- Admin panel: configure deposit addresses, approve/reject deposits & withdrawals, adjust balances, view users

## Technical notes
- All server logic via `createServerFn` (mining accrual, plan purchase, deposit submission, withdrawal request)
- Mining earnings computed server-side from `started_at` + `hash_rate` + plan daily rate; balance updated on claim/stop
- Balances never trusted from client
- Real crypto addresses you enter in admin; users submit tx hashes for verification

## Confirm to proceed with Phase 1
I'll start building Phase 1 (foundation + Dashboard + Mining) immediately once approved. Reply "go" or adjust the plan.
