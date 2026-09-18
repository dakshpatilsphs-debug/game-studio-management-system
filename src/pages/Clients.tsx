import { useEffect, useState } from "react";
import { Monitor, Wifi, Shield, Power, Wrench, Unlock, Plus, Trash2, Timer, AppWindow, Link2, Copy, Check, Send, Lock } from "lucide-react";
import { useData, getClientJoinLink } from "../lib/store";
import { useAuth } from "../lib/auth";
import { Card, Button, Badge, SectionTitle, EmptyState, StatCard, Input, Select } from "../components/ui";
import { formatMoney } from "../lib/format";
import { useToast } from "../components/Toaster";

export default function Clients() {
  const { clients, stations, settings, updateClient, deleteClient, extendClientTime, startSession } = useData();
  const { user, guest } = useAuth();
  const { toast } = useToast();
  const [, tick] = useState(0);
  const [copied, setCopied] = useState(false);
  const [msgDraft, setMsgDraft] = useState<Record<string, string>>({});
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const ready = clients.filter((c) => c.status === "ready").length;
  const busy = clients.filter((c) => c.status === "busy").length;
  const locked = clients.filter((c) => c.status === "locked").length;
  const maint = clients.filter((c) => c.status === "maintenance").length;

  // offline if lastSeen > 90s
  const now = Date.now();
  const isOffline = (c: any) => now - c.lastSeen > 90_000;

  // ONE link that connects all PCs to THIS admin dashboard
  const studioId = guest ? "guest" : user?.uid || "guest";
  const joinLink = getClientJoinLink(studioId, settings.clientPairingCode);

  function copyLink() {
    try {
      navigator.clipboard.writeText(joinLink);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = joinLink;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    toast("PC connect link copied", "free");
    setTimeout(() => setCopied(false), 2000);
  }

  function sendMessage(id: string) {
    const text = (msgDraft[id] || "").trim();
    if (!text) return;
    updateClient(id, { message: text });
    setMsgDraft((p) => ({ ...p, [id]: "" }));
    toast("Message sent to PC", "free");
  }

  function startTimerOnClient(c: any, minutes: number) {
    // Admin remote: set busy + sessionEnd + linked station rented
    const sessionEnd = Date.now() + minutes * 60000;
    const cooldown = settings.lockCooldownMinutes ?? 10;
    updateClient(c.id, {
      status: "busy",
      sessionEnd,
      lockUntil: null,
      currentSessionId: `admin-${Date.now()}`,
      message: `Timer started: ${minutes} min. Auto-lock + ${cooldown} min cooldown after.`,
    });
    // also mark linked station as rented if mapped
    const station = c.stationId
      ? stations.find((s) => s.id === c.stationId)
      : stations.find((s) => s.name === c.pcName || s.name === c.pcName.replace("-PC", ""));
    if (station && station.status === "available") {
      try {
        startSession({
          customerName: `${c.pcName} (remote)`,
          stationId: station.id,
          stationName: station.name,
          type: station.type,
          startTime: Date.now(),
          hourlyRate: station.hourlyRate,
        });
      } catch {}
    }
    toast(`Timer ${minutes} min started on ${c.pcName}`, "free");
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Ready PCs" value={String(ready)} icon={<Monitor className="h-5 w-5" />} accent="free" delta={`${clients.length} total clients`} />
        <StatCard label="Busy (timer)" value={String(busy)} icon={<Timer className="h-5 w-5" />} accent="occupied" />
        <StatCard label="Locked (cooldown)" value={String(locked)} icon={<Shield className="h-5 w-5" />} accent="warn" delta={`${settings.lockCooldownMinutes ?? 10} min cooldown`} />
        <StatCard label="Maintenance" value={String(maint)} icon={<Wrench className="h-5 w-5" />} accent="danger" />
      </div>

      {/* ONE-LINK connection — the requested feature */}
      <Card className="border-free/25 p-5">
        <SectionTitle title="Connect all PCs with one link" subtitle="Open this link on every gaming PC — they all appear here" icon={<Link2 className="h-5 w-5" />} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={joinLink}
            readOnly
            onFocus={(e) => e.target.select()}
            className="mono flex-1 truncate rounded-xl border border-hairline bg-panel2 px-3.5 py-2.5 text-xs text-ink outline-none"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={copyLink}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied!" : "Copy link"}</Button>
            <Button size="sm" variant="outline" onClick={() => window.open(joinLink, "_blank")}>Test join</Button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-3">
          <p className="rounded-xl border border-hairline bg-panel2 p-3"><b className="text-ink">1. No EXE needed:</b> open link in Chrome on gaming PC → enter PC name → Pair & Connect. Keep tab open (F11 kiosk).</p>
          <p className="rounded-xl border border-hairline bg-panel2 p-3"><b className="text-ink">2. EXE option:</b> install <code className="font-mono text-ink">GameLounge-Client.exe</code> → paste UID <code className="font-mono text-free">{studioId.slice(0, 8)}…</code> + code <b className="text-free">{settings.clientPairingCode}</b>. Same dashboard.</p>
          <p className="rounded-xl border border-hairline bg-panel2 p-3"><b className="text-ink">3. Isolation:</b> link embeds your studio UID + pairing code — other lounges' PCs never show here. Same WiFi/LAN or anywhere with internet (Firebase).</p>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle
          title="Connected PCs (WiFi/LAN)"
          subtitle={`Paired via code ${settings.clientPairingCode} — EXE + browser PCs appear together`}
          icon={<Wifi className="h-5 w-5" />}
          action={<Badge tone="free">{clients.length} connected</Badge>}
        />
        <div className="mb-3 rounded-xl border border-hairline bg-panel2 p-3 text-xs text-muted">
          <p><b className="text-ink">Admin controls (like SENET / SmartLaunch):</b> Start timer remotely (15/30/60), +10/+30 extend, message PC, lock/unlock, maintenance, link to Station for billing. Timer end → PC fullscreen locks for {settings.lockCooldownMinutes ?? 10} min (“going to shut”) and dashboard shows countdown.</p>
          <p className="mt-1">Special app handling: <span className="text-ink">{settings.allowedApps || "all allowed"}</span> {settings.blockedApps ? `• blocked: ${settings.blockedApps}` : ""} — EXE reports running apps; edit in Settings → Client PCs.</p>
        </div>

        {clients.length === 0 ? (
          <EmptyState
            icon={<Monitor className="h-6 w-6" />}
            title="No PCs connected yet"
            body="Copy the link above, open it on each gaming PC browser and Pair. They will appear here live."
            action={<Button onClick={copyLink}><Copy className="h-4 w-4" /> Copy PC connect link</Button>}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((c) => {
              const offline = isOffline(c);
              const status = offline ? "offline" : c.status;
              const station = c.stationId
                ? stations.find((s) => s.id === c.stationId)
                : stations.find((s) => s.name === c.pcName || s.name === c.pcName.replace("-PC", ""));
              const sessionEnd = c.sessionEnd || 0;
              const lockUntil = c.lockUntil || 0;
              const remainingSec = Math.max(0, Math.floor((sessionEnd - now) / 1000));
              const lockSec = Math.max(0, Math.floor((lockUntil - now) / 1000));
              const remMin = Math.floor(remainingSec / 60);
              const remSec = remainingSec % 60;
              const lockMin = Math.floor(lockSec / 60);
              const lockSecR = lockSec % 60;
              const statusColor: Record<string, string> = { ready: "free", busy: "occupied", locked: "warn", maintenance: "danger", offline: "muted" };
              return (
                <Card key={c.id} className={`p-4 ${offline ? "opacity-60" : ""} ${c.status === "busy" ? "border-occupied/40 pulse-occupied" : c.status === "locked" ? "border-warn/40" : ""}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-display font-bold text-ink">{c.pcName}</p>
                      <p className="flex items-center gap-1 text-xs text-muted"><Wifi className="h-3 w-3" /> {c.ip || "—"} • {c.version || "1.0"} {c.specs ? `• ${String(c.specs).slice(0, 20)}` : ""}</p>
                    </div>
                    <Badge color={statusColor[status] || "muted"}>{offline ? "Offline" : c.status}</Badge>
                  </div>

                  {/* Station link */}
                  <div className="mt-2">
                    <Select
                      value={c.stationId || ""}
                      onChange={(e) => updateClient(c.id, { stationId: e.target.value || null })}
                    >
                      <option value="">Link station…</option>
                      {stations.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} • {formatMoney(s.hourlyRate, settings.currency)}/hr</option>
                      ))}
                    </Select>
                  </div>
                  {station && <p className="mt-1 text-xs text-muted">→ Station: <span className="text-ink">{station.name}</span> • {formatMoney(station.hourlyRate, settings.currency)}/hr</p>}
                  {(c as any).appUsage && <p className="mt-1 flex items-center gap-1 text-xs text-muted"><AppWindow className="h-3 w-3" /> App: <span className="font-mono text-ink">{(c as any).appUsage}</span></p>}
                  {(c as any).message && <p className="mt-1 rounded-lg border border-hairline bg-panel2 px-2 py-1 text-xs text-ink">📢 {(c as any).message}</p>}

                  <div className="mt-3 min-h-[3rem]">
                    {c.status === "busy" && sessionEnd > now ? (
                      <div>
                        <p className="mono text-2xl font-bold text-occupied">{remMin}:{String(remSec).padStart(2, "0")}</p>
                        <p className="text-xs text-muted">until auto-lock • {new Date(sessionEnd).toLocaleTimeString()}</p>
                      </div>
                    ) : c.status === "locked" && lockUntil > now ? (
                      <div>
                        <p className="mono text-xl font-bold text-warn">{lockMin}:{String(lockSecR).padStart(2, "0")} cooldown</p>
                        <p className="text-xs text-warn">PC locked — “going to shut” received.</p>
                      </div>
                    ) : c.status === "maintenance" ? (
                      <p className="text-sm font-medium text-warn">Maintenance — not bookable</p>
                    ) : offline ? (
                      <p className="text-sm text-muted">Offline — last seen {new Date(c.lastSeen).toLocaleTimeString()}</p>
                    ) : (
                      <p className="text-sm font-medium text-free">Ready • Free</p>
                    )}
                  </div>

                  {/* Remote start timer */}
                  {(c.status === "ready" || offline === false) && c.status !== "busy" && c.status !== "locked" && (
                    <div className="mt-2 flex gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => startTimerOnClient(c, 15)}>▶ 15m</Button>
                      <Button size="sm" variant="outline" onClick={() => startTimerOnClient(c, 30)}>▶ 30m</Button>
                      <Button size="sm" variant="outline" onClick={() => startTimerOnClient(c, 60)}>▶ 60m</Button>
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.status === "busy" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { extendClientTime(c.id, 10); toast("Extended +10 min", "free"); }}><Plus className="h-3 w-3" /> +10</Button>
                        <Button size="sm" variant="outline" onClick={() => { extendClientTime(c.id, 30); toast("Extended +30 min", "free"); }}><Plus className="h-3 w-3" /> +30</Button>
                        <Button size="sm" variant="ghost" onClick={() => { extendClientTime(c.id, 60); toast("Extended +60 min", "free"); }}>+60</Button>
                        <Button size="sm" variant="ghost" onClick={() => updateClient(c.id, { status: "locked", lockUntil: Date.now() + (settings.lockCooldownMinutes ?? 10) * 60000, command: "lock" })}><Lock className="h-3 w-3" /> Lock</Button>
                      </>
                    )}
                    {c.status === "locked" && (
                      <Button size="sm" variant="outline" onClick={() => { updateClient(c.id, { status: "ready", lockUntil: null, command: "unlock" }); toast("Unlocked", "free"); }}><Unlock className="h-3 w-3" /> Unlock Now</Button>
                    )}
                    {c.status !== "maintenance" ? (
                      <Button size="sm" variant="ghost" onClick={() => updateClient(c.id, { status: "maintenance" })}><Wrench className="h-3 w-3" /> Maintenance</Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => updateClient(c.id, { status: "ready" })}><Power className="h-3 w-3" /> Set Ready</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Remove ${c.pcName}?`)) deleteClient(c.id); }}><Trash2 className="h-3 w-3" /></Button>
                  </div>

                  {/* Message + clear */}
                  <div className="mt-2 flex gap-1.5">
                    <Input
                      placeholder="Message this PC…"
                      value={msgDraft[c.id] || ""}
                      onChange={(e) => setMsgDraft((p) => ({ ...p, [c.id]: e.target.value }))}
                    />
                    <Button size="sm" variant="outline" onClick={() => sendMessage(c.id)}><Send className="h-3 w-3" /></Button>
                    {(c as any).message && (
                      <Button size="sm" variant="ghost" onClick={() => updateClient(c.id, { message: null })}>Clear</Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
