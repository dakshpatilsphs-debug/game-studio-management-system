import { useEffect, useState, useMemo } from "react";
import { Gamepad2, Calendar, Clock, Shield, Phone, User, CreditCard, CheckCircle } from "lucide-react";
import { collection, getDocs, getDoc, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Card, Button, Input, Select, Badge } from "../components/ui";
import { formatMoney, formatDate } from "../lib/format";
import { UPIQR } from "../components/UPIQR";
import type { Station, Settings, Prebook } from "../lib/types";
import { DEFAULT_RATES, DEFAULT_SNACKS } from "../lib/store";

function loadPublicBucket(uid: string) {
  try {
    const raw = localStorage.getItem(`gsm_${uid}_data_v1`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}
function loadPublicSettings(uid: string): Settings | null {
  try {
    const raw = localStorage.getItem(`gsm_${uid}_settings_v1`);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        studioName: p.studioName || "Gaming Lounge",
        currency: p.currency || "₹",
        taxRate: p.taxRate || 0,
        logo: p.logo,
        rates: p.rates || DEFAULT_RATES,
        snacks: p.snacks || DEFAULT_SNACKS,
        billingRoundOffMinutes: p.billingRoundOffMinutes || 15,
        prebookDepositPercent: p.prebookDepositPercent ?? 30,
        businessEmail: p.businessEmail,
        businessPhone: p.businessPhone,
        businessAddress: p.businessAddress,
        upiId: p.upiId,
        bankName: p.bankName,
        bankAccount: p.bankAccount,
        bankIfsc: p.bankIfsc,
        swift: p.swift,
        beneficiary: p.beneficiary,
        paypal: p.paypal,
        paymentTerms: p.paymentTerms,
      } as Settings;
    }
  } catch {}
  return null;
}

