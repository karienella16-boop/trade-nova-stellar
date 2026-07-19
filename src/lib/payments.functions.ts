import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getPaymentConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("payment_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return data;
  });

export const listMyPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("plan_payments")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

const submitSchema = z.object({
  tier_number: z.number().int().min(1).max(6),
  tier_name: z.string().min(1).max(40),
  duration_days: z.number().int().min(1).max(365),
  amount_usd: z.number().positive(),
  amount_ngn: z.number().nonnegative().optional(),
  method: z.enum(["usdt", "bank"]),
  network: z.enum(["TRC20", "BEP20", "ERC20"]).optional(),
  tx_hash: z.string().max(200).optional(),
  receipt_url: z.string().max(500).optional(),
});

export const submitPlanPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => submitSchema.parse(input))
  .handler(async ({ data, context }) => {
    const reference =
      "TN-" +
      Date.now().toString(36).toUpperCase() +
      "-" +
      Math.random().toString(36).slice(2, 6).toUpperCase();

    const { data: row, error } = await context.supabase
      .from("plan_payments")
      .insert({
        user_id: context.userId,
        tier_number: data.tier_number,
        tier_name: data.tier_name,
        duration_days: data.duration_days,
        amount_usd: data.amount_usd,
        amount_ngn: data.amount_ngn ?? null,
        method: data.method,
        network: data.network ?? null,
        tx_hash: data.tx_hash ?? null,
        receipt_url: data.receipt_url ?? null,
        reference,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });