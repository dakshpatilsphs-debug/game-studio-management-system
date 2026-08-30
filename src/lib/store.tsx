import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "./auth";
import { finalizeSessionCost, formatDuration, uid } from "./format";
import type {
  Station,
  GameSession,
  Expense,
  Bill,
  Customer,
  Settings,
  StationStatus,
  StationType,
  RateConfig,
  ExtraItem,
  PaymentMethod,
  Prebook,
} from "./types";

type Mode = "cloud" | "local";

export const DEFAULT_RATES: Record<StationType, RateConfig> = {
  PC: { pricePerHour: 60, happyHourPrice: 40, happyHourStart: "12:00", happyHourEnd: "16:00" },
  PS5: { pricePerHour: 100, happyHourPrice: 70, happyHourStart: "12:00", happyHourEnd: "16:00" },
  PS4: { pricePerHour: 50, happyHourPrice: 35, happyHourStart: "12:00", happyHourEnd: "16:00" },
  VR: { pricePerHour: 180, happyHourPrice: null, happyHourStart: "12:00", happyHourEnd: "16:00" },
  "Nintendo Switch": { pricePerHour: 50, happyHourPrice: null, happyHourStart: "12:00", happyHourEnd: "16:00" },
  Racing: { pricePerHour: 250, happyHourPrice: null, happyHourStart: "12:00", happyHourEnd: "16:00" },
};

export const DEFAULT_SNACKS: ExtraItem[] = [
  { name: "Soft Drink", qty: 1, price: 30 },
  { name: "Chips", qty: 1, price: 25 },
  { name: "Water Bottle", qty: 1, price: 20 },
  { name: "Energy Drink", qty: 1, price: 60 },
  { name: "Maggi / Noodles", qty: 1, price: 50 },
];

/**
 * Firestore rejects `undefined` field values with an error. This recursively
 * strips undefined keys (and undefined inside arrays/objects) so every write
 * is safe. Without it, writes silently fail and data never reaches Firestore.
 */
export function clean<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(clean) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const k in obj) {
    const v = (obj as Record<string, unknown>)[k];
    if (v === undefined) continue;
    out[k] = typeof v === "object" && v !== null ? clean(v) : v;
  }
  return out as T;
}

