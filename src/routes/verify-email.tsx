import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { MailCheck, Pickaxe, LogOut, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/verify-email")({
  head: () => ({
    meta: [
      { title: "Verify your email — TradeNova Mining" },
      { name: "description", content: "Confirm your email to access your TradeNova dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      if (user.email_confirmed_at || user.confirmed_at) {
        navigate({ to: "/dashboard", replace: true });
        return;
      }
      setEmail(user.email ?? "");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      if (u && (u.email_confirmed_at || u.confirmed_at)) {
        navigate({ to: "/dashboard", replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function refresh() {
    setChecking(true);
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      const u = data.user;
      if (u && (u.email_confirmed_at || u.confirmed_at)) {
        toast.success("Email verified");
        navigate({ to: "/dashboard", replace: true });
      } else {
        toast.info("Not verified yet. Please click the link in your email.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not check status");
    } finally {
      setChecking(false);
    }
  }

  async function resend() {
    if (!email) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
      toast.success("Verification email resent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend");
    } finally {
      setResending(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
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

        <Card className="p-6 bg-gradient-surface border-border shadow-card text-center space-y-5">
          <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <MailCheck className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold">Verify your email</h1>
            <p className="text-sm text-muted-foreground">
              We sent a verification link to{" "}
              <span className="text-foreground font-medium">{email || "your inbox"}</span>.
              Open it to activate your account and access your dashboard.
            </p>
          </div>

          <a
            href="https://mail.google.com/mail/u/0/#search/from%3Ano-reply+subject%3A(confirm+OR+verify)"
            target="_blank"
            rel="noreferrer"
            className="block"
          >
            <Button className="w-full h-11 bg-gradient-primary shadow-glow font-semibold">
              Open Gmail
            </Button>
          </a>

          <Button variant="outline" className="w-full" onClick={refresh} disabled={checking}>
            <RefreshCw className={`h-4 w-4 mr-2 ${checking ? "animate-spin" : ""}`} />
            I've verified — continue
          </Button>

          <Button variant="ghost" className="w-full" onClick={resend} disabled={resending || !email}>
            {resending ? "Sending..." : "Resend verification email"}
          </Button>

          <button
            type="button"
            onClick={signOut}
            className="w-full inline-flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3 w-3" /> Sign out
          </button>
        </Card>
      </div>
    </div>
  );
}