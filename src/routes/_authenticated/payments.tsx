import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listMyPayments } from "@/lib/payments.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Receipt, Clock, CheckCircle2, XCircle } from "lucide-react";

const q = queryOptions({
  queryKey: ["my-payments"],
  queryFn: () => listMyPayments(),
  refetchInterval: 30000,
});

export const Route = createFileRoute("/_authenticated/payments")({
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: PaymentsPage,
});

function StatusBadge({ s }: { s: string }) {
  if (s === "approved")
    return <Badge className="bg-green-500/15 text-green-500 border border-green-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
  if (s === "rejected")
    return <Badge className="bg-red-500/15 text-red-500 border border-red-500/30"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
  return <Badge className="bg-amber-500/15 text-amber-500 border border-amber-500/30"><Clock className="h-3 w-3 mr-1" />Pending review</Badge>;
}

function PaymentsPage() {
  const { data } = useSuspenseQuery(q);
  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-8">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="text-2xl font-bold mb-1">Payment History</h1>
      <p className="text-sm text-muted-foreground mb-5">Track the status of your plan upgrades</p>

      {data.length === 0 ? (
        <Card className="p-10 text-center bg-gradient-surface border-border">
          <Receipt className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No payments yet.</p>
          <Link to="/upgrade" className="inline-block mt-4 text-sm text-primary hover:underline">
            Choose a plan →
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map((p) => (
            <Card key={p.id} className="p-4 bg-gradient-surface border-border shadow-card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold">Tier {p.tier_number} — {p.tier_name}</p>
                  <p className="text-xs text-muted-foreground font-mono-tabular mt-0.5">
                    {new Date(p.created_at).toLocaleString()}
                  </p>
                </div>
                <StatusBadge s={p.status} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Info k="Method" v={p.method === "usdt" ? `USDT (${p.network ?? "—"})` : "Bank transfer"} />
                <Info k="Amount" v={p.method === "usdt" ? `${Number(p.amount_usd).toFixed(2)} USDT` : `₦${Number(p.amount_ngn ?? 0).toLocaleString()}`} />
                <Info k="Reference" v={p.reference} mono />
                <Info k="Duration" v={`${p.duration_days} days`} />
                {p.tx_hash && <div className="col-span-2"><Info k="TxID" v={p.tx_hash} mono /></div>}
                {p.admin_note && <div className="col-span-2"><Info k="Note" v={p.admin_note} /></div>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Info({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
      <p className={`font-medium truncate ${mono ? "font-mono-tabular text-[11px]" : ""}`}>{v}</p>
    </div>
  );
}