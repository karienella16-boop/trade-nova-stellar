import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  ADMIN_ROLES,
  FINANCE_ROLES,
  SUPER_ROLES,
  SUPPORT_ROLES,
  USER_ADMIN_ROLES,
  type AdminRole,
} from "./admin-roles";

type Ctx = { supabase: any; userId: string };

async function loadRoles(ctx: Ctx): Promise<AdminRole[]> {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (error) throw error;
  return (data ?? []).map((r: { role: AdminRole }) => r.role);
}

async function requireRoles(ctx: Ctx, allowed: readonly string[]) {
  const roles = await loadRoles(ctx);
  if (!roles.some((r) => allowed.includes(r))) throw new Error("Forbidden");
  return roles;
}

async function audit(
  ctx: Ctx,
  entry: {
    action: string;
    target_user_id?: string | null;
    target_table?: string | null;
    target_record_id?: string | null;
    reason?: string | null;
    details?: Record<string, unknown>;
  },
) {
  await ctx.supabase.from("admin_audit_logs").insert({
    admin_id: ctx.userId,
    action: entry.action,
    target_user_id: entry.target_user_id ?? null,
    target_table: entry.target_table ?? null,
    target_record_id: entry.target_record_id ?? null,
    reason: entry.reason ?? null,
    details: entry.details ?? {},
  });
}

async function logActivity(
  ctx: Ctx,
  event_type: string,
  description: string,
  record_id?: string | null,
  user_id?: string | null,
) {
  await ctx.supabase.from("activity_logs").insert({
    user_id: user_id ?? ctx.userId,
    event_type,
    description,
    record_id: record_id ?? null,
  });
}

/* ------------------------------ access ------------------------------ */

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const roles = await loadRoles(context as Ctx);
    return {
      roles,
      isAdmin: roles.some((r) => ADMIN_ROLES.includes(r)),
      isSuper: roles.some((r) => SUPER_ROLES.includes(r)),
      isFinance: roles.some((r) => FINANCE_ROLES.includes(r)),
      isSupport: roles.some((r) => SUPPORT_ROLES.includes(r)),
      isUserAdmin: roles.some((r) => USER_ADMIN_ROLES.includes(r)),
    };
  });

/* ------------------------------ stats ------------------------------ */

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRoles(context as Ctx, ADMIN_ROLES);
    const sb = context.supabase;

    const [profiles, payments, withdrawals, mining, wallets, tickets] = await Promise.all([
      sb.from("profiles").select("email_verified, account_status"),
      sb.from("plan_payments").select("status, amount_usd"),
      sb.from("withdrawals").select("review_status, amount"),
      sb.from("user_mining").select("is_active, accrued"),
      sb.from("wallets").select("total_earned"),
      sb.from("support_tickets").select("status"),
    ]);

    const p = profiles.data ?? [];
    const pay = payments.data ?? [];
    const wd = withdrawals.data ?? [];
    const mn = mining.data ?? [];
    const wl = wallets.data ?? [];
    const tk = tickets.data ?? [];

    const sum = (rows: any[], key: string, pred: (r: any) => boolean = () => true) =>
      rows.filter(pred).reduce((s, r) => s + Number(r[key] ?? 0), 0);

    return {
      totalMembers: p.length,
      verifiedMembers: p.filter((r: any) => r.email_verified).length,
      unverifiedMembers: p.filter((r: any) => !r.email_verified).length,
      activeMembers: p.filter((r: any) => r.account_status === "active").length,
      suspendedMembers: p.filter((r: any) => r.account_status === "suspended").length,
      bannedMembers: p.filter((r: any) => r.account_status === "blocked").length,
      totalDeposits: sum(pay, "amount_usd"),
      pendingDeposits: pay.filter((r: any) => r.status === "pending" || r.status === "awaiting_confirmation").length,
      approvedDeposits: pay.filter((r: any) => r.status === "approved").length,
      declinedDeposits: pay.filter((r: any) => r.status === "declined" || r.status === "rejected").length,
      approvedDepositsValue: sum(pay, "amount_usd", (r) => r.status === "approved"),
      pendingWithdrawals: wd.filter((r: any) => r.review_status === "pending").length,
      approvedWithdrawals: wd.filter((r: any) => r.review_status === "approved" || r.review_status === "paid").length,
      declinedWithdrawals: wd.filter((r: any) => r.review_status === "declined").length,
      pendingWithdrawalValue: sum(wd, "amount", (r) => r.review_status === "pending"),
      activeMiningPlans: mn.filter((r: any) => r.is_active).length,
      totalMiningEarnings: sum(wl, "total_earned"),
      supportTickets: tk.length,
      openTickets: tk.filter((r: any) => r.status !== "closed" && r.status !== "resolved").length,
    };
  });

