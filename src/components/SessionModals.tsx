import { useEffect, useState } from "react";
import { Play, Plus, Minus, ShoppingCart, Wallet, CheckCircle2, FileDown } from "lucide-react";
import { useData } from "../lib/store";
import { useToast } from "./Toaster";
import { Modal, Input, Button, StatusBadge } from "./ui";
import { UPIQR } from "./UPIQR";
import { generateSessionReceiptPDF } from "../lib/pdf";
import { formatMoney, liveSessionCost, finalizeSessionCost, formatDuration, formatAmountInWords } from "../lib/format";
import { cn } from "../utils/cn";
import type { GameSession, Station, ExtraItem, PaymentMethod, Bill } from "../lib/types";

const PAYMENTS: { id: PaymentMethod; color: string }[] = [
  { id: "Cash", color: "free" },
  { id: "UPI", color: "occupied" },
  { id: "Card", color: "warn" },
];

export function StartSessionModal({
  open,
  onClose,
  presetStation,
  stations,
}: {
  open: boolean;
  onClose: () => void;
  presetStation: Station | null;
  stations: Station[];
}) {
  const { customers, settings, startSession, addCustomer, isHappyHour } = useData();
  const { toast } = useToast();
  const cur = settings.currency;

  const [mode, setMode] = useState<"existing" | "new" | "walkin">("walkin");
  const [existingId, setExistingId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [stationId, setStationId] = useState("");
  const [rate, setRate] = useState("0");

  useEffect(() => {
    if (!open) return;
    setMode("walkin");
    // initialize only on open transition - don't reset while user is interacting
    setExistingId((prev) => {
      // keep existing if still valid, else fallback to first customer
      const ids = customers.map((c) => c.id);
      if (prev && ids.includes(prev)) return prev;
      return customers[0]?.id || "";
    });
    setName("");
    setPhone("");
    const st = presetStation || stations[0];
    setStationId(st?.id || "");
    setRate(String(st?.hourlyRate || 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const chosen = stations.find((s) => s.id === stationId) || presetStation;
  const happy = chosen ? isHappyHour(chosen.type) : false;

  function submit() {
    if (!chosen) return;
    let customerName = "Walk-in";
    let customerId: string | undefined;
    let customerPhone: string | undefined;
    if (mode === "existing") {
      const c = customers.find((x) => x.id === existingId);
      if (!c) return;
      customerName = c.name;
      customerId = c.id;
      customerPhone = c.phone;
    } else if (mode === "new") {
      if (!name.trim()) return;
      customerId = addCustomer({ name: name.trim(), phone: phone.trim(), prepaidBalance: 0 });
      customerName = name.trim();
      customerPhone = phone.trim();
    }
    startSession({
      customerName,
      customerId,
      customerPhone,
      stationId: chosen.id,
      stationName: chosen.name,
      type: chosen.type,
      startTime: Date.now(),
      hourlyRate: Number(rate) || chosen.hourlyRate,
    });
    toast(`Session started on ${chosen.name}`, "occupied");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Start Session">
      <div className="space-y-4">
        {/* Station */}
        {presetStation ? (
          <div className="flex items-center justify-between rounded-xl border border-free/30 bg-free/10 px-4 py-3">
            <div>
              <p className="font-display font-semibold text-ink">{presetStation.name}</p>
              <p className="text-xs text-muted">{presetStation.type}</p>
            </div>
            <StatusBadge status="available" label={happy ? "Happy Hour" : "Ready"} />
          </div>
        ) : (
          <div>
            <span className="mb-1.5 block text-sm font-medium text-muted">Select station</span>
            <select
              value={stationId}
              onChange={(e) => {
                setStationId(e.target.value);
                const st = stations.find((s) => s.id === e.target.value);
                if (st) setRate(String(st.hourlyRate));
              }}
              className="w-full rounded-xl border border-hairline bg-panel2 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-free/50 [&>option]:bg-panel2"
            >
              {stations.length === 0 && <option value="">No available stations</option>}
              {stations.map((s) => (
                <option key={s.id} value={s.id}>{s.name} • {s.type} • {formatMoney(s.hourlyRate, cur)}/hr</option>
              ))}
            </select>
          </div>
        )}

        {/* Customer */}
        <div>
          <span className="mb-1.5 block text-sm font-medium text-muted">Customer</span>
          <div className="mb-2 inline-flex w-full rounded-xl bg-panel2 p-1">
            {(["walkin", "existing", "new"] as const).map((m) => {
              const disabled = m === "existing" && customers.length === 0;
              return (
                <button
                  key={m}
                  onClick={() => !disabled && setMode(m)}
                  disabled={disabled}
                  className={cn(
                    "flex-1 rounded-lg py-1.5 text-xs font-medium capitalize transition",
                    disabled ? "cursor-not-allowed opacity-40" : "",
                    mode === m && !disabled ? "bg-free text-canvas" : "text-muted hover:text-ink"
                  )}
                  title={disabled ? "No saved customers yet" : undefined}
                >
                  {m === "walkin" ? "Walk-in" : m === "existing" ? `Existing${customers.length ? ` (${customers.length})` : ""}` : "New"}
                </button>
              );
            })}
          </div>
          {mode === "existing" && (
            customers.length === 0 ? (
              <p className="rounded-xl border border-dashed border-hairline bg-panel2/50 px-3 py-3 text-center text-sm text-muted">No customers yet — add one via Customers or choose Walk-in / New.</p>
            ) : (
              <select value={existingId} onChange={(e) => setExistingId(e.target.value)} className="w-full rounded-xl border border-hairline bg-panel2 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-free/50 [&>option]:bg-panel2">
                {customers.map((c) => (<option key={c.id} value={c.id}>{c.name} • {c.phone || "no phone"}</option>))}
              </select>
            )
          )}
          {mode === "new" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input placeholder="Name *" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              <Input placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          )}
          {mode === "walkin" && <p className="text-sm text-muted">No customer details will be recorded.</p>}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Hourly rate" type="number" value={rate} onChange={(e) => setRate(e.target.value)} mono />
          {chosen && <div className="flex flex-col justify-end pb-1"><StatusBadge status={happy ? "available" : "rented"} label={happy ? "Happy hour active" : "Standard rate"} /></div>}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!chosen || (mode === "new" && !name.trim())}>
            <Play className="h-4 w-4" /> Start
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function BillSessionModal({
  open,
  onClose,
  session,
}: {
  open: boolean;
  onClose: () => void;
  session: GameSession | null;
}) {
  const { settings, endSession } = useData();
  const { toast } = useToast();
  const cur = settings.currency;
  const [extras, setExtras] = useState<ExtraItem[]>([]);
  const [payment, setPayment] = useState<PaymentMethod>("Cash");
  const [receipt, setReceipt] = useState<Bill | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    if (open) {
      setExtras([]);
      setPayment("Cash");
      setReceipt(null);
    }
  }, [open, session?.id]);

  // live tick
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [open]);

  const roundOff = settings.billingRoundOffMinutes ?? 15;
  const base = session ? liveSessionCost(session.startTime, null, session.hourlyRate, roundOff) : 0;
  const extrasTotal = extras.reduce((s, e) => s + e.qty * e.price, 0);
  const total = base + extrasTotal;
  const exactBase = session ? liveSessionCost(session.startTime, null, session.hourlyRate) : 0;

  function addSnack(snack: ExtraItem) {
    setExtras((p) => {
      const found = p.find((x) => x.name === snack.name);
      if (found) return p.map((x) => (x.name === snack.name ? { ...x, qty: x.qty + 1 } : x));
      return [...p, { ...snack, qty: 1 }];
    });
  }
  function changeQty(name: string, delta: number) {
    setExtras((p) =>
      p
        .map((x) => (x.name === name ? { ...x, qty: x.qty + delta } : x))
        .filter((x) => x.qty > 0)
    );
  }

  function confirm() {
    if (!session) return;
    const end = Date.now();
    const finalBase = finalizeSessionCost(session.startTime, end, session.hourlyRate, roundOff);
    const finalTotal = Math.round((finalBase + extrasTotal) * 100) / 100;
    const bill: Bill = {
      id: session.id,
      billNumber: `RCPT-${session.id.slice(-6).toUpperCase()}`,
      customerName: session.customerName,
      items: [
        { description: `${session.stationName} (${session.type}) • ${formatDuration(session.startTime, end)}`, qty: 1, price: finalBase },
        ...extras.map((e) => ({ description: e.name, qty: e.qty, price: e.price })),
      ],
      subtotal: finalTotal,
      taxRate: 0,
      taxAmount: 0,
      discount: 0,
      total: finalTotal,
      paymentMethod: payment,
      createdAt: end,
      fromSession: true,
      sessionId: session.id,
    };
    endSession(session.id, { extras, paymentMethod: payment });
    toast(`${formatMoney(finalTotal, cur)} collected (${payment})`, "free");
    setReceipt(bill);
  }

  if (!session) return null;

  if (receipt) {
    return (
      <Modal open={open} onClose={onClose} title="Payment Collected" wide>
        <div className="flex flex-col items-center py-4 text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-free/15 text-free">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <p className="font-display text-lg font-semibold text-ink">₹{receipt.total} collected</p>
          <p className="text-sm text-muted">{receipt.customerName} • {receipt.paymentMethod}</p>
          <p className="mono mt-1 text-xs text-muted">{receipt.billNumber}</p>
          <div className="mt-5 w-full max-w-sm rounded-xl border border-hairline bg-panel2 p-4 text-left">
            {receipt.items.map((it, i) => (
              <div key={i} className="flex items-center justify-between py-1 text-sm">
                <span className="text-muted">{it.description}</span>
                <span className="mono text-ink">{formatMoney(it.qty * it.price, cur)}</span>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-hairline pt-2">
              <span className="font-display font-semibold text-ink">Total</span>
              <span className="mono font-bold text-free">{formatMoney(receipt.total, cur)}</span>
            </div>
            <p className="mt-2 text-xs italic text-muted">{formatAmountInWords(receipt.total, cur)}</p>
          </div>
          {settings.upiId && (
            <div className="mt-4 flex w-full max-w-sm flex-col items-center gap-2 rounded-xl border border-hairline bg-panel p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted">Scan to Pay via UPI</p>
              <UPIQR bill={receipt} settings={settings} size={140} />
              <p className="text-xs text-muted text-center">UPI: {settings.upiId} • {formatMoney(receipt.total, cur)} — amount auto-filled</p>
              <p className="text-[10px] text-muted">GPay • PhonePe • Paytm • BHIM</p>
            </div>
          )}
          <div className="mt-5 flex w-full max-w-sm gap-2">
            <Button variant="outline" className="flex-1" onClick={async () => await generateSessionReceiptPDF(receipt, settings)}>
              <FileDown className="h-4 w-4" /> PDF Receipt
            </Button>
            <Button className="flex-1" onClick={onClose}>Done</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Stop & Bill" wide>
      <div className="grid gap-5 md:grid-cols-2">
        {/* Left: session + snacks */}
        <div className="space-y-4">
          <div className="rounded-xl border border-hairline bg-panel2 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display font-semibold text-ink">{session.customerName}</p>
                <p className="text-xs text-muted">{session.stationName} • {session.type}</p>
              </div>
              <div className="text-right">
                <p className="mono text-lg font-bold text-occupied">{formatDuration(session.startTime, null)}</p>
                <p className="text-xs text-muted">playing</p>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted"><ShoppingCart className="h-4 w-4" /> Add snacks / extras</p>
            <div className="flex flex-wrap gap-2">
              {settings.snacks.map((s) => (
                <button key={s.name} onClick={() => addSnack(s)} className="rounded-lg border border-hairline bg-panel2 px-3 py-1.5 text-xs text-ink transition hover:border-free/50">
                  {s.name} <span className="mono text-muted">{formatMoney(s.price, cur)}</span>
                </button>
              ))}
            </div>
            {extras.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {extras.map((e) => (
                  <div key={e.name} className="flex items-center gap-2 rounded-lg bg-panel2 px-3 py-1.5 text-sm">
                    <span className="flex-1 text-ink">{e.name}</span>
                    <button onClick={() => changeQty(e.name, -1)} className="rounded p-1 text-muted hover:text-ink"><Minus className="h-3.5 w-3.5" /></button>
                    <span className="mono w-5 text-center text-ink">{e.qty}</span>
                    <button onClick={() => changeQty(e.name, 1)} className="rounded p-1 text-muted hover:text-ink"><Plus className="h-3.5 w-3.5" /></button>
                    <span className="mono ml-1 w-16 text-right text-muted">{formatMoney(e.qty * e.price, cur)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: totals + payment */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-hairline bg-panel2 p-4">
            <Row label="Session time" value={formatMoney(base, cur)} />
            {exactBase !== base && <p className="text-[11px] text-muted">Exact {formatMoney(exactBase, cur)} → rounded to {roundOff}-min billing</p>}
            <Row label="Extras" value={formatMoney(extrasTotal, cur)} />
            <div className="mt-2 flex items-center justify-between border-t border-hairline pt-2">
              <span className="font-display font-semibold text-ink">Total</span>
              <span className="mono text-xl font-bold text-free">{formatMoney(total, cur)}</span>
            </div>
            <p className="mt-1 text-[11px] text-muted">Round-off: {roundOff} min (change in Settings)</p>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted"><Wallet className="h-4 w-4" /> Payment method</p>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENTS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPayment(p.id)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-medium transition active:scale-[0.97]",
                    payment === p.id
                      ? cn("bg-opacity-15", statusBg(p.color), statusText(p.color), statusRing(p.color))
                      : "border-hairline bg-panel2 text-muted hover:text-ink"
                  )}
                >
                  {p.id}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-[2]" onClick={confirm}>
              Collect {formatMoney(total, cur)}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted">{label}</span>
      <span className="mono text-ink">{value}</span>
    </div>
  );
}

function statusBg(c: string) {
  return { free: "bg-free/15", occupied: "bg-occupied/15", warn: "bg-warn/15" }[c] || "bg-white/5";
}
function statusText(c: string) {
  return { free: "text-free", occupied: "text-occupied", warn: "text-warn" }[c] || "text-ink";
}
function statusRing(c: string) {
  return { free: "border-free/50", occupied: "border-occupied/50", warn: "border-warn/50" }[c] || "border-hairline";
}
