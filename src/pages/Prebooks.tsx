import { useMemo, useState } from "react";
import { Calendar, Clock, Link as LinkIcon, Copy, Check, Plus, Trash2, QrCode, ExternalLink, Users, Gamepad2 } from "lucide-react";
import { useData, getPrebookLink } from "../lib/store";
import { useAuth } from "../lib/auth";
import { Card, Button, Badge, Modal, Input, Select, SectionTitle, EmptyState, StatCard } from "../components/ui";
import { formatMoney, formatDate, formatDateTime } from "../lib/format";
import { useToast } from "../components/Toaster";
import type { Prebook, Station } from "../lib/types";
import { UPIQR } from "../components/UPIQR";
import * as QRCodeImport from "qrcode";
const QRCode: any = (QRCodeImport as any).default || QRCodeImport;

export default function Prebooks() {
  const { stations, sessions, prebooks, settings, addPrebook, updatePrebook, deletePrebook, convertPrebook } = useData();
  const { user, guest } = useAuth();
  const { toast } = useToast();
  const cur = settings.currency;
  const depositPct = settings.prebookDepositPercent ?? 30;
  const uid = guest ? "guest" : user?.uid || "demo";
  const link = getPrebookLink(uid);

  const [copied, setCopied] = useState(false);
  const [linkQR, setLinkQR] = useState<string | null>(null);
  const [showLinkQR, setShowLinkQR] = useState(false);
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<Prebook | null>(null);

  const activeBookings = sessions.filter((s) => s.status === "active");
  const sortedPrebooks = useMemo(() => [...prebooks].sort((a, b) => a.startTime - b.startTime), [prebooks]);
  const pending = prebooks.filter((p) => p.status === "pending").length;
  const confirmed = prebooks.filter((p) => p.status === "confirmed").length;
  const depositCollected = prebooks.filter((p) => p.status !== "cancelled").reduce((s, p) => s + p.depositAmount, 0);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast("Prebook link copied!", "free");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Copy failed", "danger");
    }
  }

  async function handleShowQR() {
    if (linkQR) {
      setShowLinkQR(true);
      return;
    }
    try {
      const url = await QRCode.toDataURL(link, { width: 260, margin: 1 });
      setLinkQR(url);
      setShowLinkQR(true);
    } catch {
      toast("QR generation failed", "danger");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Active Bookings" value={String(activeBookings.length)} icon={<Gamepad2 className="h-5 w-5" />} accent="occupied" delta={`${stations.length} stations`} />
        <StatCard label="Prebooks Pending" value={String(pending)} icon={<Clock className="h-5 w-5" />} accent="warn" delta={`${prebooks.length} total`} />
        <StatCard label="Confirmed" value={String(confirmed)} icon={<Calendar className="h-5 w-5" />} accent="free" />
        <StatCard label="Deposit Collected" value={formatMoney(depositCollected, cur)} icon={<Users className="h-5 w-5" />} accent="violet" />
      </div>

      <Card className="p-5">
        <SectionTitle
          title="Prebook Link"
          subtitle={`Share this link with customers — it is unique for ${guest ? "demo" : settings.studioName} (${uid.slice(0, 6)}…)`}
          icon={<LinkIcon className="h-5 w-5" />}
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleShowQR}>
                <QrCode className="h-4 w-4" /> QR
              </Button>
              <Button size="sm" variant="outline" onClick={() => window.open(link, "_blank")}>
                <ExternalLink className="h-4 w-4" /> Open
              </Button>
              <Button size="sm" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy Link"}
              </Button>
            </div>
          }
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1 truncate rounded-xl border border-hairline bg-panel2 px-3 py-2.5 font-mono text-sm text-ink">{link}</div>
          <div className="text-xs text-muted">Deposit: <span className="font-bold text-free">{depositPct}% of rent</span> — editable in Settings → Billing round-off</div>
        </div>
        <p className="mt-2 text-xs text-muted">This link is <span className="font-semibold text-ink">different for each user/studio</span> — your customers will see your stations, rates & prebooks. For demo, it uses local data; for cloud, it reads your Firestore workspace.</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Current Bookings (Active Sessions)" subtitle={`${activeBookings.length} playing now`} icon={<Gamepad2 className="h-5 w-5" />} />
          {activeBookings.length === 0 ? (
            <EmptyState icon={<Gamepad2 className="h-6 w-6" />} title="No active bookings" body="Start a session from Dashboard to see it here." />
          ) : (
            <div className="space-y-2">
              {activeBookings.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border border-occupied/20 bg-occupied/5 px-4 py-3">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-occupied" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{s.customerName} — {s.stationName}</p>
                    <p className="text-xs text-muted">{formatDateTime(s.startTime)} • {s.type}</p>
                  </div>
                  <Badge color="active">{s.type}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle
            title="Prebooks"
            subtitle={`${sortedPrebooks.length} prebookings • ${pending} pending`}
            icon={<Calendar className="h-5 w-5" />}
            action={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New Prebook</Button>}
          />
          {sortedPrebooks.length === 0 ? (
            <EmptyState icon={<Calendar className="h-6 w-6" />} title="No prebooks yet" body="Share your prebook link or add one manually. Deposit is calculated from station rent × deposit %." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add Prebook</Button>} />
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {sortedPrebooks.map((p) => (
                <div key={p.id} className="group flex items-center gap-3 rounded-xl border border-hairline bg-panel2 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{p.customerName} <span className="text-muted">• {p.stationName}</span></p>
                    <p className="text-xs text-muted">{formatDate(p.date)} • {new Date(p.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–{new Date(p.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • {p.durationMinutes}m</p>
                    <p className="text-xs text-muted">{formatMoney(p.totalRent, cur)} total • {p.depositPercent}% deposit {formatMoney(p.depositAmount, cur)} • <Badge tone={p.status === "confirmed" ? "free" : p.status === "pending" ? "warn" : p.status === "cancelled" ? "danger" : "muted"}>{p.status}</Badge></p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => setViewing(p)} className="rounded p-1.5 text-muted hover:text-ink"><ExternalLink className="h-4 w-4" /></button>
                    {p.status === "pending" && <button onClick={() => updatePrebook(p.id, { status: "confirmed" })} className="rounded p-1.5 text-free hover:bg-free/10">Confirm</button>}
                    {p.status !== "cancelled" && p.status !== "converted" && <button onClick={() => convertPrebook(p.id)} className="rounded p-1.5 text-muted hover:text-free text-xs">Convert</button>}
                    <button onClick={() => { if (confirm("Delete prebook?")) deletePrebook(p.id); }} className="rounded p-1.5 text-muted hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <CreatePrebookModal open={open} onClose={() => setOpen(false)} stations={stations} depositPercent={depositPct} onCreate={async (data) => { await addPrebook(data); setOpen(false); toast("Prebook created", "free"); }} />
      {viewing && <PrebookViewModal prebook={viewing} settings={settings} onClose={() => setViewing(null)} />}
      <Modal open={showLinkQR} onClose={() => setShowLinkQR(false)} title="Prebook Link QR">
        <div className="flex flex-col items-center gap-4 py-2">
          {linkQR ? <img src={linkQR} alt="Prebook QR" className="h-64 w-64 rounded-xl border border-hairline bg-white p-2" /> : <p className="text-sm text-muted">Generating…</p>}
          <p className="break-all text-center font-mono text-xs text-muted">{link}</p>
          <p className="text-center text-sm text-muted">Customers scan to open your prebook page. Link is unique per studio.</p>
          <Button onClick={handleCopy} size="sm"><Copy className="h-4 w-4" /> Copy Link</Button>
        </div>
      </Modal>
    </div>
  );
}

function CreatePrebookModal({ open, onClose, stations, depositPercent, onCreate }: { open: boolean; onClose: () => void; stations: Station[]; depositPercent: number; onCreate: (p: Omit<Prebook, "id" | "createdAt">) => void }) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [stationId, setStationId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState("10:00");
  const [duration, setDuration] = useState("60");

  const station = stations.find((s) => s.id === stationId) || stations[0];
  const durMin = Number(duration) || 60;
  const totalRent = station ? Math.round((station.hourlyRate * durMin) / 60) : 0;
  const depositAmount = Math.round((totalRent * depositPercent) / 100);
  const remaining = totalRent - depositAmount;

  return (
    <Modal open={open} onClose={onClose} title="New Prebook">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Customer name *" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. Aarav" />
          <Input label="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="98765..." />
        </div>
        <Select label="Station *" value={stationId} onChange={(e) => setStationId(e.target.value)}>
          <option value="">Select station</option>
          {stations.filter(s=> s.status !== "maintenance").map((s) => <option key={s.id} value={s.id}>{s.name} • {s.type} • ₹{s.hourlyRate}/hr</option>)}
        </Select>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Start time" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          <Select label="Duration" value={duration} onChange={(e) => setDuration(e.target.value)}>
            <option value="30">30 min</option>
            <option value="60">1 hour</option>
            <option value="90">1.5 hours</option>
            <option value="120">2 hours</option>
            <option value="180">3 hours</option>
          </Select>
        </div>
        {station && (
          <div className="rounded-xl border border-hairline bg-panel2 p-3 text-sm">
            <div className="flex justify-between"><span className="text-muted">Rate</span><span className="text-ink">₹{station.hourlyRate}/hr</span></div>
            <div className="flex justify-between"><span className="text-muted">Total rent ({durMin} min)</span><span className="text-ink">₹{totalRent}</span></div>
            <div className="flex justify-between"><span className="text-muted">Deposit ({depositPercent}%)</span><span className="font-bold text-free">₹{depositAmount} to pay now</span></div>
            <div className="flex justify-between"><span className="text-muted">Remaining</span><span className="text-ink">₹{remaining} at check-in</span></div>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!customerName.trim() || !stationId} onClick={() => {
            if (!station) return;
            const [h,m]= start.split(":").map(Number);
            const day = new Date(date + "T00:00:00");
            const startTs = new Date(date + `T${start}:00`).getTime();
            const endTs = startTs + durMin*60000;
            onCreate({
              customerName: customerName.trim(),
              customerPhone: customerPhone.trim(),
              stationId: station.id,
              stationName: station.name,
              type: station.type,
              date: day.getTime(),
              startTime: startTs,
              endTime: endTs,
              durationMinutes: durMin,
              hourlyRate: station.hourlyRate,
              totalRent,
              depositPercent,
              depositAmount,
              remainingAmount: remaining,
              status: "pending",
              paymentMethod: "UPI",
            });
          }}>Create Prebook</Button>
        </div>
      </div>
    </Modal>
  );
}

function PrebookViewModal({ prebook, settings, onClose }: { prebook: Prebook; settings: any; onClose: () => void }) {
  const cur = settings.currency;
  return (
    <Modal open onClose={onClose} title={`Prebook ${prebook.customerName}`} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-hairline bg-panel2 p-3"><p className="text-xs text-muted">Station</p><p className="font-medium text-ink">{prebook.stationName} • {prebook.type}</p></div>
          <div className="rounded-xl border border-hairline bg-panel2 p-3"><p className="text-xs text-muted">When</p><p className="font-medium text-ink">{formatDate(prebook.date)} {new Date(prebook.startTime).toLocaleTimeString()}–{new Date(prebook.endTime).toLocaleTimeString()}</p></div>
          <div className="rounded-xl border border-hairline bg-panel2 p-3"><p className="text-xs text-muted">Total</p><p className="font-medium text-ink">{formatMoney(prebook.totalRent, cur)}</p></div>
          <div className="rounded-xl border border-hairline bg-panel2 p-3"><p className="text-xs text-muted">Deposit ({prebook.depositPercent}%)</p><p className="font-bold text-free">{formatMoney(prebook.depositAmount, cur)}</p></div>
        </div>
        {settings.upiId && prebook.depositAmount > 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-hairline bg-panel p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Scan to Pay Deposit</p>
            <UPIQR bill={{ id: prebook.id, billNumber: `PBK-${prebook.id.slice(0,6)}`, customerName: prebook.customerName, items: [{ description: `Deposit ${prebook.stationName}`, qty: 1, price: prebook.depositAmount }], subtotal: prebook.depositAmount, taxRate: 0, taxAmount: 0, discount: 0, total: prebook.depositAmount, paymentMethod: "UPI", createdAt: Date.now() } as any} settings={settings} size={140} />
            <p className="text-xs text-muted">UPI: {settings.upiId} — amount auto-filled ₹{prebook.depositAmount}</p>
          </div>
        )}
        <div className="flex justify-end"><Button variant="ghost" onClick={onClose}>Close</Button></div>
      </div>
    </Modal>
  );
}