interface DataValue {
  ready: boolean;
  mode: Mode;
  stations: Station[];
  sessions: GameSession[];
  expenses: Expense[];
  bills: Bill[];
  customers: Customer[];
  prebooks: Prebook[];
  settings: Settings;
  setSettings: (s: Partial<Settings>) => void;
  getRate: (type: StationType) => RateConfig;
  isHappyHour: (type: StationType, time?: number) => boolean;
  addStation: (s: Omit<Station, "id">) => void;
  updateStation: (id: string, patch: Partial<Station>) => void;
  deleteStation: (id: string) => void;
  startSession: (s: Omit<GameSession, "id" | "status" | "totalCost" | "endTime">) => void;
  endSession: (id: string, opts?: { extras?: ExtraItem[]; paymentMethod?: PaymentMethod }) => void;
  manualSession: (s: Omit<GameSession, "id">) => void;
  deleteSession: (id: string) => void;
  addExpense: (e: Omit<Expense, "id">) => void;
  updateExpense: (id: string, patch: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  addBill: (b: Omit<Bill, "id">) => void;
  updateBill: (id: string, patch: Partial<Bill>) => void;
  deleteBill: (id: string) => void;
  addCustomer: (c: Omit<Customer, "id" | "totalVisits" | "createdAt">) => string;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  addPrebook: (p: Omit<Prebook, "id" | "createdAt">) => Promise<string>;
  addPrebookPublic: (studioId: string, p: Omit<Prebook, "id" | "createdAt" | "studioId">) => Promise<boolean>;
  updatePrebook: (id: string, patch: Partial<Prebook>) => void;
  deletePrebook: (id: string) => void;
  convertPrebook: (id: string) => void;
  seedDemoData: () => void;
  clearAllData: () => void;
}

const DataCtx = createContext<DataValue | null>(null);

const DEFAULT_SETTINGS: Settings = {
  studioName: "Gaming Lounge",
  currency: "₹",
  taxRate: 0,
  rates: DEFAULT_RATES,
  snacks: DEFAULT_SNACKS,
  billingRoundOffMinutes: 15,
  prebookDepositPercent: 30,
};

interface Bucket {
  stations: Station[];
  sessions: GameSession[];
  expenses: Expense[];
  bills: Bill[];
  customers: Customer[];
  prebooks: Prebook[];
}
const EMPTY_BUCKET: Bucket = { stations: [], sessions: [], expenses: [], bills: [], customers: [], prebooks: [] };

function mergeSettings(loaded: Partial<Settings>): Settings {
  const ro = (loaded as any).billingRoundOffMinutes;
  const pp = (loaded as any).prebookDepositPercent;
  return {
    ...DEFAULT_SETTINGS,
    ...loaded,
    billingRoundOffMinutes: typeof ro === "number" && ro >= 1 ? ro : DEFAULT_SETTINGS.billingRoundOffMinutes,
    prebookDepositPercent: typeof pp === "number" && pp >= 0 && pp <= 100 ? pp : DEFAULT_SETTINGS.prebookDepositPercent,
    rates: { ...DEFAULT_RATES, ...(loaded.rates || {}) },
    snacks: loaded.snacks && loaded.snacks.length ? loaded.snacks : DEFAULT_SNACKS,
  };
}

export function getPrebookLink(uid: string): string {
  const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
  return `${base}?prebook=${uid}`;
}

function dataKey(bucket: string) {
  return `gsm_${bucket}_data_v1`;
}
function settingsKey(bucket: string) {
  return `gsm_${bucket}_settings_v1`;
}
const GUEST_INIT_KEY = "gsm_guest_init_v1";

function loadBucket(bucket: string): Bucket {
  try {
    const raw = localStorage.getItem(dataKey(bucket));
    if (raw) {
      const p = JSON.parse(raw);
      return {
        stations: p.stations || [],
        sessions: p.sessions || [],
        expenses: p.expenses || [],
        bills: p.bills || [],
        customers: p.customers || [],
        prebooks: p.prebooks || [],
      };
    }
  } catch {
    /* ignore */
  }
  return { ...EMPTY_BUCKET };
}
function saveBucket(bucket: string, data: Bucket) {
  try {
    localStorage.setItem(dataKey(bucket), JSON.stringify(data));
  } catch {
    /* ignore */
  }
}
function loadBucketSettings(bucket: string): Settings {
  try {
    const raw = localStorage.getItem(settingsKey(bucket));
    if (raw) return mergeSettings(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, guest } = useAuth();
  const userKey = guest ? "guest" : user?.uid || null;
  const bucketRef = useRef<string>("guest");
  const cloudRef = useRef<boolean>(false);

  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("local");
  const [stations, setStations] = useState<Station[]>([]);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [prebooks, setPrebooks] = useState<Prebook[]>([]);
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (userKey === null) return;
    setStations([]); setSessions([]); setExpenses([]); setBills([]); setCustomers([]); setPrebooks([]);
    setReady(false);

    if (guest) {
      bucketRef.current = "guest";
      cloudRef.current = false;
      setMode("local");
      const b = loadBucket("guest");
      setStations(b.stations); setSessions(b.sessions); setExpenses(b.expenses);
      setBills(b.bills); setCustomers(b.customers); setPrebooks(b.prebooks || []);
      setSettingsState(loadBucketSettings("guest"));
      setReady(true);
      const inited = localStorage.getItem(GUEST_INIT_KEY);
      if (!inited && b.stations.length === 0) {
        localStorage.setItem(GUEST_INIT_KEY, "1");
        seedDemoIntoLocal("guest");
      }
      return;
    }

    if (!user) return;
    bucketRef.current = user.uid;
    cloudRef.current = true;
    setMode("cloud");
    setSettingsState(DEFAULT_SETTINGS);
    const unsubs: (() => void)[] = [];
    let fellBack = false;

    const subs: [string, Dispatch<SetStateAction<any[]>>][] = [
      ["stations", setStations], ["sessions", setSessions], ["expenses", setExpenses],
      ["bills", setBills], ["customers", setCustomers], ["prebooks", setPrebooks],
    ];
    subs.forEach(([name, setter]) => {
      try {
        const unsub = onSnapshot(
          collection(db, "users", user.uid, name),
          (snap) => {
            setter(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any);
            setReady(true);
          },
          () => {
            if (!fellBack) {
              fellBack = true;
              cloudRef.current = false;
              setMode("local");
              const b = loadBucket(user.uid);
              setStations(b.stations); setSessions(b.sessions); setExpenses(b.expenses);
              setBills(b.bills); setCustomers(b.customers); setPrebooks(b.prebooks || []);
              setSettingsState(loadBucketSettings(user.uid));
              setReady(true);
            }
          }
        );
        unsubs.push(unsub);
      } catch {
        cloudRef.current = false;
      }
    });

    getDoc(doc(db, "users", user.uid, "settings", "main"))
      .then((d) => { if (d.exists()) setSettingsState(mergeSettings(d.data() as Settings)); })
      .catch(() => {});

    const readyTimer = setTimeout(() => setReady(true), 1800);
    return () => { clearTimeout(readyTimer); unsubs.forEach((u) => u()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userKey]);

  useEffect(() => {
    if (mode === "local" && ready) {
      saveBucket(bucketRef.current, { stations, sessions, expenses, bills, customers, prebooks });
    }
  }, [mode, ready, stations, sessions, expenses, bills, customers, prebooks]);

  const C = (name: string) => collection(db, "users", user!.uid, name);
  const D = (name: string, id: string) => doc(db, "users", user!.uid, name, id);
  const settingsRef = () => doc(db, "users", user!.uid, "settings", "main");
  const cloud = cloudRef.current && !!user;

  function getRate(type: StationType): RateConfig {
    return settings.rates[type] || DEFAULT_RATES[type];
  }
  function isHappyHour(type: StationType, time = Date.now()): boolean {
    const r = getRate(type);
    if (!r.happyHourPrice) return false;
    return inWindow(time, r.happyHourStart, r.happyHourEnd);
  }

  // ============ mutations ============
  function setSettings(patch: Partial<Settings>) {
    const next = mergeSettings({ ...settings, ...patch });
    setSettingsState(next);
    if (!cloud) localStorage.setItem(settingsKey(bucketRef.current), JSON.stringify(next));
    if (cloud) setDoc(settingsRef(), clean(next), { merge: true }).catch(() => {});
  }

  async function addStation(s: Omit<Station, "id">) {
    if (cloud) { try { await addDoc(C("stations"), clean(s)); return; } catch {} }
    setStations((p) => [...p, { ...s, id: uid() }]);
  }
  async function updateStation(id: string, patch: Partial<Station>) {
    if (cloud) { try { await updateDoc(D("stations", id), clean(patch) as any); } catch {} }
    setStations((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  async function deleteStation(id: string) {
    if (cloud) { try { await deleteDoc(D("stations", id)); } catch {} }
    setStations((p) => p.filter((x) => x.id !== id));
  }

  async function startSession(s: Omit<GameSession, "id" | "status" | "totalCost" | "endTime">) {
    const session: GameSession = { ...s, id: uid(), status: "active", endTime: null, totalCost: 0 };
    if (cloud) {
      try {
        const { id, ...rest } = session;
        await addDoc(C("sessions"), clean(rest));
        await updateStation(s.stationId, { status: "rented" });
        if (s.customerId) {
          const c = customers.find((x) => x.id === s.customerId);
          if (c) updateCustomer(s.customerId, { totalVisits: c.totalVisits + 1 });
        }
        return;
      } catch {}
    }
    setSessions((p) => [...p, session]);
    setStations((p) => p.map((x) => (x.id === s.stationId ? { ...x, status: "rented" } : x)));
    if (s.customerId) setCustomers((p) => p.map((c) => (c.id === s.customerId ? { ...c, totalVisits: c.totalVisits + 1 } : c)));
  }

  async function endSession(id: string, opts?: { extras?: ExtraItem[]; paymentMethod?: PaymentMethod }) {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;
    const endTime = Date.now();
    const roundOff = settings.billingRoundOffMinutes ?? 15;
    const baseAmount = finalizeSessionCost(session.startTime, endTime, session.hourlyRate, roundOff);
    const extras = opts?.extras || [];
    const extrasAmount = extras.reduce((s, e) => s + e.qty * e.price, 0);
    const totalCost = Math.round((baseAmount + extrasAmount) * 100) / 100;
    const patch: Partial<GameSession> = { status: "completed", endTime, baseAmount, extrasAmount, extras, paymentMethod: opts?.paymentMethod || null, totalCost };

    // Create a receipt in the Bills collection so dashboard billing shows in Billing
    const receipt: Omit<Bill, "id"> = {
      billNumber: `RCPT-${id.slice(-6).toUpperCase()}`,
      customerName: session.customerName,
      items: [
        { description: `${session.stationName} (${session.type}) • ${formatDuration(session.startTime, endTime)}`, qty: 1, price: baseAmount },
        ...extras.map((e) => ({ description: e.name, qty: e.qty, price: e.price })),
      ],
      subtotal: totalCost,
      taxRate: 0,
      taxAmount: 0,
      discount: 0,
      total: totalCost,
      paymentMethod: opts?.paymentMethod || "Cash",
      createdAt: endTime,
      fromSession: true,
      sessionId: id,
    };

    if (cloud) {
      try {
        await updateDoc(D("sessions", id), clean(patch) as any);
        await updateStation(session.stationId, { status: "available" });
        addBill(receipt);
        return;
      } catch {}
    }
    setSessions((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    setStations((p) => p.map((x) => (x.id === session.stationId ? { ...x, status: "available" } : x)));
    addBill(receipt);
  }

  async function manualSession(s: Omit<GameSession, "id">) {
    if (cloud) { try { await addDoc(C("sessions"), clean(s)); return; } catch {} }
    setSessions((p) => [...p, { ...s, id: uid() }]);
  }
  async function deleteSession(id: string) {
    const session = sessions.find((s) => s.id === id);
    if (cloud) {
      try {
        await deleteDoc(D("sessions", id));
        if (session?.status === "active") await updateStation(session.stationId, { status: "available" });
        return;
      } catch {}
    }
    setSessions((p) => p.filter((x) => x.id !== id));
    if (session?.status === "active") setStations((prev) => prev.map((x) => (x.id === session.stationId ? { ...x, status: "available" as StationStatus } : x)));
  }

  async function addExpense(e: Omit<Expense, "id">) {
    if (cloud) { try { await addDoc(C("expenses"), clean(e)); return; } catch {} }
    setExpenses((p) => [...p, { ...e, id: uid() }]);
  }
  async function updateExpense(id: string, patch: Partial<Expense>) {
    if (cloud) { try { await updateDoc(D("expenses", id), clean(patch) as any); } catch {} }
    setExpenses((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  async function deleteExpense(id: string) {
    if (cloud) { try { await deleteDoc(D("expenses", id)); } catch {} }
    setExpenses((p) => p.filter((x) => x.id !== id));
  }

  async function addBill(b: Omit<Bill, "id">) {
    if (cloud) { try { await addDoc(C("bills"), clean(b)); return; } catch {} }
    setBills((p) => [...p, { ...b, id: uid() }]);
  }
  async function updateBill(id: string, patch: Partial<Bill>) {
    if (cloud) { try { await updateDoc(D("bills", id), clean(patch) as any); } catch {} }
    setBills((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  async function deleteBill(id: string) {
    if (cloud) { try { await deleteDoc(D("bills", id)); } catch {} }
    setBills((p) => p.filter((x) => x.id !== id));
  }

  function addCustomer(c: Omit<Customer, "id" | "totalVisits" | "createdAt">): string {
    const newId = uid();
    const customer: Customer = { ...c, id: newId, totalVisits: 0, createdAt: Date.now() };
    const { id, ...rest } = customer;
    if (cloud) setDoc(D("customers", newId), clean(rest)).catch(() => {});
    setCustomers((p) => [...p, customer]);
    return newId;
  }
  async function updateCustomer(id: string, patch: Partial<Customer>) {
    if (cloud) { try { await updateDoc(D("customers", id), clean(patch) as any); } catch {} }
    setCustomers((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  async function deleteCustomer(id: string) {
    if (cloud) { try { await deleteDoc(D("customers", id)); } catch {} }
    setCustomers((p) => p.filter((x) => x.id !== id));
  }

  async function addPrebook(p: Omit<Prebook, "id" | "createdAt">): Promise<string> {
    const payload = { ...p, createdAt: Date.now() } as Omit<Prebook, "id"> & { createdAt: number };
    if (cloud) {
      try {
        const ref = await addDoc(C("prebooks"), clean(payload));
        return ref.id;
      } catch {}
    }
    const id = uid();
    setPrebooks((prev) => [...prev, { ...payload, id } as Prebook]);
    return id;
  }

  async function addPrebookPublic(studioId: string, p: Omit<Prebook, "id" | "createdAt" | "studioId">): Promise<boolean> {
    const payload = { ...p, studioId, createdAt: Date.now() } as Omit<Prebook, "id"> & { createdAt: number; studioId: string };
    // try cloud even without auth (public)
    try {
      await addDoc(collection(db, "users", studioId, "prebooks"), clean(payload));
      return true;
    } catch {}
    // fallback to local bucket for that studio
    try {
      const b = loadBucket(studioId);
      const id = uid();
      const nb = { ...payload, id } as Prebook;
      saveBucket(studioId, { ...b, prebooks: [...(b.prebooks || []), nb] });
      // if current user is viewing own link, also update local state if bucket matches current
      if (bucketRef.current === studioId) setPrebooks((prev) => [...prev, nb]);
      return true;
    } catch {
      return false;
    }
  }

  async function updatePrebook(id: string, patch: Partial<Prebook>) {
    if (cloud) { try { await updateDoc(D("prebooks", id), clean(patch) as any); } catch {} }
    setPrebooks((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  async function deletePrebook(id: string) {
    if (cloud) { try { await deleteDoc(D("prebooks", id)); } catch {} }
    setPrebooks((prev) => prev.filter((x) => x.id !== id));
  }

  async function convertPrebook(id: string) {
    const pb = prebooks.find((p) => p.id === id);
    if (!pb) return;
    // mark converted and create a session for immediate use? For now just status
    await updatePrebook(id, { status: "converted" as const });
    // optionally create a session if date is today
    // we keep it simple: owner can manually start session from prebook
  }

  function seedDemoIntoLocal(bucket: string) {
    const now = Date.now();
    const hr = 3600000;
    const min = 60000;
    const demoStations: Station[] = [
      { id: uid(), name: "PC-01", type: "PC", hourlyRate: 60, status: "available", specs: "RTX 4070 • i7 • 32GB" },
      { id: uid(), name: "PC-02", type: "PC", hourlyRate: 60, status: "rented", specs: "RTX 4070 • i7 • 32GB" },
      { id: uid(), name: "PC-03", type: "PC", hourlyRate: 90, status: "available", specs: "RTX 4080 • i9 • 32GB" },
      { id: uid(), name: "PC-04", type: "PC", hourlyRate: 90, status: "maintenance", specs: "RTX 4080 • i9 • 32GB" },
      { id: uid(), name: "PS5-01", type: "PS5", hourlyRate: 100, status: "rented" },
      { id: uid(), name: "PS5-02", type: "PS5", hourlyRate: 100, status: "available" },
      { id: uid(), name: "PS4-01", type: "PS4", hourlyRate: 50, status: "available" },
      { id: uid(), name: "VR-01", type: "VR", hourlyRate: 180, status: "available", specs: "Meta Quest 3" },
      { id: uid(), name: "Racing-01", type: "Racing", hourlyRate: 250, status: "available", specs: "Force Feedback Wheel" },
    ];
    const pick = (i: number) => demoStations[i];
    const c1 = uid(), c2 = uid(), c3 = uid();
    const demoCustomers: Customer[] = [
      { id: c1, name: "Arjun Mehta", phone: "98765 43210", prepaidBalance: 0, totalVisits: 4, createdAt: now - 20 * 24 * hr },
      { id: c2, name: "Sara Khan", phone: "91234 56789", prepaidBalance: 200, totalVisits: 2, createdAt: now - 12 * 24 * hr },
      { id: c3, name: "Rohit Verma", phone: "99887 76655", prepaidBalance: 0, totalVisits: 6, createdAt: now - 30 * 24 * hr },
    ];
    const demoSessions: GameSession[] = [
      { id: uid(), customerName: "Vivaan Rao", stationId: pick(1).id, stationName: pick(1).name, type: "PC", startTime: now - 64 * min, endTime: null, hourlyRate: 60, status: "active", totalCost: 0 },
      { id: uid(), customerName: "Sara Khan", customerId: c2, customerPhone: demoCustomers[1].phone, stationId: pick(4).id, stationName: pick(4).name, type: "PS5", startTime: now - 23 * min, endTime: null, hourlyRate: 100, status: "active", totalCost: 0 },
      { id: uid(), customerName: "Arjun Mehta", customerId: c1, stationId: pick(0).id, stationName: pick(0).name, type: "PC", startTime: now - 5 * hr, endTime: now - 3 * hr, hourlyRate: 60, status: "completed", baseAmount: 120, extrasAmount: 30, extras: [{ name: "Soft Drink", qty: 1, price: 30 }], paymentMethod: "UPI", totalCost: 150 },
      { id: uid(), customerName: "Lena Park", stationId: pick(4).id, stationName: pick(4).name, type: "PS5", startTime: now - 7 * hr, endTime: now - 5 * hr, hourlyRate: 100, status: "completed", baseAmount: 200, extrasAmount: 0, paymentMethod: "Cash", totalCost: 200 },
      { id: uid(), customerName: "Rohit Verma", customerId: c3, stationId: pick(8).id, stationName: pick(8).name, type: "Racing", startTime: now - 26 * hr, endTime: now - 24 * hr, hourlyRate: 250, status: "completed", baseAmount: 500, extrasAmount: 0, paymentMethod: "Card", totalCost: 500 },
      { id: uid(), customerName: "Nina Gomez", stationId: pick(0).id, stationName: pick(0).name, type: "PC", startTime: now - 26 * hr, endTime: now - 24 * hr, hourlyRate: 60, status: "completed", baseAmount: 120, extrasAmount: 25, extras: [{ name: "Chips", qty: 1, price: 25 }], paymentMethod: "Cash", totalCost: 145 },
      { id: uid(), customerName: "Jay Walker", stationId: pick(2).id, stationName: pick(2).name, type: "PC", startTime: now - 50 * hr, endTime: now - 48 * hr, hourlyRate: 90, status: "completed", baseAmount: 180, extrasAmount: 0, paymentMethod: "UPI", totalCost: 180 },
      { id: uid(), customerName: "Tara Singh", stationId: pick(5).id, stationName: pick(5).name, type: "PS5", startTime: now - 49 * hr, endTime: now - 47 * hr, hourlyRate: 100, status: "completed", baseAmount: 200, extrasAmount: 0, paymentMethod: "Cash", totalCost: 200 },
    ];
    const demoExpenses: Expense[] = [
      { id: uid(), description: "Monthly shop rent", category: "Rent", amount: 25000, date: now - 10 * 24 * hr },
      { id: uid(), description: "Electricity bill", category: "Electricity", amount: 6200, date: now - 3 * 24 * hr },
      { id: uid(), description: "New gaming mice x4", category: "Equipment", amount: 4200, date: now - 5 * 24 * hr },
      { id: uid(), description: "Internet upgrade (200 Mbps)", category: "Internet", amount: 1999, date: now - 2 * 24 * hr },
      { id: uid(), description: "Snacks & drinks restock", category: "Snacks & Drinks", amount: 3200, date: now - 1 * 24 * hr },
      { id: uid(), description: "PS5 controller repair", category: "Maintenance", amount: 1500, date: now - 6 * 24 * hr },
    ];
    const demoBills: Bill[] = [
      { id: uid(), billNumber: "INV-1001", customerName: "Walk-in", items: [{ description: "Snacks only", qty: 1, price: 55 }], subtotal: 55, taxRate: 0, taxAmount: 0, discount: 0, total: 55, paymentMethod: "Cash", createdAt: now - 2 * hr },
      { id: uid(), billNumber: "INV-1002", customerName: "Office party", items: [{ description: "PS5 2h + snacks", qty: 1, price: 260 }], subtotal: 260, taxRate: 0, taxAmount: 0, discount: 0, total: 260, paymentMethod: "UPI / Transfer", createdAt: now - 5 * hr },
    ];
    const tomorrow = now + 24 * hr;
    const demoPrebooks: Prebook[] = [
      {
        id: uid(),
        customerName: "Aarav Singh",
        customerPhone: "98765 12345",
        stationId: demoStations[0].id,
        stationName: demoStations[0].name,
        type: "PC",
        date: tomorrow - (tomorrow % 86400000),
        startTime: tomorrow + 10 * 60 * 60000, // tomorrow 10:00
        endTime: tomorrow + 12 * 60 * 60000, // 12:00
        durationMinutes: 120,
        hourlyRate: 60,
        totalRent: 120,
        depositPercent: 30,
        depositAmount: 36,
        remainingAmount: 84,
        status: "pending",
        paymentMethod: "UPI",
        createdAt: now - hr,
        studioId: bucket,
      },
      {
        id: uid(),
        customerName: "Priya Nair",
        customerPhone: "91234 00011",
        stationId: demoStations[4].id,
        stationName: demoStations[4].name,
        type: "PS5",
        date: tomorrow + 86400000 - ((tomorrow + 86400000) % 86400000),
        startTime: tomorrow + 86400000 + 14 * 60 * 60000,
        endTime: tomorrow + 86400000 + 16 * 60 * 60000,
        durationMinutes: 120,
        hourlyRate: 100,
        totalRent: 200,
        depositPercent: 30,
        depositAmount: 60,
        remainingAmount: 140,
        status: "confirmed",
        paymentMethod: "Card",
        createdAt: now - 2 * hr,
        studioId: bucket,
      },
    ];
    saveBucket(bucket, { stations: demoStations, sessions: demoSessions, expenses: demoExpenses, bills: demoBills, customers: demoCustomers, prebooks: demoPrebooks });
    setStations(demoStations); setSessions(demoSessions); setExpenses(demoExpenses);
    setBills(demoBills); setCustomers(demoCustomers); setPrebooks(demoPrebooks);
  }

  function seedDemoData() {
    if (cloud) {
      const now = Date.now();
      const hr = 3600000;
      const demoStations: Station[] = [
        { id: uid(), name: "PC-01", type: "PC", hourlyRate: 60, status: "available", specs: "RTX 4070 • i7 • 32GB" },
        { id: uid(), name: "PS5-01", type: "PS5", hourlyRate: 100, status: "available" },
        { id: uid(), name: "VR-01", type: "VR", hourlyRate: 180, status: "available", specs: "Meta Quest 3" },
      ];
      demoStations.forEach((s) => addStation(s));
      manualSession({ customerName: "Demo User", stationId: demoStations[0].id, stationName: demoStations[0].name, type: "PC", startTime: now - 2 * hr, endTime: now - hr, hourlyRate: 60, status: "completed", totalCost: 120 });
      return;
    }
    seedDemoIntoLocal(bucketRef.current);
  }

  function clearAllData() {
    if (cloud) {
      const clear = (arr: { id: string }[], col: string) => arr.forEach((item) => { deleteDoc(D(col, item.id)).catch(() => {}); });
      clear(stations, "stations"); clear(sessions, "sessions"); clear(expenses, "expenses"); clear(bills, "bills"); clear(customers, "customers"); clear(prebooks, "prebooks");
      if (user) { deleteDoc(settingsRef()).catch(() => {}); }
    }
    localStorage.setItem(GUEST_INIT_KEY, "1");
    saveBucket(bucketRef.current, { ...EMPTY_BUCKET });
    localStorage.removeItem(settingsKey(bucketRef.current));
    setStations([]); setSessions([]); setExpenses([]); setBills([]); setCustomers([]); setPrebooks([]);
    setSettingsState(DEFAULT_SETTINGS);
  }

  const value: DataValue = {
    ready, mode, stations, sessions, expenses, bills, customers, prebooks, settings,
    setSettings, getRate, isHappyHour,
    addStation, updateStation, deleteStation,
    startSession, endSession, manualSession, deleteSession,
    addExpense, updateExpense, deleteExpense,
    addBill, updateBill, deleteBill,
    addCustomer, updateCustomer, deleteCustomer,
    addPrebook, addPrebookPublic, updatePrebook, deletePrebook, convertPrebook,
    seedDemoData, clearAllData,
  };

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

export function useData() {
  const ctx = useContext(DataCtx);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function inWindow(time: number, start: string, end: string): boolean {
  const d = new Date(time);
  const nowMin = d.getHours() * 60 + d.getMinutes();
  return nowMin >= toMinutes(start) && nowMin < toMinutes(end);
}
