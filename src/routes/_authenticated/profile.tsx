import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { getDashboard } from "@/lib/mining.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Shield, Lock, Bell, HelpCircle, MessageCircle, Mail, Send } from "lucide-react";
import { toast } from "sonner";

const q = queryOptions({ queryKey: ["dashboard"], queryFn: () => getDashboard() });

export const Route = createFileRoute("/_authenticated/profile")({
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: ProfilePage,
});

function ProfilePage() {
  const { data } = useSuspenseQuery(q);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const p = data.profile;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6">
      <Card className="p-6 bg-gradient-hero border-border mb-4 shadow-card text-center">
        <div className="h-20 w-20 rounded-full bg-gradient-primary shadow-glow mx-auto flex items-center justify-center text-2xl font-bold text-primary-foreground">
          {(p?.full_name ?? "T")[0].toUpperCase()}
        </div>
        <p className="mt-3 text-lg font-bold">{p?.full_name}</p>
        <p className="text-xs text-muted-foreground font-mono-tabular">{p?.email}</p>
        <p className="text-xs text-muted-foreground font-mono-tabular mt-1">ID: {p?.display_id}</p>
        <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
          <Badge className="bg-primary/15 text-primary border border-primary/30">Active</Badge>
          <Badge className="bg-gold/15 text-gold border border-gold/30">VIP {p?.vip_level ?? 0}</Badge>
          <Badge variant="outline">KYC: {p?.kyc_status}</Badge>
        </div>
      </Card>

      <Section title="Security">
        <Row icon={Shield} label="Two-factor authentication" hint={p?.two_factor_enabled ? "Enabled" : "Not enabled"} />
        <Row icon={Lock} label="Change password" hint="Update your password" />
        <Row icon={Bell} label="Login alerts" hint={p?.login_alerts_enabled ? "On" : "Off"} />
      </Section>

      <Section title="Support">
        <Row icon={MessageCircle} label="Live chat" hint="Available 24/7" />
        <Row icon={Send} label="Telegram support" hint="@tradenova" />
        <Row icon={MessageCircle} label="WhatsApp" hint="Chat with us" />
        <Row icon={Mail} label="Email support" hint="support@tradenova.io" />
        <Row icon={HelpCircle} label="FAQ" hint="Get quick answers" />
      </Section>

      <Button variant="destructive" className="w-full h-11 mt-4 font-semibold" onClick={signOut}>
        <LogOut className="h-4 w-4 mr-2" /> Sign out
      </Button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground px-1 mb-2">{title}</p>
      <Card className="bg-gradient-surface border-border divide-y divide-border p-0 overflow-hidden">{children}</Card>
    </div>
  );
}

function Row({ icon: Icon, label, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; hint: string }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}