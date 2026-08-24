import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { requestEmailOtp, completeLogin } from "@/lib/auth.functions";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { Loader2, Pickaxe, MailCheck } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — TradeNova Mining" },
      { name: "description", content: "Sign in or create your TradeNova Mining account with a secure email code." },
      { property: "og:title", content: "Sign in — TradeNova Mining" },
      { property: "og:description", content: "Passwordless access to your TradeNova Mining dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const RESEND_SECONDS = 30;
const MAX_ATTEMPTS = 5;

function errorMessage(code: string) {
  switch (code) {
    case "email_exists":
      return "An account with this email already exists. Please sign in instead.";
    case "no_account":
      return "No account found for this email. Please create an account first.";
    case "blocked":
      return "This account has been blocked. Please contact support.";
    case "suspended":
      return "This account is suspended. Please contact support.";
    case "rate_limited":
      return "Too many code requests. Please wait a few minutes and try again.";
    case "email_failed":
      return "We couldn't send the email right now. Please try again shortly.";
    default:
      return "Something went wrong. Please try again.";
  }
}

function AuthPage() {
  const navigate = useNavigate();
  const sendOtp = useServerFn(requestEmailOtp);
  const finishLogin = useServerFn(completeLogin);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [refCode, setRefCode] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const submittedRef = useRef(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const r = url.searchParams.get("ref");
    if (r) setRefCode(r.toUpperCase());

    // Fallback: if the email client opened a verification link instead of the
    // user typing the code, complete the session from the URL token.
    const tokenHash = url.searchParams.get("token_hash") ?? url.searchParams.get("token");
    if (tokenHash) {
      setVerifying(true);
      supabase.auth
        .verifyOtp({ token_hash: tokenHash, type: "email" })
        .then(async ({ data, error }) => {
          if (error || !data.session) {
            toast.error("That verification link is invalid or has expired. Please request a new code.");
            return;
          }
          await finishLogin({});
          navigate({ to: "/dashboard", replace: true });
        })
        .finally(() => setVerifying(false));
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);


  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function requestCode(isResend = false) {
    setLoading(true);
    try {
      const result = await sendOtp({
        data: { email, mode: mode === "signup" ? "signup" : "login", fullName, referralCode: refCode },
      });
      if (!result.ok) {
        toast.error(errorMessage(result.code));
        if (result.code === "email_exists") setMode("signin");
        if (result.code === "no_account") setMode("signup");
        return;
      }
      setStep("otp");
      setCode("");
      setAttempts(0);
      setCooldown(RESEND_SECONDS);
      toast.success(isResend ? "A new code has been sent" : "We sent a 6-digit code to your email");
    } catch {
      toast.error("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verify(value: string) {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setVerifying(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email, token: value, type: "email" });
      if (error || !data.session) {
        const next = attempts + 1;
        setAttempts(next);
        setCode("");
        if (next >= MAX_ATTEMPTS) {
          toast.error("Too many incorrect attempts. Please request a new code.");
          setStep("email");
        } else {
          const expired = /expired/i.test(error?.message ?? "");
          toast.error(
            expired
              ? "That code has expired. Please request a new one."
              : `Incorrect code. ${MAX_ATTEMPTS - next} attempt(s) left.`,
          );
        }
        return;
      }
      const status = await finishLogin({});
      if (!status.ok) {
        await supabase.auth.signOut();
        toast.error(errorMessage(status.code));
        setStep("email");
        return;
      }
      toast.success("Verified. Welcome back!");
      navigate({ to: "/dashboard", replace: true });
    } catch {
      toast.error("Verification failed. Please try again.");
    } finally {
      setVerifying(false);
      submittedRef.current = false;
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="h-11 w-11 rounded-xl bg-gradient-primary shadow-glow flex items-center justify-center">
            <Pickaxe className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold tracking-tight">TradeNova</span>
        </Link>

        <Card className="p-6 bg-gradient-surface border-border shadow-card">
          {step === "otp" ? (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <MailCheck className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-xl font-bold">Check your email</h2>
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code we sent to{" "}
                  <span className="text-foreground font-medium">{email}</span>. It expires in 10 minutes.
                </p>
              </div>

              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={setCode}
                  autoFocus
                  disabled={verifying}
                  onComplete={(v) => verify(v)}
                  inputMode="numeric"
                >
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                className="w-full h-11 bg-gradient-primary shadow-glow font-semibold"
                disabled={verifying || code.length !== 6}
                onClick={() => verify(code)}
              >
                {verifying && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Verify code
              </Button>

              <Button
                variant="outline"
                className="w-full"
                disabled={loading || cooldown > 0}
                onClick={() => requestCode(true)}
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                }}
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                ← Use a different email
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6 flex gap-2 rounded-lg bg-muted p-1">
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${mode === "signin" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${mode === "signup" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  Sign up
                </button>
              </div>

              <Button type="button" variant="outline" className="w-full mb-4 h-11" onClick={handleGoogle} disabled={loading}>
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  requestCode();
                }}
                className="space-y-4"
              >
                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={80} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="ref">
                      Referral code <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="ref"
                      value={refCode}
                      onChange={(e) => setRefCode(e.target.value.toUpperCase())}
                      maxLength={16}
                      placeholder="ABCDEF12"
                    />
                  </div>
                )}
                <Button type="submit" className="w-full h-11 bg-gradient-primary shadow-glow font-semibold" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Continue
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  No password needed — we email you a 6-digit code.
                </p>
              </form>
            </>
          )}
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to TradeNova's Terms & Privacy Policy.
        </p>
      </div>
    </div>
  );
}
