import { useState, useEffect, type ReactNode } from "react";
import {
  LayoutDashboard,
  Gamepad2,
  Receipt,
  BarChart3,
  FileText,
  Sparkles,
  Menu,
  X,
  Cloud,
  HardDrive,
  Settings as SettingsIcon,
  LogOut,
  Users,
  WifiOff,
  Calendar,
} from "lucide-react";
import { cn } from "../utils/cn";
import { useData } from "../lib/store";
import { useAuth } from "../lib/auth";
import { fileToLogo } from "../lib/image";
import { STATION_TYPES, type StationType, type Settings } from "../lib/types";
import { Modal, Input, Button, Select } from "./ui";

export type PageId =
  | "dashboard"
  | "rentals"
  | "customers"
  | "expenses"
  | "reports"
  | "bills"
  | "prebooks"
  | "ai";

const NAV: { id: PageId; label: string; icon: ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
  { id: "rentals", label: "Stations", icon: <Gamepad2 className="h-5 w-5" /> },
  { id: "customers", label: "Customers", icon: <Users className="h-5 w-5" /> },
  { id: "bills", label: "Billing", icon: <FileText className="h-5 w-5" /> },
  { id: "expenses", label: "Expenses", icon: <Receipt className="h-5 w-5" /> },
  { id: "reports", label: "Reports", icon: <BarChart3 className="h-5 w-5" /> },
  { id: "prebooks", label: "Prebooks", icon: <Calendar className="h-5 w-5" /> },
  { id: "ai", label: "AI Assistant", icon: <Sparkles className="h-5 w-5" /> },
];

