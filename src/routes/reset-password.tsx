import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Pickaxe } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — TradeNova Mining" },
      { name: "description", content: "Set a new password for your TradeNova Mining account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    try {
      const stored = sessionStorage.getItem("reset_email");
      if (stored) setEmail(stored);
    } catch {
      /* ignore */
    }
    return () => sub.subscription.unsubscribe();
  }, []);

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
      if (error) throw error;
      toast.success("Code verified — set your new password");
      setReady(true);
    } catch (err) {
      setCode("");
      toast.error(err instanceof Error ? err.message : "Invalid or expired code");
    } finally {
      setVerifying(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    } finally {
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
          {!ready ? (
            <>
              <h1 className="text-xl font-bold mb-1">Enter your reset code</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Open the password reset email we sent you. Click the link in it, or type the 6-digit code below.
              </p>
              <form onSubmit={verifyCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reset code</Label>
                  <div className="flex justify-center">
                    <InputOTP maxLength={6} value={code} onChange={setCode} inputMode="numeric" disabled={verifying}>
                      <InputOTPGroup>
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                          <InputOTPSlot key={i} index={i} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 bg-gradient-primary shadow-glow font-semibold"
                  disabled={verifying || code.length !== 6 || !email}
                >
                  {verifying && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Verify code
                </Button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold mb-1">Set a new password</h1>
              <p className="text-sm text-muted-foreground mb-6">Enter your new password below.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
                </div>
                <Button type="submit" className="w-full h-11 bg-gradient-primary shadow-glow font-semibold" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Update password
                </Button>
              </form>
            </>
          )}

          <Link to="/auth" className="block text-center text-xs text-muted-foreground mt-4 hover:text-foreground">
            ← Back to sign in
          </Link>
        </Card>
      </div>
    </div>
  );
}
