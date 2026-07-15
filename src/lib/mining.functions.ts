import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [profileRes, walletRes, miningRes, referralsRes, todayTxRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("wallets").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("user_mining")
        .select("*, plans(name, tier)")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("referrals").select("id, commission_earned").eq("referrer_id", userId),
      supabase
        .from("transactions")
        .select("amount, type, created_at")
        .eq("user_id", userId)
        .in("type", ["mining_reward", "referral_reward", "checkin_reward", "task_reward", "bonus"])
        .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
    ]);

    if (profileRes.error) throw profileRes.error;
    if (walletRes.error) throw walletRes.error;

    const profile = profileRes.data;
    const wallet = walletRes.data;
    const mining = miningRes.data ?? null;
    const referralCount = referralsRes.data?.length ?? 0;
    const referralEarnings = (referralsRes.data ?? []).reduce(
      (sum: number, r: { commission_earned: number | null }) =>
        sum + Number(r.commission_earned ?? 0),
      0,
    );
    const dailyEarnings = (todayTxRes.data ?? []).reduce(
      (sum: number, t: { amount: number | null }) => sum + Number(t.amount ?? 0),
      0,
    );

    let liveAccrued = Number(mining?.accrued ?? 0);
    if (mining && mining.is_active) {
      const now = Date.now();
      const started = new Date(mining.last_claimed_at).getTime();
      const expiresAt = new Date(mining.expires_at).getTime();
      const effectiveNow = Math.min(now, expiresAt);
      const elapsedSec = Math.max(0, (effectiveNow - started) / 1000);
      const perSecond = Number(mining.daily_earnings) / 86400;
      liveAccrued = Number(mining.accrued) + perSecond * elapsedSec;
    }

    return {
      profile,
      wallet,
      mining: mining ? { ...mining, live_accrued: liveAccrued } : null,
      referralCount,
      referralEarnings,
      dailyEarnings,
    };
  });

export const claimMining = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: mining, error } = await supabase
      .from("user_mining")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!mining) throw new Error("No active mining session");

    const now = Date.now();
    const started = new Date(mining.last_claimed_at).getTime();
    const expiresAt = new Date(mining.expires_at).getTime();
    const effectiveNow = Math.min(now, expiresAt);
    const elapsedSec = Math.max(0, (effectiveNow - started) / 1000);
    const perSecond = Number(mining.daily_earnings) / 86400;
    const earned = perSecond * elapsedSec;
    if (earned <= 0) return { earned: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("mining_balance, total_earned")
      .eq("user_id", userId)
      .maybeSingle();
    if (!wallet) throw new Error("Wallet missing");

    await supabaseAdmin
      .from("wallets")
      .update({
        mining_balance: Number(wallet.mining_balance) + earned,
        total_earned: Number(wallet.total_earned) + earned,
      })
      .eq("user_id", userId);

    const isExpired = now >= expiresAt;
    await supabaseAdmin
      .from("user_mining")
      .update({
        last_claimed_at: new Date(effectiveNow).toISOString(),
        accrued: Number(mining.accrued) + earned,
        is_active: !isExpired,
      })
      .eq("id", mining.id);

    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      type: "mining_reward",
      amount: earned,
      status: "completed",
      description: "Mining reward claimed",
      reference_id: mining.id,
    });

    return { earned };
  });

export const startFreeTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("user_mining")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (existing) throw new Error("You already have a mining session");

    const { data: plan, error: planErr } = await supabase
      .from("plans")
      .select("*")
      .eq("tier", "starter")
      .maybeSingle();
    if (planErr || !plan) throw new Error("Starter plan not available");

    const now = new Date();
    const expires = new Date(now.getTime() + 24 * 3600 * 1000);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: insErr } = await supabaseAdmin.from("user_mining").insert({
      user_id: userId,
      plan_id: plan.id,
      hash_rate_ghs: 25,
      daily_earnings: 0.5,
      started_at: now.toISOString(),
      expires_at: expires.toISOString(),
      last_claimed_at: now.toISOString(),
    });
    if (insErr) throw insErr;
    return { ok: true };
  });

export const buyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ planId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: plan, error: planErr } = await supabase
      .from("plans")
      .select("*")
      .eq("id", data.planId)
      .maybeSingle();
    if (planErr || !plan) throw new Error("Plan not found");

    const { data: wallet } = await supabase
      .from("wallets")
      .select("main_balance")
      .eq("user_id", userId)
      .maybeSingle();
    if (!wallet) throw new Error("Wallet not found");

    if (Number(wallet.main_balance) < Number(plan.price)) {
      throw new Error("Insufficient balance. Please deposit first.");
    }

    const now = new Date();
    const expires = new Date(now.getTime() + plan.duration_days * 86400 * 1000);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("wallets")
      .update({ main_balance: Number(wallet.main_balance) - Number(plan.price) })
      .eq("user_id", userId);

    await supabaseAdmin
      .from("user_mining")
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("is_active", true);

    await supabaseAdmin.from("user_mining").insert({
      user_id: userId,
      plan_id: plan.id,
      hash_rate_ghs: plan.hash_rate_ghs,
      daily_earnings: plan.daily_earnings,
      started_at: now.toISOString(),
      expires_at: expires.toISOString(),
      last_claimed_at: now.toISOString(),
    });

    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      type: "plan_purchase",
      amount: -Number(plan.price),
      status: "completed",
      description: `Purchased ${plan.name}`,
      reference_id: plan.id,
    });

    return { ok: true };
  });

export const getPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw error;
    return data;
  });