export function Layout({
  page,
  setPage,
  children,
}: {
  page: PageId;
  setPage: (p: PageId) => void;
  children: ReactNode;
}) {
  const { settings, mode, ready, setSettings, seedDemoData, clearAllData } = useData();
  const { user, guest, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        {settings.logo ? (
          <img src={settings.logo} alt={settings.studioName} className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-hairline" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-free/15 ring-1 ring-free/30">
            <Gamepad2 className="h-5 w-5 text-free" />
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold leading-tight text-ink">{settings.studioName}</p>
          <p className="text-xs text-muted">{guest ? "Demo mode" : "Lounge OS"}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setPage(item.id);
              setMobileOpen(false);
            }}
            className={cn(
              "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all active:scale-[0.98]",
              page === item.id
                ? "bg-free/10 text-ink ring-1 ring-inset ring-free/30"
                : "text-muted hover:bg-panel2 hover:text-ink"
            )}
          >
            <span className={cn(page === item.id ? "text-free" : "text-muted group-hover:text-ink")}>
              {item.icon}
            </span>
            {item.label}
            {item.id === "ai" && (
              <span className="ml-auto rounded bg-occupied/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-occupied">
                AI
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="border-t border-hairline p-3">
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-panel2 px-3 py-2 text-xs">
          {ready && mode === "cloud" ? (
            <>
              <Cloud className="h-4 w-4 text-free" />
              <span className="text-muted">Cloud Synced</span>
            </>
          ) : ready ? (
            <>
              <HardDrive className="h-4 w-4 text-warn" />
              <span className="text-muted">Local Mode</span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 animate-pulse rounded-full bg-free" />
              <span className="text-muted">Connecting…</span>
            </>
          )}
        </div>
        <button onClick={() => setSettingsOpen(true)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-panel2 hover:text-ink">
          <SettingsIcon className="h-5 w-5" /> Settings
        </button>
        <button onClick={() => logout()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-panel2 hover:text-ink">
          <LogOut className="h-5 w-5" /> {user ? "Sign out" : "Exit demo"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-free/[0.04] blur-3xl" />
        <div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-occupied/[0.04] blur-3xl" />
      </div>

      {/* Offline banner */}
      {offline && (
        <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-warn/90 py-1.5 text-center text-xs font-semibold text-canvas">
          <WifiOff className="h-3.5 w-3.5" /> Offline — changes will sync when reconnected
        </div>
      )}

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-hairline bg-panel/80 backdrop-blur-xl lg:block">
        {SidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-hairline bg-panel">
            <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-4 rounded-lg p-1.5 text-muted hover:bg-panel2">
              <X className="h-5 w-5" />
            </button>
            {SidebarContent}
          </aside>
        </div>
      )}

      <div className="relative lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-hairline bg-canvas/80 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-muted hover:bg-panel2 lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-display text-base font-semibold capitalize text-ink sm:text-lg">
                {NAV.find((n) => n.id === page)?.label}
              </h1>
              <p className="hidden text-xs text-muted sm:block">
                {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>
          <button onClick={() => setSettingsOpen(true)} className="rounded-lg p-2 text-muted transition hover:bg-panel2 hover:text-ink">
            <SettingsIcon className="h-5 w-5" />
          </button>
        </header>

        <main className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <div key={page} className="page-in">
            {children}
          </div>
        </main>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={setSettings}
        onSeed={seedDemoData}
        onClear={clearAllData}
      />
    </div>
  );
}

function SettingsModal({
  open,
  onClose,
  settings,
  onSave,
  onSeed,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  settings: import("../lib/types").Settings;
  onSave: (s: import("../lib/types").Settings) => void;
  onSeed: () => void;
  onClear: () => void;
}) {
  const [name, setName] = useState(settings.studioName);
  const [currency, setCurrency] = useState(settings.currency);
  const [tax, setTax] = useState(String(settings.taxRate));
  const [logo, setLogo] = useState<string | undefined>(settings.logo);
  const [rates, setRates] = useState(settings.rates);
  const [snacks, setSnacks] = useState(settings.snacks);
  const [logoBusy, setLogoBusy] = useState(false);
  const [email, setEmail] = useState(settings.businessEmail || "");
  const [phone, setPhone] = useState(settings.businessPhone || "");
  const [address, setAddress] = useState(settings.businessAddress || "");
  const [upiId, setUpiId] = useState(settings.upiId || "");
  const [bankName, setBankName] = useState(settings.bankName || "");
  const [bankAccount, setBankAccount] = useState(settings.bankAccount || "");
  const [bankIfsc, setBankIfsc] = useState(settings.bankIfsc || "");
  const [swift, setSwift] = useState(settings.swift || "");
  const [beneficiary, setBeneficiary] = useState(settings.beneficiary || "");
  const [paypal, setPaypal] = useState(settings.paypal || "");
  const [terms, setTerms] = useState(settings.paymentTerms || "");
  const [roundOff, setRoundOff] = useState(String(settings.billingRoundOffMinutes ?? 15));
  const [depositPct, setDepositPct] = useState(String(settings.prebookDepositPercent ?? 30));

  // keep local form in sync when settings change or modal re-opens
  useEffect(() => {
    if (open) {
      setName(settings.studioName);
      setCurrency(settings.currency);
      setTax(String(settings.taxRate));
      setLogo(settings.logo);
      setRates(settings.rates);
      setSnacks(settings.snacks);
      setEmail(settings.businessEmail || "");
      setPhone(settings.businessPhone || "");
      setAddress(settings.businessAddress || "");
      setUpiId(settings.upiId || "");
      setBankName(settings.bankName || "");
      setBankAccount(settings.bankAccount || "");
      setBankIfsc(settings.bankIfsc || "");
      setSwift(settings.swift || "");
      setBeneficiary(settings.beneficiary || "");
      setPaypal(settings.paypal || "");
      setTerms(settings.paymentTerms || "");
      setRoundOff(String(settings.billingRoundOffMinutes ?? 15));
      setDepositPct(String(settings.prebookDepositPercent ?? 30));
    }
  }, [open, settings]);

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoBusy(true);
    try {
      setLogo(await fileToLogo(file));
    } catch {
      /* ignore */
    } finally {
      setLogoBusy(false);
      e.target.value = "";
    }
  }

  function updateRate(type: StationType, patch: Partial<import("../lib/types").RateConfig>) {
    setRates((r) => ({ ...r, [type]: { ...r[type], ...patch } }));
  }

  return (
    <Modal open={open} onClose={onClose} title="Studio Settings" wide>
      <div className="space-y-5">
        <div>
          <span className="mb-1.5 block text-sm font-medium text-muted">Studio logo</span>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-hairline bg-panel2">
              {logo ? <img src={logo} alt="logo" className="h-full w-full object-cover" /> : <Gamepad2 className="h-7 w-7 text-muted" />}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-hairline bg-panel2 px-3 py-1.5 text-sm text-ink transition hover:border-muted/50">
              <SettingsIcon className="h-4 w-4" /> {logoBusy ? "Uploading…" : logo ? "Change" : "Upload logo"}
              <input type="file" accept="image/*" onChange={handleLogo} className="hidden" />
            </label>
            {logo && (
              <button onClick={() => setLogo(undefined)} className="text-sm text-danger hover:underline">Remove</button>
            )}
          </div>
        </div>

        <Input label="Studio name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input label="Currency symbol" value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} />
          <Input label="Default tax rate (%)" type="number" value={tax} onChange={(e) => setTax(e.target.value)} />
          <Select label="Billing round-off" value={roundOff} onChange={(e) => setRoundOff(e.target.value)}>
            <option value="1">1 min (exact)</option>
            <option value="5">5 min</option>
            <option value="10">10 min</option>
            <option value="15">15 min</option>
            <option value="30">30 min</option>
          </Select>
        </div>
        <p className="text-xs text-muted -mt-3">Sessions are billed by rounding up to the nearest {roundOff} min. Stopping at 20 sec with 15-min = 15 min charge.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Prebook deposit %" value={depositPct} onChange={(e) => setDepositPct(e.target.value)}>
            <option value="10">10% — light</option>
            <option value="20">20%</option>
            <option value="30">30% — standard</option>
            <option value="50">50%</option>
            <option value="100">100% — full prepay</option>
          </Select>
          <div className="flex flex-col justify-center rounded-xl border border-hairline bg-panel2/50 px-3 py-2">
            <p className="text-xs font-medium text-ink">Deposit {depositPct}% of rent is due at prebook.</p>
            <p className="text-xs text-muted">Editable % — customers see this on your prebook link.</p>
          </div>
        </div>

        {/* Rates */}
        <div>
          <span className="mb-2 block text-sm font-medium text-muted">Hourly rates & happy hour</span>
          <div className="rounded-xl border border-hairline bg-panel2/50 p-3">
            <div className="mb-2 grid grid-cols-[72px_1fr_1fr] gap-2 px-1 text-[10px] font-bold uppercase tracking-widest text-muted/60">
              <span>Type</span><span>Rate/hr</span><span>Happy hr</span>
            </div>
            <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
              {STATION_TYPES.map((t) => (
                <div key={t} className="grid grid-cols-[72px_1fr_1fr] items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink">{t}</span>
                  <Input
                    type="number"
                    value={String(rates[t].pricePerHour)}
                    onChange={(e) => updateRate(t, { pricePerHour: Number(e.target.value) || 0 })}
                    mono
                    className="!px-2.5 !py-2 text-sm"
                  />
                  <Input
                    type="number"
                    placeholder="—"
                    value={rates[t].happyHourPrice ?? ""}
                    onChange={(e) => updateRate(t, { happyHourPrice: e.target.value ? Number(e.target.value) : null })}
                    mono
                    className="!px-2.5 !py-2 text-sm"
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input label="Happy hour start" type="time" value={rates.PC.happyHourStart} onChange={(e) => { const v = e.target.value; setRates((r) => { const n = { ...r }; STATION_TYPES.forEach((t) => (n[t] = { ...n[t], happyHourStart: v })); return n; }); }} />
              <Input label="Happy hour end" type="time" value={rates.PC.happyHourEnd} onChange={(e) => { const v = e.target.value; setRates((r) => { const n = { ...r }; STATION_TYPES.forEach((t) => (n[t] = { ...n[t], happyHourEnd: v })); return n; }); }} />
            </div>
          </div>
        </div>

        {/* Snack catalog */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-muted">Snack / extras menu</span>
            <Button size="sm" variant="outline" onClick={() => setSnacks((s) => [...s, { name: "New item", qty: 1, price: 0 }])}>
              <span className="text-base leading-none">+</span> Add
            </Button>
          </div>
          <div className="rounded-xl border border-hairline bg-panel2/50 p-3">
            <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
              {snacks.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">No extras yet — add your first snack.</p>
              ) : (
                snacks.map((s, i) => (
                  <div key={i} className="grid grid-cols-[1fr_84px_32px] items-center gap-2">
                    <input value={s.name} onChange={(e) => setSnacks((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Item name" className="min-w-0 rounded-lg border border-hairline bg-panel2 px-2.5 py-2 text-sm text-ink outline-none focus:border-free/50" />
                    <input type="number" value={s.price} onChange={(e) => setSnacks((p) => p.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) || 0 } : x)))} placeholder="Price" className="mono w-full rounded-lg border border-hairline bg-panel2 px-2.5 py-2 text-sm text-ink outline-none focus:border-free/50" />
                    <button onClick={() => setSnacks((p) => p.filter((_, j) => j !== i))} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-panel hover:text-danger"><X className="h-4 w-4" /></button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Business & payment details (shown on invoices) */}
        <div className="rounded-xl border border-hairline bg-panel2 p-4">
          <p className="mb-3 text-sm font-medium text-muted">Business & payment details <span className="text-muted/60">(shown on invoices)</span></p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@studio.com" />
            <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 ..." />
          </div>
          <div className="mt-3">
            <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Shop 4, Main Road, City" />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="UPI ID" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="studio@upi" />
            <Input label="PayPal" value={paypal} onChange={(e) => setPaypal(e.target.value)} placeholder="me@paypal" />
          </div>
          <div className="mt-3">
            <Input label="Beneficiary (account holder)" value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} placeholder={settings.studioName} />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Bank" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="HDFC Bank" />
            <Input label="A/C no." mono value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="IFSC" mono value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)} placeholder="HDFC0001234" />
            <Input label="SWIFT / BIC" mono value={swift} onChange={(e) => setSwift(e.target.value)} placeholder="for international wire" />
          </div>
          <div className="mt-3">
            <Input label="Payment terms" value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Due on receipt / Net 7" />
          </div>
        </div>

        <div className="rounded-xl border border-hairline bg-panel2 p-4">
          <p className="mb-2 text-sm font-medium text-muted">Data management</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onSeed}>Load demo data</Button>
            <Button variant="danger" size="sm" onClick={() => { if (confirm("Delete all data? This cannot be undone.")) onClear(); }}>Clear all data</Button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onSave({ studioName: name, currency, taxRate: Number(tax) || 0, logo, rates, snacks, businessEmail: email, businessPhone: phone, businessAddress: address, upiId, bankName, bankAccount, bankIfsc, swift, beneficiary, paypal, paymentTerms: terms, billingRoundOffMinutes: Number(roundOff) || 15, prebookDepositPercent: Number(depositPct) || 30 } as Settings); onClose(); }}>Save changes</Button>
        </div>
      </div>
    </Modal>
  );
}
