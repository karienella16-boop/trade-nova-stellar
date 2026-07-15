import { createFileRoute, Link } from "@tanstack/react-router";
import { Pickaxe, Zap, Shield, TrendingUp, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-hero text-foreground">
      <header className="mx-auto max-w-6xl px-4 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary shadow-glow flex items-center justify-center">
            <Pickaxe className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">TradeNova</span>
        </div>
        <Link to="/auth" className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-12 pb-24">
        <section className="text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-medium text-gold mb-6">
            <Zap className="h-3 w-3" /> Premium Cloud Mining
          </span>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
            Mine crypto in the cloud.{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">Earn every second.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
            TradeNova gives you industrial-grade mining power with zero hardware. Real-time earnings, secure wallets, and fast withdrawals.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/auth" className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90 transition-opacity">
              Start mining free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="mt-20 grid gap-4 md:grid-cols-3">
          {[
            { icon: TrendingUp, title: "Live earnings", desc: "Watch your balance grow every second. Claim any time." },
            { icon: Shield, title: "Bank-grade security", desc: "2FA, withdrawal confirmations, and anti-fraud protection." },
            { icon: Zap, title: "Fast withdrawals", desc: "USDT on TRC20 / BEP20 / ERC20. Bitcoin and Ethereum supported." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl bg-gradient-surface border border-border p-6 shadow-card">
              <div className="h-11 w-11 rounded-lg bg-primary/15 flex items-center justify-center mb-4">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </section>

        <section className="mt-20 rounded-3xl bg-gradient-surface border border-border p-8 md:p-12 text-center shadow-card">
          <h2 className="text-3xl font-bold">Four plans. All profitable.</h2>
          <p className="mt-3 text-muted-foreground">From Starter at $50 to Platinum at $5,000 — pick your power tier.</p>
          <div className="mt-8 grid gap-3 md:grid-cols-4 text-left">
            {[
              { name: "Starter", price: "$50", rate: "100 GH/s", daily: "$1.50" },
              { name: "Silver", price: "$250", rate: "600 GH/s", daily: "$9" },
              { name: "Gold", price: "$1,000", rate: "2.8 TH/s", daily: "$42" },
              { name: "Platinum", price: "$5,000", rate: "16 TH/s", daily: "$240" },
            ].map((p) => (
              <div key={p.name} className="rounded-xl border border-border bg-card/60 p-4">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{p.name}</p>
                <p className="text-2xl font-bold font-mono-tabular mt-1">{p.price}</p>
                <p className="text-xs mt-2 text-muted-foreground">{p.rate}</p>
                <p className="text-sm mt-1 text-primary font-mono-tabular">{p.daily}/day</p>
              </div>
            ))}
          </div>
          <Link to="/auth" className="inline-flex items-center gap-2 mt-8 rounded-xl bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow">
            Create account <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <footer className="mt-16 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} TradeNova Mining · Premium cloud mining platform
        </footer>
      </main>
    </div>
  );
}