/* ------------------------------ users ------------------------------ */

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ search: z.string().max(120).optional() }).parse(i ?? {}))
  .handler(async ({ context, data }) => {
    await requireRoles(context as Ctx, ADMIN_ROLES);
    let q = context.supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.search) {
      const s = data.search.replace(/[%,]/g, "");
      q = q.or(`email.ilike.%${s}%,full_name.ilike.%${s}%,display_id.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw error;

    const ids = (rows ?? []).map((r: any) => r.user_id);
    const { data: wallets } = ids.length
      ? await context.supabase.from("wallets").select("*").in("user_id", ids)
      : { data: [] };
    const walletMap = new Map((wallets ?? []).map((w: any) => [w.user_id, w]));
    return (rows ?? []).map((r: any) => ({ ...r, wallet: walletMap.get(r.user_id) ?? null }));
  });

export const getUserDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await requireRoles(context as Ctx, ADMIN_ROLES);
    const sb = context.supabase;
    const uid = data.userId;
    const [profile, wallet, payments, withdrawals, mining, tickets, activity] = await Promise.all([
      sb.from("profiles").select("*").eq("user_id", uid).maybeSingle(),
      sb.from("wallets").select("*").eq("user_id", uid).maybeSingle(),
      sb.from("plan_payments").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      sb.from("withdrawals").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      sb.from("user_mining").select("*, plans(name, tier)").eq("user_id", uid).order("created_at", { ascending: false }),
      sb.from("support_tickets").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      sb.from("activity_logs").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(30),
    ]);
    return {
      profile: profile.data,
      wallet: wallet.data,
      payments: payments.data ?? [],
      withdrawals: withdrawals.data ?? [],
      mining: mining.data ?? [],
      tickets: tickets.data ?? [],
      activity: activity.data ?? [],
    };
  });

export const setUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        status: z.enum(["active", "suspended", "blocked", "pending"]),
        reason: z.string().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await requireRoles(context as Ctx, USER_ADMIN_ROLES);
    if ((data.status === "suspended" || data.status === "blocked") && !data.reason?.trim()) {
      throw new Error("A reason is required to suspend or ban a member");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ account_status: data.status })
      .eq("user_id", data.userId);
    if (error) throw error;

    const action =
      data.status === "blocked"
        ? "user_ban"
        : data.status === "suspended"
          ? "user_suspend"
          : "user_restore";
    await audit(context as Ctx, {
      action,
      target_user_id: data.userId,
      target_table: "profiles",
      reason: data.reason ?? null,
      details: { status: data.status },
    });
    await logActivity(context as Ctx, action, `Account set to ${data.status}`, null, data.userId);
    return { ok: true };
  });

/* ------------------------------ payments ------------------------------ */

export const listPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ status: z.string().max(40).optional(), search: z.string().max(120).optional() }).parse(i ?? {}),
  )
  .handler(async ({ context, data }) => {
    await requireRoles(context as Ctx, ADMIN_ROLES);
    let q = context.supabase
      .from("plan_payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;

    const ids = [...new Set((rows ?? []).map((r: any) => r.user_id))];
    const { data: profiles } = ids.length
      ? await context.supabase.from("profiles").select("user_id, email, full_name, display_id").in("user_id", ids)
      : { data: [] };
    const map = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    let out = (rows ?? []).map((r: any) => ({ ...r, profile: map.get(r.user_id) ?? null }));
    if (data.search) {
      const s = data.search.toLowerCase();
      out = out.filter(
        (r: any) =>
          r.reference?.toLowerCase().includes(s) ||
          r.tx_hash?.toLowerCase().includes(s) ||
          r.profile?.email?.toLowerCase().includes(s),
      );
    }
    return out;
  });

export const reviewPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        paymentId: z.string().uuid(),
        status: z.enum(["pending", "awaiting_confirmation", "approved", "declined", "expired", "cancelled"]),
        note: z.string().max(500).optional(),
        verified: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await requireRoles(context as Ctx, FINANCE_ROLES);
    if (data.status === "declined" && !data.note?.trim()) throw new Error("A reason is required to decline");
    if (data.status === "approved" && !data.verified) {
      throw new Error("Confirm that you have verified this payment on-chain or in the bank statement first");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payment, error: readErr } = await supabaseAdmin
      .from("plan_payments")
      .select("*")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!payment) throw new Error("Payment not found");
    if (payment.status === "approved" && data.status === "approved") return { ok: true, alreadyApproved: true };

    const { error } = await supabaseAdmin
      .from("plan_payments")
      .update({
        status: data.status,
        admin_note: data.note ?? null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      })
      .eq("id", data.paymentId);
    if (error) throw error;

    if (data.status === "approved") {
      await supabaseAdmin.from("transactions").insert({
        user_id: payment.user_id,
        type: "plan_purchase",
        amount: Number(payment.amount_usd),
        status: "completed",
        description: `${payment.tier_name} plan activated (${payment.reference})`,
        reference_id: payment.id,
      });
      await supabaseAdmin
        .from("profiles")
        .update({ vip_level: payment.tier_number })
        .eq("user_id", payment.user_id);
    }

    await audit(context as Ctx, {
      action: data.status === "approved" ? "payment_approve" : `payment_${data.status}`,
      target_user_id: payment.user_id,
      target_table: "plan_payments",
      target_record_id: payment.id,
      reason: data.note ?? null,
      details: { reference: payment.reference, amount_usd: payment.amount_usd },
    });
    await logActivity(
      context as Ctx,
      data.status === "approved" ? "payment_approved" : `payment_${data.status}`,
      `${payment.tier_name} payment ${payment.reference} marked ${data.status}`,
      payment.id,
      payment.user_id,
    );
    return { ok: true };
  });

/* ------------------------------ withdrawals ------------------------------ */

export const listWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ status: z.string().max(40).optional() }).parse(i ?? {}))
  .handler(async ({ context, data }) => {
    await requireRoles(context as Ctx, ADMIN_ROLES);
    let q = context.supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(300);
    if (data.status && data.status !== "all") q = q.eq("review_status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    const ids = [...new Set((rows ?? []).map((r: any) => r.user_id))];
    const { data: profiles } = ids.length
      ? await context.supabase.from("profiles").select("user_id, email, full_name, display_id").in("user_id", ids)
      : { data: [] };
    const map = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    return (rows ?? []).map((r: any) => ({ ...r, profile: map.get(r.user_id) ?? null }));
  });

export const reviewWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        withdrawalId: z.string().uuid(),
        action: z.enum(["approve", "decline", "mark_paid"]),
        note: z.string().max(500).optional(),
        txHash: z.string().max(200).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await requireRoles(context as Ctx, FINANCE_ROLES);
    if (data.action === "decline" && !data.note?.trim()) throw new Error("A reason is required to decline");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: wd, error: readErr } = await supabaseAdmin
      .from("withdrawals")
      .select("*")
      .eq("id", data.withdrawalId)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!wd) throw new Error("Withdrawal not found");

    const patch: Record<string, unknown> = {
      admin_notes: data.note ?? wd.admin_notes,
      reviewed_by: context.userId,
    };

    if (data.action === "approve") {
      if (wd.review_status !== "pending") throw new Error("This withdrawal has already been reviewed");
      patch.review_status = "approved";
      patch.status = "pending";
      if (!wd.balance_deducted) {
        const { data: wallet } = await supabaseAdmin
          .from("wallets")
          .select("main_balance")
          .eq("user_id", wd.user_id)
          .maybeSingle();
        const total = Number(wd.amount) + Number(wd.fee ?? 0);
        const balance = Number(wallet?.main_balance ?? 0);
        if (balance < total) throw new Error("Member balance is not enough to cover this withdrawal");
        await supabaseAdmin
          .from("wallets")
          .update({ main_balance: balance - total })
          .eq("user_id", wd.user_id);
        patch.balance_deducted = true;
        await supabaseAdmin.from("transactions").insert({
          user_id: wd.user_id,
          type: "withdrawal",
          amount: -total,
          status: "pending",
          description: `Withdrawal approved (${wd.network})`,
          reference_id: wd.id,
        });
      }
    } else if (data.action === "decline") {
      if (wd.review_status === "paid") throw new Error("A paid withdrawal cannot be declined");
      patch.review_status = "declined";
      patch.status = "cancelled";
      patch.decline_reason = data.note;
      patch.processed_at = new Date().toISOString();
      if (wd.balance_deducted) {
        const { data: wallet } = await supabaseAdmin
          .from("wallets")
          .select("main_balance")
          .eq("user_id", wd.user_id)
          .maybeSingle();
        const total = Number(wd.amount) + Number(wd.fee ?? 0);
        await supabaseAdmin
          .from("wallets")
          .update({ main_balance: Number(wallet?.main_balance ?? 0) + total })
          .eq("user_id", wd.user_id);
        patch.balance_deducted = false;
      }
    } else {
      if (wd.review_status !== "approved") throw new Error("Approve the withdrawal before marking it paid");
      patch.review_status = "paid";
      patch.status = "completed";
      patch.paid_at = new Date().toISOString();
      patch.processed_at = new Date().toISOString();
      if (data.txHash) patch.tx_hash = data.txHash;
    }

    const { error } = await supabaseAdmin.from("withdrawals").update(patch).eq("id", data.withdrawalId);
    if (error) throw error;

    await audit(context as Ctx, {
      action: `withdrawal_${data.action}`,
      target_user_id: wd.user_id,
      target_table: "withdrawals",
      target_record_id: wd.id,
      reason: data.note ?? null,
      details: { amount: wd.amount, network: wd.network },
    });
    await logActivity(
      context as Ctx,
      `withdrawal_${data.action}`,
      `Withdrawal of ${wd.amount} (${wd.network}) ${data.action.replace("_", " ")}`,
      wd.id,
      wd.user_id,
    );
    return { ok: true };
  });

/* ------------------------------ payment settings ------------------------------ */

export const listPaymentMethods = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [banks, wallets] = await Promise.all([
      sb.from("bank_accounts").select("*").order("created_at", { ascending: true }),
      sb.from("usdt_wallets").select("*").order("created_at", { ascending: true }),
    ]);
    if (banks.error) throw banks.error;
    if (wallets.error) throw wallets.error;
    return { banks: banks.data ?? [], wallets: wallets.data ?? [] };
  });

export const saveBankAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        bank_name: z.string().min(2).max(80),
        account_name: z.string().min(2).max(80),
        account_number: z.string().min(5).max(30),
        currency: z.string().min(2).max(8).default("NGN"),
        is_active: z.boolean().default(true),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await requireRoles(context as Ctx, FINANCE_ROLES);
    const { id, ...values } = data;
    const res = id
      ? await context.supabase.from("bank_accounts").update(values).eq("id", id).select().single()
      : await context.supabase.from("bank_accounts").insert(values).select().single();
    if (res.error) throw res.error;
    await audit(context as Ctx, {
      action: id ? "bank_account_update" : "bank_account_create",
      target_table: "bank_accounts",
      target_record_id: res.data.id,
      details: { bank_name: values.bank_name, is_active: values.is_active },
    });
    await logActivity(context as Ctx, "admin_setting_change", `Bank account ${values.bank_name} saved`, res.data.id);
    return res.data;
  });

export const deleteBankAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await requireRoles(context as Ctx, FINANCE_ROLES);
    const { error } = await context.supabase.from("bank_accounts").delete().eq("id", data.id);
    if (error) throw error;
    await audit(context as Ctx, { action: "bank_account_delete", target_table: "bank_accounts", target_record_id: data.id });
    return { ok: true };
  });

export const saveUsdtWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        network: z.enum(["TRC20", "BEP20", "ERC20"]),
        address: z.string().min(10).max(200),
        label: z.string().max(60).optional(),
        is_active: z.boolean().default(true),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await requireRoles(context as Ctx, FINANCE_ROLES);
    const { id, ...values } = data;
    const res = id
      ? await context.supabase.from("usdt_wallets").update(values).eq("id", id).select().single()
      : await context.supabase.from("usdt_wallets").insert(values).select().single();
    if (res.error) throw res.error;
    await audit(context as Ctx, {
      action: id ? "usdt_wallet_update" : "usdt_wallet_create",
      target_table: "usdt_wallets",
      target_record_id: res.data.id,
      details: { network: values.network, is_active: values.is_active },
    });
    await logActivity(context as Ctx, "admin_setting_change", `USDT ${values.network} wallet saved`, res.data.id);
    return res.data;
  });

export const deleteUsdtWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await requireRoles(context as Ctx, FINANCE_ROLES);
    const { error } = await context.supabase.from("usdt_wallets").delete().eq("id", data.id);
    if (error) throw error;
    await audit(context as Ctx, { action: "usdt_wallet_delete", target_table: "usdt_wallets", target_record_id: data.id });
    return { ok: true };
  });

/* ------------------------------ plans ------------------------------ */

export const listAllPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRoles(context as Ctx, ADMIN_ROLES);
    const { data, error } = await context.supabase.from("plans").select("*").order("sort_order");
    if (error) throw error;
    return data ?? [];
  });

export const savePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        price: z.number().nonnegative(),
        daily_earnings: z.number().nonnegative(),
        hash_rate_ghs: z.number().nonnegative(),
        duration_days: z.number().int().positive(),
        is_active: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await requireRoles(context as Ctx, SUPER_ROLES);
    const { id, ...values } = data;
    const { error } = await context.supabase.from("plans").update(values).eq("id", id);
    if (error) throw error;
    await audit(context as Ctx, { action: "plan_update", target_table: "plans", target_record_id: id, details: values });
    await logActivity(context as Ctx, "admin_setting_change", "Mining plan updated", id);
    return { ok: true };
  });

/* ------------------------------ support ------------------------------ */

export const listTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ status: z.string().max(30).optional(), search: z.string().max(120).optional() }).parse(i ?? {}),
  )
  .handler(async ({ context, data }) => {
    await requireRoles(context as Ctx, SUPPORT_ROLES);
    let q = context.supabase.from("support_tickets").select("*").order("created_at", { ascending: false }).limit(200);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    const ids = [...new Set((rows ?? []).map((r: any) => r.user_id))];
    const { data: profiles } = ids.length
      ? await context.supabase.from("profiles").select("user_id, email, full_name, display_id").in("user_id", ids)
      : { data: [] };
    const map = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    let out = (rows ?? []).map((r: any) => ({ ...r, profile: map.get(r.user_id) ?? null }));
    if (data.search) {
      const s = data.search.toLowerCase();
      out = out.filter(
        (r: any) => r.subject.toLowerCase().includes(s) || r.profile?.email?.toLowerCase().includes(s),
      );
    }
    return out;
  });

export const getTicketThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ ticketId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("support_messages")
      .select("*")
      .eq("ticket_id", data.ticketId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return rows ?? [];
  });

export const replyToTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ ticketId: z.string().uuid(), body: z.string().min(1).max(4000) }).parse(i),
  )
  .handler(async ({ context, data }) => {
    await requireRoles(context as Ctx, SUPPORT_ROLES);
    const { error } = await context.supabase.from("support_messages").insert({
      ticket_id: data.ticketId,
      sender_id: context.userId,
      is_admin: true,
      body: data.body,
    });
    if (error) throw error;
    await context.supabase
      .from("support_tickets")
      .update({ last_reply_at: new Date().toISOString(), status: "answered" })
      .eq("id", data.ticketId);
    await audit(context as Ctx, {
      action: "support_reply",
      target_table: "support_tickets",
      target_record_id: data.ticketId,
    });
    await logActivity(context as Ctx, "support_message", "Support replied to a ticket", data.ticketId);
    return { ok: true };
  });

export const updateTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        status: z.enum(["open", "answered", "pending", "resolved", "closed"]).optional(),
        assignToMe: z.boolean().optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await requireRoles(context as Ctx, SUPPORT_ROLES);
    const patch: Record<string, unknown> = {};
    if (data.status) patch.status = data.status;
    if (data.priority) patch.priority = data.priority;
    if (data.assignToMe) patch.assigned_to = context.userId;
    const { error } = await context.supabase.from("support_tickets").update(patch).eq("id", data.ticketId);
    if (error) throw error;
    await audit(context as Ctx, {
      action: "support_ticket_update",
      target_table: "support_tickets",
      target_record_id: data.ticketId,
      details: patch,
    });
    return { ok: true };
  });

/* ------------------------------ logs ------------------------------ */

export const listActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ eventType: z.string().max(60).optional() }).parse(i ?? {}))
  .handler(async ({ context, data }) => {
    await requireRoles(context as Ctx, ADMIN_ROLES);
    let q = context.supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(200);
    if (data.eventType && data.eventType !== "all") q = q.eq("event_type", data.eventType);
    const { data: rows, error } = await q;
    if (error) throw error;
    const ids = [...new Set((rows ?? []).map((r: any) => r.user_id).filter(Boolean))];
    const { data: profiles } = ids.length
      ? await context.supabase.from("profiles").select("user_id, email, display_id").in("user_id", ids)
      : { data: [] };
    const map = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    return (rows ?? []).map((r: any) => ({ ...r, profile: r.user_id ? (map.get(r.user_id) ?? null) : null }));
  });

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRoles(context as Ctx, ADMIN_ROLES);
    const { data: rows, error } = await context.supabase
      .from("admin_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    const ids = [
      ...new Set([
        ...(rows ?? []).map((r: any) => r.admin_id),
        ...(rows ?? []).map((r: any) => r.target_user_id).filter(Boolean),
      ]),
    ];
    const { data: profiles } = ids.length
      ? await context.supabase.from("profiles").select("user_id, email, display_id").in("user_id", ids)
      : { data: [] };
    const map = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    return (rows ?? []).map((r: any) => ({
      ...r,
      admin: map.get(r.admin_id) ?? null,
      target: r.target_user_id ? (map.get(r.target_user_id) ?? null) : null,
    }));
  });

/* ------------------------------ admin settings ------------------------------ */

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRoles(context as Ctx, SUPER_ROLES);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("*")
      .in("role", ["admin", "super_admin", "finance_admin", "support_admin", "user_admin"]);
    if (error) throw error;
    const ids = [...new Set((roles ?? []).map((r: any) => r.user_id))];
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("user_id, email, full_name, display_id").in("user_id", ids)
      : { data: [] };
    const map = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    return (roles ?? []).map((r: any) => ({ ...r, profile: map.get(r.user_id) ?? null }));
  });

export const setAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        email: z.string().email(),
        role: z.enum(["super_admin", "finance_admin", "support_admin", "user_admin"]),
        grant: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await requireRoles(context as Ctx, SUPER_ROLES);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .ilike("email", data.email)
      .maybeSingle();
    if (!profile) throw new Error("No member found with that email");

    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: profile.user_id, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw error;
    } else {
      if (profile.user_id === context.userId && data.role === "super_admin") {
        throw new Error("You cannot remove your own Super Admin role");
      }
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", profile.user_id)
        .eq("role", data.role);
      if (error) throw error;
    }

    await audit(context as Ctx, {
      action: data.grant ? "admin_role_grant" : "admin_role_revoke",
      target_user_id: profile.user_id,
      target_table: "user_roles",
      details: { role: data.role, email: data.email },
    });
    return { ok: true };
  });
