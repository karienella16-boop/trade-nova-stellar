import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type OtpMode = "signup" | "login";

type RequestInput = {
  email: string;
  mode: OtpMode;
  fullName?: string;
  referralCode?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const MAX_REQUESTS = 5;
const WINDOW_MINUTES = 15;

/**
 * Server-side gate for sending a 6-digit email verification code.
 * The code itself is generated, hashed and stored by the auth service —
 * it is never generated, returned, or logged here.
 */
export const requestEmailOtp = createServerFn({ method: "POST" })
  .inputValidator((input: RequestInput) => {
    const email = String(input?.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new Error("Please enter a valid email address.");
    const mode: OtpMode = input?.mode === "signup" ? "signup" : "login";
    return {
      email,
      mode,
      fullName: String(input?.fullName ?? "").trim().slice(0, 80),
      referralCode: String(input?.referralCode ?? "").trim().toUpperCase().slice(0, 16),
    };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const admin = supabaseAdmin as any;

    const { data: profile } = await admin
      .from("profiles")
      .select("user_id, account_status")
      .eq("email", data.email)
      .maybeSingle();

    if (data.mode === "signup" && profile) {
      return { ok: false as const, code: "email_exists" as const };
    }
    if (data.mode === "login" && !profile) {
      return { ok: false as const, code: "no_account" as const };
    }
    if (profile?.account_status === "blocked" || profile?.account_status === "suspended") {
      return { ok: false as const, code: profile.account_status as "blocked" | "suspended" };
    }

    // Server-side rate limiting on code requests.
    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
    const { count } = await admin
      .from("otp_request_log")
      .select("id", { count: "exact", head: true })
      .eq("email", data.email)
      .gte("created_at", since);

    if ((count ?? 0) >= MAX_REQUESTS) {
      return { ok: false as const, code: "rate_limited" as const };
    }

    const { error } = await admin.auth.signInWithOtp({
      email: data.email,
      options: {
        shouldCreateUser: data.mode === "signup",
        data:
          data.mode === "signup"
            ? {
                full_name: data.fullName || undefined,
                referral_code: data.referralCode || undefined,
              }
            : undefined,
      },
    });

    if (error) {
      console.error("[auth] otp send failed", error.message);
      const message = String(error.message ?? "");
      if (/rate limit/i.test(message)) return { ok: false as const, code: "rate_limited" as const };
      return { ok: false as const, code: "email_failed" as const };
    }

    await admin
      .from("otp_request_log")
      .insert({ email: data.email, purpose: data.mode === "signup" ? "SIGNUP_VERIFICATION" : "LOGIN_VERIFICATION" });

    return { ok: true as const };
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });

/** Called after a successful code verification to activate the account and record the login. */
export const completeLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const admin = supabaseAdmin as any;

    const { data: profile } = await admin
      .from("profiles")
      .select("account_status")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (profile?.account_status === "blocked" || profile?.account_status === "suspended") {
      return { ok: false as const, code: profile.account_status as "blocked" | "suspended" };
    }

    await admin
      .from("profiles")
      .update({
        account_status: "active",
        email_verified: true,
        last_login_at: new Date().toISOString(),
      })
      .eq("user_id", context.userId);

    return { ok: true as const };
  });
