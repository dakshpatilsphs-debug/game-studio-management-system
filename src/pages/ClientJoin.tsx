import { useEffect, useRef, useState } from "react";
import { doc, setDoc, updateDoc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { clean, parseClientJoinUrl } from "../lib/store";
import { Monitor, Wifi, Lock, Unlock, MessageSquare } from "lucide-react";

function getPCName() {
  try {
    const saved = localStorage.getItem("gsm_client_pcname");
    if (saved) return saved;
  } catch {}
  return "";
}

function getClientId(): string {
  try {
    let id = localStorage.getItem("gsm_client_id");
    if (!id) {
      id = `web-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      localStorage.setItem("gsm_client_id", id);
    }
    return id;
  } catch {
    return `web-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }
}

/**
 * ClientJoin — opened on each gaming PC via the ONE admin link:
 *   ?client=STUDIO_UID&code=PAIRINGCODE
 * No EXE required. Registers heartbeat into users/{studioId}/clients,
 * shows live timer, admin messages, and fullscreen lock when time expires.
 * Same collection the EXE uses, so EXE + browser PCs mix in one dashboard.
 */
export default function ClientJoin() {
  const parsed = parseClientJoinUrl();
  const [studioId, setStudioId] = useState(parsed?.studioId || "");
  const [code, setCode] = useState(parsed?.code || "");
  const [pcName, setPcName] = useState(getPCName() || "");
  const [paired, setPaired] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [, tick] = useState(0);
  const clientId = useRef(getClientId());

  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // auto-pair if link has both params
  useEffect(() => {
    if (parsed?.studioId && parsed?.code && pcName) {
      pair(parsed.studioId, parsed.code, pcName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pair(sid: string, pairingCode: string, name: string) {
    setError("");
    sid = sid.trim();
    pairingCode = pairingCode.trim().toUpperCase();
    name = name.trim() || `PC-${clientId.current.slice(-4)}`;
    if (!sid) {
      setError("Missing studio link. Ask admin for the PC connect link (PC Clients page).");
      return;
    }
    // verify pairing code against owner's settings (lenient in demo/guest mode)
    try {
      const snap = await getDoc(doc(db, "users", sid, "settings", "main"));
      if (snap.exists()) {
        const s: any = snap.data();
        if (s.clientPairingCode && pairingCode && s.clientPairingCode.toUpperCase() !== pairingCode) {
          setError(`Pairing code mismatch. Admin code is ${s.clientPairingCode}.`);
          return;
        }
        if (!pairingCode) pairingCode = (s.clientPairingCode || "").toUpperCase();
      }
    } catch {
      /* offline / guest bucket — allow, will sync via localStorage bucket if same machine */
    }
    try {
      localStorage.setItem("gsm_client_pcname", name);
    } catch {}
    const payload = clean({
      id: clientId.current,
      pcName: name,
      ip: "web",
      status: "ready",
      lastSeen: Date.now(),
      pairingCode,
      studioId: sid,
      version: "web-1.0",
      specs: navigator.userAgent.slice(0, 80),
      pairedAt: Date.now(),
    });
    try {
      await setDoc(doc(db, "users", sid, "clients", clientId.current), payload as any, { merge: true });
    } catch (e) {
      // Firestore rules may block unauthenticated web joins on some projects.
      // Fall back: store join intent locally so admin on SAME machine (guest demo) still sees it.
      try {
        const key = `gsm_${sid}_data_v1`;
        const raw = localStorage.getItem(key);
        const b = raw ? JSON.parse(raw) : { stations: [], sessions: [], expenses: [], bills: [], customers: [], prebooks: [], clients: [] };
        b.clients = [...(b.clients || []).filter((c: any) => c.id !== clientId.current), { ...payload }];
        localStorage.setItem(key, JSON.stringify(b));
      } catch {}
    }
    setStudioId(sid);
    setCode(pairingCode);
    setPcName(name);
    setPaired(true);
  }

  // heartbeat + live subscription
  useEffect(() => {
    if (!paired || !studioId) return;
    const ref = doc(db, "users", studioId, "clients", clientId.current);
    const hb = setInterval(() => {
      updateDoc(ref, { lastSeen: Date.now() } as any).catch(() => {});
    }, 30000);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() };
          setLive(data);
          // ack one-shot commands
          const cmd = (data as any).command;
          if (cmd === "restart" || cmd === "shutdown" || cmd === "lock") {
            setMsg(`Admin command: ${cmd}. Contact counter.`);
            updateDoc(ref, { command: null } as any).catch(() => {});
          }
        }
      },
      () => {}
    );
    return () => {
      clearInterval(hb);
      unsub();
    };
  }, [paired, studioId]);

  const now = Date.now();
  const sessionEnd = live?.sessionEnd || 0;
  const lockUntil = live?.lockUntil || 0;
  const isLocked = live?.status === "locked" && lockUntil > now;
  const isBusy = live?.status === "busy" && sessionEnd > now;
  const isMaintenance = live?.status === "maintenance";
  const remainingSec = Math.max(0, Math.floor((sessionEnd - now) / 1000));
  const lockSec = Math.max(0, Math.floor((lockUntil - now) / 1000));

  async function setStatus(status: string) {
    if (!paired) return;
    try {
      await updateDoc(doc(db, "users", studioId, "clients", clientId.current), { status, lastSeen: Date.now() } as any);
    } catch {}
  }

  // Fullscreen lock overlay — mirrors EXE kiosk lock
  if (paired && isLocked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-canvas p-6 text-center">
        <div className="w-full max-w-md rounded-2xl border border-warn/40 bg-panel p-8">
          <Lock className="mx-auto h-10 w-10 text-warn" />
          <h1 className="mt-3 font-display text-2xl font-bold text-ink">Time's Up!</h1>
          <p className="mt-1 text-sm text-muted">
            {pcName} is locked for {Math.floor(lockSec / 60)}:{String(lockSec % 60).padStart(2, "0")}. Message sent to admin: “going to shut”.
          </p>
          <p className="mono mt-4 text-5xl font-bold text-warn">
            {Math.floor(lockSec / 60)}:{String(lockSec % 60).padStart(2, "0")}
          </p>
          <p className="mt-3 text-xs text-muted">Contact admin to increase time from PC Clients dashboard.</p>
          {live?.message && (
            <p className="mt-3 rounded-xl border border-hairline bg-panel2 p-3 text-sm text-ink">📢 {live.message}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-canvas p-6 text-ink">
      <div className="w-full max-w-md space-y-4">
        <div className="rounded-2xl border border-hairline bg-panel p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-free/15">
            <Monitor className="h-6 w-6 text-free" />
          </div>
          <h1 className="mt-2 font-display text-xl font-bold">GameLounge Client</h1>
          <p className="text-xs text-muted">Browser agent • same dashboard as EXE • WiFi/LAN via Firebase</p>
          <p className="mono mt-2 text-xs text-muted">
            <Wifi className="mr-1 inline h-3 w-3" /> {pcName || "unnamed PC"} • {clientId.current}
          </p>
        </div>

        {!paired ? (
          <div className="rounded-2xl border border-hairline bg-panel p-5">
            <h2 className="text-sm font-semibold">🔗 Connect this PC with admin link</h2>
            <p className="mt-1 text-xs text-muted">Admin → PC Clients → Copy “PC connect link” → open it here. Or paste UID + code:</p>
            <label className="mt-3 block text-xs font-medium text-muted">Studio UID / link (?client=…)</label>
            <input
              value={studioId}
              onChange={(e) => setStudioId(e.target.value)}
              placeholder="Paste link or UID"
              className="mt-1 w-full rounded-xl border border-hairline bg-panel2 px-3 py-2.5 text-sm outline-none focus:border-free/50"
            />
            <label className="mt-3 block text-xs font-medium text-muted">Pairing code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. LUX4A9"
              maxLength={12}
              className="mono mt-1 w-full rounded-xl border border-hairline bg-panel2 px-3 py-2.5 text-sm font-bold tracking-widest outline-none focus:border-free/50"
            />
            <label className="mt-3 block text-xs font-medium text-muted">This PC name</label>
            <input
              value={pcName}
              onChange={(e) => setPcName(e.target.value)}
              placeholder="e.g. PC-05"
              className="mt-1 w-full rounded-xl border border-hairline bg-panel2 px-3 py-2.5 text-sm outline-none focus:border-free/50"
            />
            {error && <p className="mt-2 text-xs text-danger">{error}</p>}
            <button
              onClick={() => {
                let sid = studioId;
                try {
                  if (sid.includes("client=")) sid = new URL(sid).searchParams.get("client") || sid;
                } catch {}
                pair(sid, code, pcName);
              }}
              className="mt-4 w-full rounded-xl bg-free py-2.5 text-sm font-bold text-canvas hover:brightness-110"
            >
              Pair & Connect
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-hairline bg-panel p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Status: {live?.status || "ready"}</h2>
              <span className="rounded-full border border-hairline px-2.5 py-1 text-xs font-bold text-free">● connected</span>
            </div>
            {isMaintenance ? (
              <p className="mt-3 text-sm font-medium text-warn">Maintenance — not bookable. Contact admin.</p>
            ) : isBusy ? (
              <div className="mt-3 text-center">
                <p className="mono text-5xl font-bold text-occupied">
                  {Math.floor(remainingSec / 60)}:{String(remainingSec % 60).padStart(2, "0")}
                </p>
                <p className="mt-1 text-xs text-muted">until auto-lock • ends {new Date(sessionEnd).toLocaleTimeString()}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm font-medium text-free">Ready • waiting for admin to start session</p>
            )}
            {live?.message && (
              <p className="mt-3 flex items-start gap-2 rounded-xl border border-hairline bg-panel2 p-3 text-sm">
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-free" /> {live.message}
              </p>
            )}
            {msg && <p className="mt-2 text-xs text-warn">{msg}</p>}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setStatus("ready")} className="rounded-xl border border-hairline py-2 text-xs font-semibold hover:border-free/50">
                <Unlock className="mr-1 inline h-3 w-3" /> Set Ready
              </button>
              <button onClick={() => setStatus("maintenance")} className="rounded-xl border border-hairline py-2 text-xs font-semibold hover:border-warn/50">
                Maintenance
              </button>
            </div>
            <button
              onClick={() => {
                setPaired(false);
                setLive(null);
              }}
              className="mt-2 w-full rounded-xl border border-hairline py-2 text-xs text-muted hover:text-ink"
            >
              Unpair / switch studio
            </button>
          </div>
        )}

        <p className="text-center text-[11px] text-muted">Keep this tab open (kiosk/F11). Heartbeat every 30s • offline after 90s in admin.</p>
      </div>
    </div>
  );
}