export default function PublicPrebook() {
  const params = new URLSearchParams(window.location.search);
  const studioId = params.get("prebook") || params.get("studio") || window.location.hash.replace("#", "").replace("prebook-", "").replace("prebook/", "") || "";
  const [loading, setLoading] = useState(true);
  const [stations, setStations] = useState<Station[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [prebooks, setPrebooks] = useState<Prebook[]>([]);
  const [error, setError] = useState("");

  // form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [stationId, setStationId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState("14:00");
  const [duration, setDuration] = useState("60");
  const [note, setNote] = useState("");
  const [success, setSuccess] = useState<Prebook | null>(null);

  useEffect(() => {
    if (!studioId) {
      setError("No studio link found. Ask the lounge for their prebook link.");
      setLoading(false);
      return;
    }
    async function load() {
      setLoading(true);
      // try local first
      const localData = loadPublicBucket(studioId);
      const localSettings = loadPublicSettings(studioId);
      if (localData && localSettings && localData.stations?.length) {
        setStations(localData.stations.filter((s: Station) => s.status !== "maintenance"));
        setSettings(localSettings);
        setPrebooks(localData.prebooks || []);
        setLoading(false);
        return;
      }
      // try firestore public read
      try {
        const snapStations = await getDocs(collection(db, "users", studioId, "stations"));
        const st = snapStations.docs.map((d) => ({ id: d.id, ...d.data() } as Station)).filter((s) => s.status !== "maintenance");
        const snapSettings = await getDoc(doc(db, "users", studioId, "settings", "main"));
        const sett = snapSettings.exists() ? (snapSettings.data() as Settings) : null;
        const snapPrebooks = await getDocs(collection(db, "users", studioId, "prebooks"));
        const pbs = snapPrebooks.docs.map((d) => ({ id: d.id, ...d.data() } as Prebook));
        if (st.length) setStations(st);
        if (sett) setSettings(sett as Settings);
        else if (localSettings) setSettings(localSettings);
        else setSettings({ studioName: "Gaming Lounge", currency: "₹", taxRate: 0, rates: DEFAULT_RATES, snacks: DEFAULT_SNACKS, billingRoundOffMinutes: 15, prebookDepositPercent: 30 } as Settings);
        setPrebooks(pbs);
        if (!st.length && !localData) setError("Studio not found or no stations available.");
      } catch (e: any) {
        // fallback to demo
        const demoSt: Station[] = [
          { id: "demo-pc1", name: "PC-01", type: "PC", hourlyRate: 60, status: "available" },
          { id: "demo-ps5", name: "PS5-01", type: "PS5", hourlyRate: 100, status: "available" },
          { id: "demo-vr", name: "VR-01", type: "VR", hourlyRate: 180, status: "available" },
        ];
        setStations(demoSt);
        setSettings({ studioName: "Demo Lounge", currency: "₹", taxRate: 0, rates: DEFAULT_RATES, snacks: DEFAULT_SNACKS, billingRoundOffMinutes: 15, prebookDepositPercent: 30, upiId: "demo@upi" } as Settings);
        setError("");
      }
      setLoading(false);
    }
    load();
  }, [studioId]);

  const chosen = stations.find((s) => s.id === stationId) || null;
  const dur = Number(duration) || 60;
  const depositPct = settings?.prebookDepositPercent ?? 30;
  const totalRent = chosen ? Math.round((chosen.hourlyRate * dur) / 60) : 0;
  const depositAmt = Math.round((totalRent * depositPct) / 100);
  const remaining = totalRent - depositAmt;

  const upcoming = useMemo(() => [...prebooks].filter((p) => p.status !== "cancelled").sort((a, b) => a.startTime - b.startTime).slice(0, 10), [prebooks]);

  async function handleSubmit() {
    if (!name.trim() || !stationId || !chosen || !settings) return;
    const day = new Date(date + "T00:00:00").getTime();
    const [h, m] = start.split(":").map(Number);
    const startTs = new Date(date + `T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`).getTime();
    const endTs = startTs + dur * 60000;
    // overlap check
    const overlap = prebooks.some((p) => p.stationId === stationId && p.status !== "cancelled" && !(endTs <= p.startTime || startTs >= p.endTime));
    if (overlap) {
      alert("This station is already prebooked for that time. Choose another slot.");
      return;
    }
    const payload = {
      customerName: name.trim(),
      customerPhone: phone.trim(),
      stationId: chosen.id,
      stationName: chosen.name,
      type: chosen.type,
      date: day,
      startTime: startTs,
      endTime: endTs,
      durationMinutes: dur,
      hourlyRate: chosen.hourlyRate,
      totalRent,
      depositPercent: depositPct,
      depositAmount: depositAmt,
      remainingAmount: remaining,
      status: "pending" as const,
      note: note.trim() || undefined,
      studioId,
    };
    // try public write via store helper (direct firestore)
    try {
      const { addDoc, collection } = await import("firebase/firestore");
      const { clean } = await import("../lib/store");
      await addDoc(collection(db, "users", studioId, "prebooks"), clean({ ...payload, createdAt: Date.now() }));
      setSuccess(payload as any);
    } catch {
      // fallback local
      try {
        const { uid } = await import("../lib/format");
        const id = uid();
        const raw = localStorage.getItem(`gsm_${studioId}_data_v1`);
        const data = raw ? JSON.parse(raw) : { stations: [], sessions: [], expenses: [], bills: [], customers: [], prebooks: [] };
        const nb = { ...payload, id, createdAt: Date.now() } as Prebook;
        const newData = { ...data, prebooks: [...(data.prebooks || []), nb] };
        localStorage.setItem(`gsm_${studioId}_data_v1`, JSON.stringify(newData));
        setSuccess(nb as any);
      } catch {
        alert("Failed to create prebook. Try again.");
        return;
      }
    }
    setPrebooks((prev) => [...prev, { ...payload, id: "tmp-" + Date.now(), createdAt: Date.now() } as Prebook]);
  }

  if (loading) return <div className="min-h-screen bg-canvas flex items-center justify-center text-ink">Loading studio…</div>;
  if (success) {
    return (
      <div className="min-h-screen bg-canvas p-6 flex items-center justify-center">
        <Card className="max-w-md w-full p-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-free/15 text-free"><CheckCircle className="h-8 w-8" /></div>
          <h2 className="font-display text-xl font-bold text-ink">Prebook Confirmed!</h2>
          <p className="mt-2 text-sm text-muted">Hi {success.customerName}, your {success.stationName} is reserved for {formatDate(success.date)} {new Date(success.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • {success.durationMinutes} min.</p>
          <div className="mt-4 rounded-xl border border-hairline bg-panel2 p-3 text-left text-sm">
            <div className="flex justify-between"><span className="text-muted">Total</span><span className="text-ink">{formatMoney(success.totalRent, settings?.currency || "₹")}</span></div>
            <div className="flex justify-between"><span className="text-muted">Deposit paid ({success.depositPercent}%)</span><span className="font-bold text-free">{formatMoney(success.depositAmount, settings?.currency || "₹")}</span></div>
            <div className="flex justify-between"><span className="text-muted">Pay at venue</span><span className="text-ink">{formatMoney(success.remainingAmount, settings?.currency || "₹")}</span></div>
          </div>
          {settings?.upiId && success.depositAmount > 0 && (
            <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-hairline bg-panel p-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted">Pay Deposit via UPI</p>
              <UPIQR bill={{ id: "tmp", billNumber: `PBK-${Date.now().toString().slice(-6)}`, customerName: success.customerName, items: [{ description: `Deposit ${success.stationName}`, qty: 1, price: success.depositAmount }], subtotal: success.depositAmount, taxRate: 0, taxAmount: 0, discount: 0, total: success.depositAmount, paymentMethod: "UPI", createdAt: Date.now() } as any} settings={settings} size={150} />
              <p className="text-xs text-muted">{settings.upiId} • Amount auto-filled</p>
            </div>
          )}
          <Button className="mt-4 w-full" onClick={() => { setSuccess(null); setName(""); setPhone(""); }}>Book Another</Button>
          <Button variant="ghost" className="mt-2 w-full" onClick={() => (window.location.href = window.location.origin + window.location.pathname)}>Back to Home</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="pointer-events-none fixed inset-0 overflow-hidden"><div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-free/[0.04] blur-3xl" /><div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-occupied/[0.04] blur-3xl" /></div>
      <header className="relative border-b border-hairline bg-panel/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 flex items-center gap-3">
          {settings?.logo ? <img src={settings.logo} alt={settings.studioName} className="h-10 w-10 rounded-xl object-cover ring-1 ring-hairline" /> : <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-free/15 ring-1 ring-free/30"><Gamepad2 className="h-5 w-5 text-free" /></div>}
          <div>
            <h1 className="font-display text-lg font-bold text-ink">{settings?.studioName || "Gaming Lounge"}</h1>
            <p className="text-xs text-muted">{settings?.businessAddress || "Prebook your station"}</p>
          </div>
          <div className="ml-auto hidden sm:block text-right">
            <p className="text-xs text-muted">Prebook Deposit</p>
            <p className="font-bold text-free">{depositPct}% of rent</p>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="font-display text-lg font-semibold text-ink">Book a Station</h2>
            <p className="text-sm text-muted">Choose station, date & time. Pay <span className="font-bold text-free">{depositPct}%</span> now, rest at check-in.</p>
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Your name *" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aarav" />
                <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765..." />
              </div>
              <Select label="Station *" value={stationId} onChange={(e) => setStationId(e.target.value)}>
                <option value="">Select station</option>
                {stations.map((s) => <option key={s.id} value={s.id}>{s.name} • {s.type} • {formatMoney(s.hourlyRate, settings?.currency || "₹")}/hr</option>)}
              </Select>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Input label="Date *" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <Input label="Start time *" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
                <Select label="Duration *" value={duration} onChange={(e) => setDuration(e.target.value)}>
                  <option value="30">30 min</option>
                  <option value="60">1 hr</option>
                  <option value="90">1.5 hr</option>
                  <option value="120">2 hr</option>
                  <option value="180">3 hr</option>
                </Select>
              </div>
              <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any request" />
              {chosen && (
                <div className="rounded-xl border border-hairline bg-panel2 p-4">
                  <div className="flex justify-between text-sm"><span className="text-muted">Station</span><span className="text-ink font-medium">{chosen.name} • {chosen.type}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted">Rent ({dur} min @ {formatMoney(chosen.hourlyRate, settings?.currency || "₹")}/hr)</span><span className="text-ink">{formatMoney(totalRent, settings?.currency || "₹")}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted">Deposit ({depositPct}% editable by owner)</span><span className="font-bold text-free">{formatMoney(depositAmt, settings?.currency || "₹")} due now</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted">Remaining at venue</span><span className="text-ink">{formatMoney(remaining, settings?.currency || "₹")}</span></div>
                  <p className="mt-2 text-xs text-muted flex items-center gap-1"><Shield className="h-3 w-3" /> Secure prebook — deposit confirms your slot.</p>
                </div>
              )}
              {settings?.upiId && depositAmt > 0 && chosen && (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-hairline bg-panel p-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted">Scan to Pay Deposit ({formatMoney(depositAmt, settings.currency)})</p>
                  <UPIQR bill={{ id: "preview", billNumber: `PBK-DEMO`, customerName: name || "Guest", items: [{ description: `Deposit ${chosen.name}`, qty: 1, price: depositAmt }], subtotal: depositAmt, taxRate: 0, taxAmount: 0, discount: 0, total: depositAmt, paymentMethod: "UPI", createdAt: Date.now() } as any} settings={settings} size={140} />
                  <p className="text-xs text-muted">{settings.upiId} — amount auto-filled</p>
                </div>
              )}
              <Button className="w-full" disabled={!name.trim() || !stationId} onClick={handleSubmit}><Calendar className="h-4 w-4" /> Prebook & Pay {depositAmt > 0 ? formatMoney(depositAmt, settings?.currency || "₹") : ""}</Button>
              <p className="text-center text-xs text-muted flex items-center justify-center gap-1"><CreditCard className="h-3 w-3" /> Demo: no real payment — creates pending prebook for owner to confirm.</p>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-display font-semibold text-ink flex items-center gap-2"><Clock className="h-4 w-4" /> How it works</h3>
            <ol className="mt-3 list-decimal list-inside space-y-1 text-sm text-muted">
              <li>Pick station, date & time — see live rent.</li>
              <li>Pay <b className="text-ink">{depositPct}%</b> deposit (editable by owner in Settings) to lock slot.</li>
              <li>Owner confirms — you get confirmation. Pay remaining at venue.</li>
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="font-display font-semibold text-ink">Available Stations</h3>
            <div className="mt-3 grid gap-2">
              {stations.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border border-hairline bg-panel2 px-3 py-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-free/10 text-free"><Gamepad2 className="h-4 w-4" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink">{s.name} <span className="text-muted">• {s.type}</span></p>
                    <p className="text-xs text-muted">{formatMoney(s.hourlyRate, settings?.currency || "₹")}/hr</p>
                  </div>
                  <Badge color="available">Available</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-display font-semibold text-ink flex items-center gap-2"><Calendar className="h-4 w-4" /> Upcoming Prebooks & Bookings</h3>
            <p className="text-xs text-muted">Live prebooks for this lounge + active bookings.</p>
            <div className="mt-3 space-y-2 max-h-96 overflow-y-auto pr-1">
              {upcoming.length === 0 ? <p className="py-6 text-center text-sm text-muted">No prebooks yet — be the first!</p> : upcoming.map((p) => (
                <div key={p.id} className="rounded-xl border border-hairline bg-panel2 px-3 py-2">
                  <p className="text-sm font-medium text-ink">{p.customerName} • {p.stationName}</p>
                  <p className="text-xs text-muted">{formatDate(p.date)} {new Date(p.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • {p.durationMinutes} min • <Badge tone={p.status === "confirmed" ? "free" : p.status === "pending" ? "warn" : "muted"}>{p.status}</Badge></p>
                </div>
              ))}
            </div>
            {error && <p className="mt-2 text-xs text-warn">{error}</p>}
          </Card>

          <Card className="p-5">
            <h3 className="font-display font-semibold text-ink">Contact</h3>
            <div className="mt-2 space-y-1 text-sm text-muted">
              {settings?.businessPhone && <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {settings.businessPhone}</p>}
              {settings?.businessEmail && <p>{settings.businessEmail}</p>}
              {settings?.businessAddress && <p>{settings.businessAddress}</p>}
              <p className="pt-2 text-xs">Link unique for: <span className="font-mono text-ink">{studioId.slice(0, 8)}…</span></p>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
