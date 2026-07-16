import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboard, startFreeTrial } from "@/lib/mining.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Cpu, TrendingUp, Wallet as WalletIcon, Users, Gift, Zap, Sparkles, Crown } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const dashboardQuery = queryOptions({
  queryKey: ["dashboard"],
  queryFn: () => getDashboard(),
  refetchInterval: 15000,
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  component: Dashboard,
});

function useLiveTicker(base: number, perSecond: number, active: boolean) {
  const [value, setValue] = useState(base);
  useEffect(() => {
    setValue(base);
    if (!active || perSecond <= 0) return;
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      setValue(base + perSecond * elapsed);
    }, 1000);
    return () => clearInterval(id);
  }, [base, perSecond, active]);
  return value;
}

function Dashboard() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const qc = useQueryClient();
  const trial = useServerFn(startFreeTrial);
  const startTrial = useMutation({
    mutationFn: () => trial(),
    onSuccess: () => {
      toast.success("Free 24-hour mining trial activated!");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to start trial"),
  });

  const wallet = data.wallet;
  const profile = data.profile;
  const mining = data.mining;

  const totalBalance =
    Number(wallet?.main_balance ?? 0) +
    Number(wallet?.mining_balance ?? 0) +
    Number(wallet?.bonus_balance ?? 0) +
    Number(wallet?.referral_balance ?? 0);

  const perSecond = mining ? Number(mining.daily_earnings) / 86400 : 0;
  const liveMining = useLiveTicker(
    Number(mining?.live_accrued ?? 0),
    perSecond,
    !!mining?.is_active,
  );

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-muted-foreground">Welcome back</p>
          <h1 className="text-xl font-bold">{profile?.full_name ?? "Miner"}</h1>
          <p className="text-xs text-muted-foreground font-mono-tabular mt-0.5">ID: {profile?.display_id}</p>
        </div>
        <Badge variant="secondary" className="bg-gold/10 text-gold border border-gold/30">
          <Sparkles className="h-3 w-3 mr-1" /> VIP {profile?.vip_level ?? 0}
        </Badge>
      </div>

      <Link
        to="/upgrade"
        className="mb-4 flex items-center justify-between rounded-2xl border border-gold/30 bg-gradient-to-r from-gold/15 via-primary/10 to-transparent px-4 py-3 shadow-card hover:opacity-90 transition-opacity"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gold/20 flex items-center justify-center">
            <Crown className="h-5 w-5 text-gold" />
          </div>
          <div>
            <p className="text-sm font-semibold">Upgrade your tier</p>
            <p className="text-xs text-muted-foreground">View Tier 1 – Tier 6 mining plans</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-gold">View →</span>
      </Link>

      <Card className="relative overflow-hidden bg-gradient-hero border-border p-6 mb-4 shadow-card">
        <div className="absolute inset-0 bg-gradient-primary opacity-10 pointer-events-none" />
        <div className="relative">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Total balance</p>
          <p className="mt-2 text-4xl font-bold font-mono-tabular">${totalBalance.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">USDT equivalent</p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <MiniStat label="Withdrawable" value={Number(wallet?.main_balance ?? 0)} accent="primary" />
            <MiniStat label="Mining" value={Number(wallet?.mining_balance ?? 0)} accent="gold" />
            <MiniStat label="Bonus" value={Number(wallet?.bonus_balance ?? 0)} />
            <MiniStat label="Referral" value={Number(wallet?.referral_balance ?? 0)} />
          </div>
        </div>
      </Card>

      <Card className="p-5 mb-4 bg-gradient-surface border-border shadow-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center ${mining?.is_active ? "animate-pulse-glow" : ""}`}>
              <Cpu className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Mining status</p>
              <p className="text-xs text-muted-foreground">
                {mining?.is_active ? "Active — earning now" : "Inactive"}
              </p>
            </div>
          </div>
          <Badge className={mining?.is_active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}>
            {mining?.is_active ? "LIVE" : "OFF"}
          </Badge>
        </div>

        {mining?.is_active ? (
          <>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-2xl font-bold font-mono-tabular text-primary">
                +${liveMining.toFixed(6)}
              </span>
              <span className="text-xs text-muted-foreground">unclaimed</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
              <div>
                <p className="text-muted-foreground">Hash rate</p>
                <p className="font-mono-tabular font-semibold">{Number(mining.hash_rate_ghs).toLocaleString()} GH/s</p>
              </div>
              <div>
                <p className="text-muted-foreground">Daily earnings</p>
                <p className="font-mono-tabular font-semibold">${Number(mining.daily_earnings).toFixed(2)}</p>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-muted-foreground mb-3">Start mining to earn daily rewards</p>
            <Button
              className="bg-gradient-primary shadow-glow font-semibold w-full"
              onClick={() => startTrial.mutate()}
              disabled={startTrial.isPending}
            >
              <Zap className="h-4 w-4 mr-2" />
              Start Free 24h Trial
            </Button>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard icon={TrendingUp} label="Daily earnings" value={`$${data.dailyEarnings.toFixed(2)}`} />
        <StatCard icon={WalletIcon} label="Total earned" value={`$${Number(wallet?.total_earned ?? 0).toFixed(2)}`} />
        <StatCard icon={Users} label="Referrals" value={data.referralCount.toString()} />
        <StatCard icon={Gift} label="Ref. earnings" value={`$${data.referralEarnings.toFixed(2)}`} />
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Account status: <span className="text-primary font-semibold">Active</span> · KYC: <span className="text-foreground">{profile?.kyc_status ?? "unverified"}</span>
      </p>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: number; accent?: "primary" | "gold" }) {
  const accentClass = accent === "primary" ? "text-primary" : accent === "gold" ? "text-gold" : "text-foreground";
  return (
    <div className="rounded-lg bg-card/60 border border-border/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold font-mono-tabular ${accentClass}`}>${value.toFixed(2)}</p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card className="p-4 bg-gradient-surface border-border">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-primary" />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="text-lg font-bold font-mono-tabular">{value}</p>
    </Card>
  );
}