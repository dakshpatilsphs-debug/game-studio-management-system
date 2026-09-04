import { useEffect, useState } from "react";
import { Monitor, Wifi, Shield, Clock, Power, Wrench, Unlock, Plus, Trash2, Timer, AppWindow } from "lucide-react";
import { useData } from "../lib/store";
import { Card, Button, Badge, SectionTitle, EmptyState, StatCard } from "../components/ui";
import { formatMoney } from "../lib/format";
import { useToast } from "../components/Toaster";

export default function Clients() {
  const { clients, stations, settings, updateClient, deleteClient, extendClientTime } = useData();
  const { toast } = useToast();
  const [, tick] = useState(0);
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Ready PCs" value={String(ready)} icon={<Monitor className="h-5 w-5" />} accent="free" delta={`${clients.length} total clients`} />
        <StatCard label="Busy (timer)" value={String(busy)} icon={<Timer className="h-5 w-5" />} accent="occupied" />
        <StatCard label="Locked (cooldown)" value={String(locked)} icon={<Shield className="h-5 w-5" />} accent="warn" delta={`${settings.lockCooldownMinutes ?? 10} min cooldown`} />
        <StatCard label="Maintenance" value={String(maint)} icon={<Wrench className="h-5 w-5" />} accent="danger" />
      </div>

      <Card className="p-5">
        <SectionTitle
          title="Connected PCs (WiFi/LAN)"
          subtitle={`Paired via code ${settings.clientPairingCode} — all PCs on same WiFi/LAN with EXE appear here`}
          icon={<Wifi className="h-5 w-5" />}
          action={<Badge tone="free">{clients.length} connected</Badge>}
        />
        <div className="mb-3 rounded-xl border border-hairline bg-panel2 p-3 text-xs text-muted">
          <p><b className="text-ink">How pairing works:</b> Install <code className="rounded bg-panel px-1 py-0.5 font-mono text-ink">GameLounge-Client.exe</code> on each gaming PC → open it → enter <b className="text-free">{settings.clientPairingCode}</b> + your prebook link UID (shown in Prebooks page) → PC appears here via WiFi/LAN (Firebase). Different studio = different pairing code & link, so PCs only show in their owner's admin dashboard.</p>
          <p className="mt-1">Timer: session time → auto-lock. 10-min (editable in Settings) cooldown — PC shows “Going to shut, contact admin” and message is also sent to this dashboard. Admin can <b className="text-ink">Increase Time</b> during lock to unlock early.</p>
          <p className="mt-1">Special app handling: <span className="text-ink">{settings.allowedApps || "all allowed"}</span> {settings.blockedApps ? `• blocked: ${settings.blockedApps}` : ""} — client monitors running apps and reports/kills per settings.</p>
        </div>

        {clients.length === 0 ? (
          <EmptyState
            icon={<Monitor className="h-6 w-6" />}
            title="No PCs connected yet"
            body="Install the EXE on each PC, enter pairing code and connect via WiFi. They will appear here live with Ready/Maintenance/Locked status."
            action={
              <div className="text-left text-xs text-muted max-w-md">
                <p className="font-medium text-ink">To get EXE:</p>
                <p>1. Check <code>client/</code> folder → run <code>npm install && npm run build</code> → find <code>dist/GameLounge-Client-Setup.exe</code></p>
                <p>2. Or download from your build artifacts. Install on each PC.</p>
              </div>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((c) => {
              const offline = isOffline(c);
              const status = offline ? "offline" : c.status;
              const station = stations.find((s) => s.name === c.pcName || s.name === c.pcName.replace("-PC", ""));
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
                      <p className="text-xs text-muted flex items-center gap-1"><Wifi className="h-3 w-3" /> {c.ip || "—"} • {c.version || "1.0"} {c.specs ? `• ${c.specs.slice(0, 20)}` : ""}</p>
                    </div>
                    <Badge color={statusColor[status] || "muted"}>{offline ? "Offline" : c.status}</Badge>
                  </div>

                  {station && <p className="mt-1 text-xs text-muted">→ Station: <span className="text-ink">{station.name}</span> • {formatMoney(station.hourlyRate, settings.currency)}/hr</p>}
                  {c.appUsage && <p className="mt-1 flex items-center gap-1 text-xs text-muted"><AppWindow className="h-3 w-3" /> App: <span className="font-mono text-ink">{c.appUsage}</span></p>}

                  <div className="mt-3 min-h-[3rem]">
                    {c.status === "busy" && sessionEnd > now ? (
                      <div>
                        <p className="mono text-2xl font-bold text-occupied">{remMin}:{String(remSec).padStart(2, "0")}</p>
                        <p className="text-xs text-muted">until auto-lock • {new Date(sessionEnd).toLocaleTimeString()}</p>
                      </div>
                    ) : c.status === "locked" && lockUntil > now ? (
                      <div>
                        <p className="mono text-xl font-bold text-warn">{lockMin}:{String(lockSecR).padStart(2, "0")} cooldown</p>
                        <p className="text-xs text-warn">PC locked — cannot be used for {settings.lockCooldownMinutes} min. Message sent to admin: “going to shut”.</p>
                      </div>
                    ) : c.status === "maintenance" ? (
                      <p className="text-sm font-medium text-warn">Maintenance — not bookable</p>
                    ) : offline ? (
                      <p className="text-sm text-muted">Offline — last seen {new Date(c.lastSeen).toLocaleTimeString()}</p>
                    ) : (
                      <p className="text-sm font-medium text-free">Ready • Free</p>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.status === "busy" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { extendClientTime(c.id, 10); toast("Extended +10 min", "free"); }}><Plus className="h-3 w-3" /> +10</Button>
                        <Button size="sm" variant="outline" onClick={() => { extendClientTime(c.id, 30); toast("Extended +30 min", "free"); }}><Plus className="h-3 w-3" /> +30</Button>
                        <Button size="sm" variant="ghost" onClick={() => { extendClientTime(c.id, 60); toast("Extended +60 min", "free"); }}>+60</Button>
                      </>
                    )}
                    {c.status === "locked" && (
                      <Button size="sm" variant="outline" onClick={() => { updateClient(c.id, { status: "ready", lockUntil: null }); toast("Unlocked", "free"); }}><Unlock className="h-3 w-3" /> Unlock Now</Button>
                    )}
                    {c.status !== "maintenance" ? (
                      <Button size="sm" variant="ghost" onClick={() => updateClient(c.id, { status: "maintenance" })}><Wrench className="h-3 w-3" /> Maintenance</Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => updateClient(c.id, { status: "ready" })}><Power className="h-3 w-3" /> Set Ready</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Remove ${c.pcName}?`)) deleteClient(c.id); }}><Trash2 className="h-3 w-3" /></Button>
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
