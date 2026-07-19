import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { useState } from "react";
import { getPaymentConfig, submitPlanPayment } from "@/lib/payments.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, Copy, Wallet, Landmark, CheckCircle2, AlertTriangle,
  Loader2, Upload, QrCode,
} from "lucide-react";

const TIERS = [
  { n: 1, name: "Starter",  period: 100, daily: 1,   price: 0,    ngn: 0 },
  { n: 2, name: "Bronze",   period: 15,  daily: 58,  price: 24,   ngn: 36678 },
  { n: 3, name: "Silver",   period: 20,  daily: 109, price: 75,   ngn: 102770 },
  { n: 4, name: "Gold",     period: 20,  daily: 165, price: 115,  ngn: 156580 },
  { n: 5, name: "Platinum", period: 25,  daily: 299, price: 225,  ngn: 306352 },
  { n: 6, name: "Diamond",  period: 25,  daily: 899, price: 675,  ngn: 919055 },
];

const cfgQuery = queryOptions({ queryKey: ["payment-config"], queryFn: () => getPaymentConfig() });

export const Route = createFileRoute("/_authenticated/checkout")({
  validateSearch: (s) => z.object({ tier: z.coerce.number().int().min(1).max(6).default(2) }).parse(s),
  loaderDeps: ({ search }) => ({ tier: search.tier }),
  loader: ({ context }) => context.queryClient.ensureQueryData(cfgQuery),
  component: CheckoutPage,
});

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copied`),
    () => toast.error("Copy failed"),
  );
}

function CheckoutPage() {
  const { tier } = Route.useSearch();
  const navigate = useNavigate();
  const { data: cfg } = useSuspenseQuery(cfgQuery);
  const t = TIERS.find((x) => x.n === tier) ?? TIERS[1];

  const [step, setStep] = useState<"select" | "usdt" | "bank">("select");
  const [network, setNetwork] = useState<"TRC20" | "BEP20" | "ERC20">("TRC20");
  const [txHash, setTxHash] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const submit = useServerFn(submitPlanPayment);
  const mutation = useMutation({
    mutationFn: submit,
    onSuccess: () => {
      toast.success("Payment submitted. Awaiting review.");
      navigate({ to: "/payments" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const walletAddr =
    network === "TRC20" ? cfg?.usdt_trc20 :
    network === "BEP20" ? cfg?.usdt_bep20 : cfg?.usdt_erc20;
  const walletAddress = walletAddr ?? "";

  async function uploadReceipt(): Promise<string | undefined> {
    if (!receiptFile) return undefined;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Not signed in");
    const ext = receiptFile.name.split(".").pop() ?? "jpg";
    const path = `${u.user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("receipts").upload(path, receiptFile);
    if (error) throw error;
    return path;
  }

  async function handleUsdtSubmit() {
    if (!txHash.trim()) return toast.error("Enter your transaction hash (TxID)");
    try {
      setUploading(true);
      const receiptPath = await uploadReceipt();
      mutation.mutate({
        data: {
          tier_number: t.n, tier_name: t.name, duration_days: t.period,
          amount_usd: t.price, amount_ngn: t.ngn,
          method: "usdt", network, tx_hash: txHash.trim(),
          receipt_url: receiptPath,
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally { setUploading(false); }
  }

  async function handleBankSubmit() {
    if (!receiptFile) return toast.error("Please upload your payment receipt");
    try {
      setUploading(true);
      const receiptPath = await uploadReceipt();
      mutation.mutate({
        data: {
          tier_number: t.n, tier_name: t.name, duration_days: t.period,
          amount_usd: t.price, amount_ngn: t.ngn,
          method: "bank", receipt_url: receiptPath,
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally { setUploading(false); }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-8">
      <button
        onClick={() => (step === "select" ? navigate({ to: "/upgrade" }) : setStep("select"))}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="mb-5">
        <h1 className="text-2xl font-bold">Upgrade Plan</h1>
        <p className="text-sm text-muted-foreground">Confirm your plan upgrade</p>
      </div>

      <Card className="p-5 bg-gradient-surface border-border mb-4 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Plan Details</h2>
          <Badge className="bg-primary/15 text-primary border border-primary/30">Tier {t.n}</Badge>
        </div>
        <dl className="space-y-2 text-sm">
          <Row k="Plan name" v={t.name} />
          <Row k="Contract duration" v={`${t.period} Days`} />
          <Row k="Plan price" v={`$${t.price.toFixed(2)}`} />
          <Row k="Daily earnings" v={`${t.daily.toFixed(2)} USDC`} />
          <Row k="Payment status" v={<Badge variant="secondary" className="bg-amber-500/15 text-amber-500 border border-amber-500/30">Pending</Badge>} />
        </dl>
      </Card>

      {step === "select" && (
        <Card className="p-5 bg-gradient-surface border-border shadow-card">
          <h2 className="font-semibold mb-3">Select Payment Method</h2>

          <button
            onClick={() => setStep("usdt")}
            className="w-full text-left rounded-xl border border-border bg-card/60 p-4 mb-3 hover:border-primary/60 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">USDT</p>
                <p className="text-xs text-muted-foreground">TRC20 · BEP20 · ERC20</p>
              </div>
              <span className="text-xs text-primary font-medium">Continue →</span>
            </div>
          </button>

          <button
            onClick={() => setStep("bank")}
            className="w-full text-left rounded-xl border border-border bg-card/60 p-4 hover:border-gold/60 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gold/15 flex items-center justify-center">
                <Landmark className="h-5 w-5 text-gold" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Nigerian Bank Transfer</p>
                <p className="text-xs text-muted-foreground">Transfer NGN {t.ngn.toLocaleString()}</p>
              </div>
              <span className="text-xs text-gold font-medium">Continue →</span>
            </div>
          </button>
        </Card>
      )}

      {step === "usdt" && (
        <Card className="p-5 bg-gradient-surface border-border shadow-card space-y-4">
          <h2 className="font-semibold">USDT Payment</h2>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Select network</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {(["TRC20", "BEP20", "ERC20"] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNetwork(n)}
                  className={`h-10 rounded-lg text-xs font-semibold border transition-colors ${
                    network === n
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card/60 border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-card/60 border border-border p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Amount to pay</p>
            <p className="text-2xl font-bold font-mono-tabular text-primary">{t.price.toFixed(2)} USDT</p>
          </div>

          <div className="flex justify-center">
            <div className="rounded-xl bg-white p-2">
              <img
                alt="Wallet QR"
                className="h-40 w-40"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(walletAddress)}`}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Wallet address ({network})</Label>
            <div className="mt-1 flex items-center gap-2 rounded-lg bg-card/60 border border-border px-3 py-2">
              <QrCode className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-xs font-mono-tabular break-all flex-1">{walletAddress}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={() => copy(walletAddress, "Wallet address")}>
                <Copy className="h-3 w-3 mr-1" /> Copy address
              </Button>
              <Button variant="outline" size="sm" onClick={() => copy(t.price.toFixed(2), "Amount")}>
                <Copy className="h-3 w-3 mr-1" /> Copy amount
              </Button>
            </div>
          </div>

          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-500/90 flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>Send only USDT via the selected network.</p>
              <p>Double-check the wallet address before sending.</p>
              <p>Your plan is activated after payment is confirmed.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tx">Transaction hash (TxID)</Label>
            <Input id="tx" placeholder="0x..." value={txHash} onChange={(e) => setTxHash(e.target.value)} />
          </div>

          <FileUpload file={receiptFile} onChange={setReceiptFile} optional />

          <Button
            className="w-full h-11 bg-gradient-primary shadow-glow font-semibold"
            onClick={handleUsdtSubmit}
            disabled={mutation.isPending || uploading}
          >
            {(mutation.isPending || uploading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <CheckCircle2 className="h-4 w-4 mr-2" /> I have completed payment
          </Button>
        </Card>
      )}

      {step === "bank" && (
        <Card className="p-5 bg-gradient-surface border-border shadow-card space-y-4">
          <h2 className="font-semibold">Bank Transfer</h2>

          <dl className="space-y-2 text-sm rounded-lg bg-card/60 border border-border p-3">
            <Row k="Bank name" v={cfg?.bank_name || "—"} />
            <Row k="Account name" v={cfg?.bank_account_name || "—"} />
            <Row k="Account number" v={cfg?.bank_account_number || "—"} mono />
            <Row k="Amount" v={`NGN ${t.ngn.toLocaleString()}`} mono />
          </dl>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => copy(cfg?.bank_account_number ?? "", "Account number")}>
              <Copy className="h-3 w-3 mr-1" /> Copy account
            </Button>
            <Button variant="outline" size="sm" onClick={() => copy(String(t.ngn), "Amount")}>
              <Copy className="h-3 w-3 mr-1" /> Copy amount
            </Button>
          </div>

          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-500/90 flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>Transfer the exact amount.</p>
              <p>Include your reference on the transfer note when possible.</p>
              <p>Upload your receipt below — payment is reviewed before activation.</p>
            </div>
          </div>

          <FileUpload file={receiptFile} onChange={setReceiptFile} />

          <Button
            className="w-full h-11 bg-gradient-primary shadow-glow font-semibold"
            onClick={handleBankSubmit}
            disabled={mutation.isPending || uploading}
          >
            {(mutation.isPending || uploading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit payment
          </Button>
        </Card>
      )}

      <div className="text-center mt-4">
        <Link to="/payments" className="text-xs text-muted-foreground hover:text-foreground">
          View payment history →
        </Link>
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={`font-semibold ${mono ? "font-mono-tabular" : ""}`}>{v}</dd>
    </div>
  );
}

function FileUpload({
  file, onChange, optional,
}: { file: File | null; onChange: (f: File | null) => void; optional?: boolean }) {
  return (
    <div className="space-y-2">
      <Label>Payment receipt {optional && <span className="text-muted-foreground">(optional)</span>}</Label>
      <label className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-card/60 px-3 py-3 cursor-pointer hover:border-primary/50">
        <Upload className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground flex-1 truncate">
          {file ? file.name : "Tap to upload image or PDF"}
        </span>
        <input
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </label>
    </div>
  );
}