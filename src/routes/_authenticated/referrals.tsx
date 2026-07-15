import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getDashboard } from "@/lib/mining.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Share2, Users, Gift } from "lucide-react";
import { toast } from "sonner";

const q = queryOptions({ queryKey: ["dashboard"], queryFn: () => getDashboard() });

export const Route = createFileRoute("/_authenticated/referrals")({
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: Refs,
});

function Refs() {
  const { data } = useSuspenseQuery(q);
  const code = data.profile?.referral_code ?? "";
  const link = typeof window !== "undefined" ? `${window.location.origin}/auth?ref=${code}` : "";

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6">
      <h1 className="text-2xl font-bold mb-1">Referral Program</h1>
      <p className="text-sm text-muted-foreground mb-5">Earn commission on every friend you invite</p>

      <Card className="p-6 bg-gradient-hero border-border mb-4 shadow-card">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Referrals</p>
            <p className="text-3xl font-bold font-mono-tabular mt-1">{data.referralCount}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Earnings</p>
            <p className="text-3xl font-bold font-mono-tabular text-gold mt-1">${data.referralEarnings.toFixed(2)}</p>
          </div>
        </div>

        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-1">Your referral code</p>
          <div className="flex gap-2">
            <div className="flex-1 rounded-lg bg-card/60 border border-border px-4 py-3 font-mono-tabular font-bold text-lg tracking-wider">
              {code}
            </div>
            <Button size="icon" variant="outline" onClick={() => copy(code, "Code")}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-1">Referral link</p>
          <div className="flex gap-2">
            <div className="flex-1 rounded-lg bg-card/60 border border-border px-3 py-3 text-xs truncate font-mono">
              {link}
            </div>
            <Button size="icon" variant="outline" onClick={() => copy(link, "Link")}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              className="bg-gradient-primary shadow-glow"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: "Join TradeNova Mining", url: link }).catch(() => {});
                } else {
                  copy(link, "Link");
                }
              }}
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-5 bg-gradient-surface border-border">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-gold/15 flex items-center justify-center">
            <Gift className="h-5 w-5 text-gold" />
          </div>
          <div>
            <p className="font-semibold mb-1">How it works</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Share your code with friends</li>
              <li>• They sign up and buy a plan</li>
              <li>• You earn up to 12% commission automatically</li>
            </ul>
          </div>
        </div>
      </Card>

      <Card className="p-5 bg-gradient-surface border-border mt-3">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-primary" />
          <p className="font-semibold">Leaderboard</p>
        </div>
        <p className="text-sm text-muted-foreground">Top referrers this month — coming soon</p>
      </Card>
    </div>
  );
}