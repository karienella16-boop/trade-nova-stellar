import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboard, claimMining, startFreeTrial } from "@/lib/mining.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Cpu, Zap, Clock, TrendingUp, Calendar, Coins } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const q = queryOptions({
  queryKey: ["dashboard"],
  queryFn: () => getDashboard(),
  refetchInterval: 10000,
});

export const Route = createFileRoute("/_authenticated/mining")({
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: MiningPage,
});

function useCountdown(endIso: string | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!endIso) return { text: "—" };
  const end = new Date(endIso).getTime();
  const diff = Math.max(0, end - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff / 3600000) % 24);
  const m = Math.floor((diff / 60000) % 60);
  const s = Math.floor((diff / 1000) % 60);
  return { text: d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s` };
}

function MiningPage() {
  const { data } = useSuspenseQuery(q);
  const qc = useQueryClient();
  const claim = useServerFn(claimMining);
  const trial = useServerFn(startFreeTrial);

  const mining = data.mining;
  const active = !!mining?.is_active;

  const start = mining ? new Date(mining.started_at).getTime() : 0;
  const end = mining ? new Date(mining.expires_at).getTime() : 0;
  const totalMs = end - start || 1;
  const cd = useCountdown(mining?.expires_at);
  const elapsedPct = mining ? Math.min(100, Math.max(0, ((Date.now() - start) / totalMs) * 100)) : 0;

  const perSecond = mining ? Number(mining.daily_earnings) / 86400 : 0;
  const [live, setLive] = useState(Number(mining?.live_accrued ?? 0));
  useEffect(() => {
    const base = Number(mining?.live_accrued ?? 0);
    setLive(base);
    if (!active) return;
    const startTs = Date.now();
    const id = setInterval(() => {
      setLive(base + perSecond * ((Date.now() - startTs) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [mining?.live_accrued, perSecond, active]);

  const claimMut = useMutation({
    mutationFn: () => claim(),
    onSuccess: (r) => {
      toast.success(`Claimed $${r.earned.toFixed(4)} to Mining balance`);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Claim failed"),
  });
  const trialMut = useMutation({
    mutationFn: () => trial(),
    onSuccess: () => {
      toast.success("Free trial started");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Mining Center</h1>
        <p className="text-sm text-muted-foreground">Real-time earnings from your active plan</p>
      </div>

      <Card className="relative overflow-hidden bg-gradient-hero border-border p-6 mb-4 shadow-card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`h-14 w-14 rounded-2xl bg-gradient-primary flex items-center justify-center ${active ? "animate-pulse-glow" : "opacity-40"}`}>
              <Cpu className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Status</p>
              <p className="text-lg font-bold">{active ? "Mining Active" : "Inactive"}</p>
            </div>
          </div>
          <div className={`h-3 w-3 rounded-full ${active ? "bg-primary animate-pulse" : "bg-muted"}`} />
        </div>

        <p className="text-xs uppercase tracking-widest text-muted-foreground">Unclaimed rewards</p>
        <p className="text-4xl font-bold font-mono-tabular text-primary mt-1">${live.toFixed(6)}</p>

        {mining && (
          <>
            <div className="mt-6">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-mono-tabular">{elapsedPct.toFixed(1)}%</span>
              </div>
              <Progress value={elapsedPct} className="h-2" />
              <div className="flex justify-between text-xs mt-2">
                <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Remaining</span>
                <span className="font-mono-tabular">{cd.text}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-6">
              <Stat icon={Zap} label="Power" value={`${Number(mining.hash_rate_ghs).toLocaleString()} GH/s`} />
              <Stat icon={TrendingUp} label="Daily" value={`$${Number(mining.daily_earnings).toFixed(2)}`} />
              <Stat icon={Calendar} label="Monthly" value={`$${(Number(mining.daily_earnings) * 30).toFixed(0)}`} />
            </div>

            <Button
              className="w-full mt-6 h-12 bg-gradient-primary shadow-glow font-semibold"
              onClick={() => claimMut.mutate()}
              disabled={!active || claimMut.isPending || live <= 0}
            >
              <Coins className="h-4 w-4 mr-2" />
              Claim ${live.toFixed(4)}
            </Button>
          </>
        )}

        {!mining && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">You don't have an active mining plan yet.</p>
            <Button className="w-full h-11 bg-gradient-primary shadow-glow" onClick={() => trialMut.mutate()} disabled={trialMut.isPending}>
              Start Free 24h Trial
            </Button>
            <Link to="/dashboard" className="block text-center text-sm text-gold underline underline-offset-4">
              Back to dashboard
            </Link>
          </div>
        )}
      </Card>

      {mining && (
        <Card className="p-4 bg-gradient-surface border-border">
          <p className="text-sm font-semibold mb-2">Estimated earnings</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><p className="text-xs text-muted-foreground">Daily</p><p className="font-mono-tabular font-bold text-primary">${Number(mining.daily_earnings).toFixed(2)}</p></div>
            <div><p className="text-xs text-muted-foreground">Weekly</p><p className="font-mono-tabular font-bold text-primary">${(Number(mining.daily_earnings) * 7).toFixed(2)}</p></div>
            <div><p className="text-xs text-muted-foreground">Monthly</p><p className="font-mono-tabular font-bold text-primary">${(Number(mining.daily_earnings) * 30).toFixed(2)}</p></div>
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-card/60 border border-border/60 px-2 py-3 text-center">
      <Icon className="h-4 w-4 text-primary mx-auto mb-1" />
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xs font-mono-tabular font-semibold mt-0.5">{value}</p>
    </div>
  );
}