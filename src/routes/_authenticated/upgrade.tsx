import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Zap, Clock, TrendingUp, Crown, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/upgrade")({
  component: UpgradePage,
});

type Tier = {
  n: number;
  name: string;
  period: string;
  daily: string;
  price: string;
  ngn: string;
  highlight?: boolean;
};

const TIERS: Tier[] = [
  { n: 1, name: "Starter",  period: "100 days", daily: "1.00 USDC",   price: "$0.00",   ngn: "₦0" },
  { n: 2, name: "Bronze",   period: "15 days",  daily: "58.00 USDC",  price: "$24.00",  ngn: "₦36,678" },
  { n: 3, name: "Silver",   period: "20 days",  daily: "109.00 USDC", price: "$75.00",  ngn: "₦102,770" },
  { n: 4, name: "Gold",     period: "20 days",  daily: "165.00 USDC", price: "$115.00", ngn: "₦156,580", highlight: true },
  { n: 5, name: "Platinum", period: "25 days",  daily: "299.00 USDC", price: "$225.00", ngn: "₦306,352" },
  { n: 6, name: "Diamond",  period: "25 days",  daily: "899.00 USDC", price: "$675.00", ngn: "₦919,055" },
];

function UpgradePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-8">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Crown className="h-5 w-5 text-gold" />
          <h1 className="text-2xl font-bold">Upgrade Mining Tier</h1>
        </div>
        <p className="text-sm text-muted-foreground">Pick a tier that matches your goals. Higher tiers earn more per day.</p>
      </div>

      <div className="space-y-3">
        {TIERS.map((t) => (
          <Card
            key={t.n}
            className={`relative overflow-hidden p-5 border-border shadow-card ${
              t.highlight ? "bg-gradient-hero border-gold/40" : "bg-gradient-surface"
            }`}
          >
            {t.highlight && (
              <div className="absolute top-3 right-3">
                <Badge className="bg-gold/20 text-gold border border-gold/40 gap-1">
                  <Sparkles className="h-3 w-3" /> Popular
                </Badge>
              </div>
            )}

            <div className="flex items-center gap-3 mb-4">
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center font-bold font-mono-tabular ${
                t.highlight ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-primary/15 text-primary"
              }`}>
                T{t.n}
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Tier {t.n}</p>
                <p className="text-lg font-bold">{t.name}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <TierStat icon={Clock} label="Period" value={t.period} />
              <TierStat icon={TrendingUp} label="Per 24h" value={t.daily} accent />
              <TierStat icon={Zap} label="Price" value={t.price} />
            </div>

            <div className="flex items-center justify-between rounded-lg bg-card/60 border border-border/60 px-3 py-2 mb-4">
              <span className="text-xs text-muted-foreground">Naira equivalent</span>
              <span className="text-sm font-semibold font-mono-tabular text-gold">{t.ngn}</span>
            </div>

            <Link
              to="/checkout"
              search={{ tier: t.n }}
              className={`inline-flex w-full h-11 items-center justify-center rounded-md px-4 text-sm font-semibold transition-opacity hover:opacity-90 ${
                t.highlight
                  ? "bg-gradient-primary text-primary-foreground shadow-glow"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              Upgrade to Tier {t.n}
            </Link>
          </Card>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-6">
        Payments are confirmed manually after your deposit is verified.
      </p>
    </div>
  );
}

function TierStat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg bg-card/60 border border-border/60 px-2 py-2 text-center">
      <Icon className={`h-4 w-4 mx-auto mb-1 ${accent ? "text-gold" : "text-primary"}`} />
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-xs font-semibold font-mono-tabular mt-0.5 ${accent ? "text-gold" : ""}`}>{value}</p>
    </div>
  );
}