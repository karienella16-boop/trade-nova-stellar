import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getDashboard } from "@/lib/mining.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Wallet as WalletIcon } from "lucide-react";

const q = queryOptions({ queryKey: ["dashboard"], queryFn: () => getDashboard() });

export const Route = createFileRoute("/_authenticated/wallet")({
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: WalletPage,
});

function WalletPage() {
  const { data } = useSuspenseQuery(q);
  const w = data.wallet;
  const total =
    Number(w?.main_balance ?? 0) + Number(w?.mining_balance ?? 0) + Number(w?.bonus_balance ?? 0) + Number(w?.referral_balance ?? 0);

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6">
      <h1 className="text-2xl font-bold mb-1">Wallet</h1>
      <p className="text-sm text-muted-foreground mb-5">Manage your balances and transfers</p>

      <Card className="p-6 bg-gradient-hero border-border mb-4 shadow-card">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Total balance</p>
        <p className="text-4xl font-bold font-mono-tabular mt-1">${total.toFixed(2)}</p>
        <div className="grid grid-cols-3 gap-2 mt-6">
          <Button className="bg-gradient-primary shadow-glow h-11 font-semibold" disabled>
            <ArrowDownToLine className="h-4 w-4 mr-1" /> Deposit
          </Button>
          <Button variant="secondary" className="h-11 font-semibold" disabled>
            <ArrowUpFromLine className="h-4 w-4 mr-1" /> Withdraw
          </Button>
          <Button variant="outline" className="h-11 font-semibold" disabled>
            <ArrowLeftRight className="h-4 w-4 mr-1" /> Transfer
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">Deposit / withdraw coming in Phase 2</p>
      </Card>

      <div className="space-y-3">
        <BalanceRow label="Main balance" desc="Available for withdrawal & purchases" amount={Number(w?.main_balance ?? 0)} accent="primary" />
        <BalanceRow label="Mining balance" desc="Earnings from active mining" amount={Number(w?.mining_balance ?? 0)} accent="gold" />
        <BalanceRow label="Bonus balance" desc="Promos and check-in rewards" amount={Number(w?.bonus_balance ?? 0)} />
        <BalanceRow label="Referral balance" desc="Commission from your referrals" amount={Number(w?.referral_balance ?? 0)} />
      </div>

      <Link to="/dashboard" className="block mt-6 text-center text-sm text-muted-foreground">Back to dashboard</Link>
    </div>
  );
}

function BalanceRow({ label, desc, amount, accent }: { label: string; desc: string; amount: number; accent?: "primary" | "gold" }) {
  const accentClass = accent === "primary" ? "text-primary" : accent === "gold" ? "text-gold" : "text-foreground";
  return (
    <Card className="p-4 bg-gradient-surface border-border flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <WalletIcon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <p className={`text-lg font-mono-tabular font-bold ${accentClass}`}>${amount.toFixed(2)}</p>
    </Card>
  );
}