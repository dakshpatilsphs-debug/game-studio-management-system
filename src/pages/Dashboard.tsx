import { useEffect, useMemo, useState } from "react";
import {
  DollarSign,
  Activity,
  MonitorPlay,
  Zap,
  Sparkles,
  Plus,
} from "lucide-react";
import { useData } from "../lib/store";
import { computeKPIs } from "../lib/ai";
import { Card, StatCard, SectionTitle, StatusBadge, EmptyState, Button, Skeleton } from "../components/ui";
import { StartSessionModal, BillSessionModal } from "../components/SessionModals";
import { formatMoney, liveSessionCost, formatDuration } from "../lib/format";
import { cn } from "../utils/cn";
import type { PageId } from "../components/Layout";
import type { Station, GameSession, StationType } from "../lib/types";

export default function Dashboard({ setPage }: { setPage: (p: PageId) => void }) {
  const { sessions, stations, expenses, bills, customers, settings, isHappyHour, seedDemoData } = useData();
  const cur = settings.currency;

  const k = useMemo(() => computeKPIs({ sessions, expenses, bills, stations, settings }), [sessions, expenses, bills, stations, settings]);

  const [startOpen, setStartOpen] = useState(false);
  const [preset, setPreset] = useState<Station | null>(null);
  const [billing, setBilling] = useState<GameSession | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const active = sessions.filter((s) => s.status === "active");

  const grouped = useMemo(() => {
    const order: StationType[] = ["PC", "PS5", "PS4", "Nintendo Switch", "VR", "Racing"];
    const types = [...new Set(stations.map((s) => s.type))];
    return types
      .sort((a, b) => order.indexOf(a) - order.indexOf(b))
      .map((type) => ({ type, list: stations.filter((s) => s.type === type) }));
  }, [stations]);

  const counts = useMemo(() => {
    const c = { available: 0, rented: 0, maintenance: 0 };
    stations.forEach((s) => (c[s.status] += 1));
    return c;
  }, [stations]);

  const isEmpty = stations.length === 0;

  function openStart(station?: Station) {
    setPreset(station || null);
    setStartOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Slim KPI bar */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Today's Revenue" value={formatMoney(k.todayRevenue, cur)} icon={<DollarSign className="h-5 w-5" />} accent="free" delta={`${k.todaySessions} sessions`} />
        <StatCard label="Active Now" value={String(k.activeSessions)} icon={<Activity className="h-5 w-5" />} accent="occupied" delta={`${counts.available} free stations`} />
        <StatCard label="Net Profit" value={formatMoney(k.profit, cur)} icon={k.profit >= 0 ? <Zap className="h-5 w-5" /> : <DollarSign className="h-5 w-5" />} accent={k.profit >= 0 ? "free" : "danger"} delta={`${k.margin.toFixed(0)}% margin`} />
        <StatCard label="Customers" value={String(customers.length)} icon={<MonitorPlay className="h-5 w-5" />} accent="warn" delta={`${active.length} playing now`} />
      </div>

      {/* Station grid hero */}
      <div>
        <SectionTitle
          title="Station Floor"
          subtitle="Tap an available station to start, or stop an active one to bill"
          icon={<MonitorPlay className="h-5 w-5" />}
          action={
            <Button size="sm" variant="outline" onClick={() => openStart()}>
              <Plus className="h-4 w-4" /> Quick Start
            </Button>
          }
        />

        {isEmpty ? (
          <EmptyState
            icon={<MonitorPlay className="h-6 w-6" />}
            title="No stations added yet"
            body="Add your first PC or PS5 to start tracking sessions — or load demo data to explore."
            action={
              <div className="flex gap-2">
                <Button onClick={() => setPage("rentals")}><Plus className="h-4 w-4" /> Add stations</Button>
                <Button variant="outline" onClick={seedDemoData}>Load demo</Button>
              </div>
            }
          />
        ) : (
          <div className="space-y-6">
            {grouped.map(({ type, list }) => (
              <div key={type}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="font-display text-sm font-semibold uppercase tracking-wider text-muted">{type}</span>
                  <span className="text-xs text-muted/60">{list.length}</span>
                  <div className="h-px flex-1 bg-hairline" />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {list.map((s) => (
                    <StationCard
                      key={s.id}
                      station={s}
                      session={active.find((a) => a.stationId === s.id)}
                      cur={cur}
                      happy={isHappyHour(s.type)}
                      roundOff={settings.billingRoundOffMinutes ?? 15}
                      onStart={() => openStart(s)}
                      onStop={(ses) => setBilling(ses)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live sessions + AI CTA */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle title="Live Sessions" subtitle={`${active.length} ongoing`} icon={<Activity className="h-5 w-5" />} />
          {active.length === 0 ? (
            <EmptyState icon={<Activity className="h-6 w-6" />} title="All stations idle" body="Start a session to see live timers here." />
          ) : (
            <div className="space-y-2">
              {active.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border border-occupied/20 bg-occupied/5 px-4 py-3">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-occupied" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{s.customerName}</p>
                    <p className="truncate text-xs text-muted">{s.stationName} • started playing</p>
                  </div>
                  <div className="text-right">
                    <p className="mono text-sm font-bold text-occupied">{formatMoney(liveSessionCost(s.startTime, null, s.hourlyRate, settings.billingRoundOffMinutes), cur)}</p>
                    <p className="mono text-xs text-muted">{formatDuration(s.startTime, null)}</p>
                  </div>
                  <button onClick={() => setBilling(s)} className="rounded-lg bg-occupied px-3 py-1.5 text-xs font-semibold text-canvas transition hover:brightness-110 active:scale-95">
                    Stop
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <button onClick={() => setPage("ai")} className="group overflow-hidden rounded-2xl border border-hairline bg-gradient-to-br from-free/[0.08] to-occupied/[0.06] p-5 text-left transition hover:border-free/30">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-free/15">
            <Sparkles className="h-5 w-5 text-free" />
          </div>
          <p className="font-display font-semibold text-ink">Ask the AI Assistant</p>
          <p className="mt-1 text-sm text-muted">Instant insights on profit, peak hours & growth tips.</p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-free group-hover:gap-2 transition-all">Open AI →</span>
        </button>
      </div>

      <StartSessionModal open={startOpen} onClose={() => setStartOpen(false)} presetStation={preset} stations={stations.filter((s) => s.status === "available")} />
      <BillSessionModal open={!!billing} onClose={() => setBilling(null)} session={billing} />
    </div>
  );
}

function StationCard({
  station,
  session,
  cur,
  happy,
  roundOff,
  onStart,
  onStop,
}: {
  station: Station;
  session: GameSession | undefined;
  cur: string;
  happy: boolean;
  roundOff: number;
  onStart: () => void;
  onStop: (s: GameSession) => void;
}) {
  const status = station.status;
  const isOccupied = status === "rented" && session;
  const cost = isOccupied ? liveSessionCost(session!.startTime, null, session!.hourlyRate, roundOff) : 0;

  return (
    <Card
      className={cn(
        "relative overflow-hidden p-4 transition-all active:scale-[0.97]",
        status === "available" && "border-free/25 hover:border-free/50",
        status === "rented" && "pulse-occupied border-occupied/40",
        status === "maintenance" && "border-warn/30 opacity-80"
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-base font-bold text-ink">{station.name}</p>
          <p className="text-xs text-muted">{station.type}</p>
        </div>
        <StatusDot status={status} />
      </div>

      <div className="mt-3 min-h-[3.5rem]">
        {isOccupied ? (
          <div>
            <p className="mono text-2xl font-bold text-occupied">
              {formatDuration(session!.startTime, null)}
            </p>
            <p className="mono text-sm font-semibold text-ink">{formatMoney(cost, cur)}</p>
            <p className="mt-0.5 truncate text-xs text-muted">{session!.customerName}</p>
          </div>
        ) : status === "maintenance" ? (
          <p className="mt-1 text-sm font-medium text-warn">Under maintenance</p>
        ) : (
          <div>
            <p className="mt-1 text-sm font-medium text-free">Free</p>
            <p className="mono text-xs text-muted">{formatMoney(station.hourlyRate, cur)}/hr {happy && <span className="text-free">· HH</span>}</p>
          </div>
        )}
      </div>

      <div className="mt-3">
        {status === "available" && (
          <button onClick={onStart} className="w-full rounded-lg bg-free py-2 text-sm font-semibold text-canvas transition hover:brightness-110 active:scale-95">
            Start
          </button>
        )}
        {isOccupied && (
          <button onClick={() => onStop(session!)} className="w-full rounded-lg bg-occupied py-2 text-sm font-semibold text-canvas transition hover:brightness-110 active:scale-95">
            Stop & Bill
          </button>
        )}
        {status === "maintenance" && <StatusBadge status="maintenance" label="Offline" />}
      </div>
    </Card>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    available: "bg-free",
    rented: "bg-occupied",
    maintenance: "bg-warn",
  };
  return <span className={cn("mt-1 h-2.5 w-2.5 rounded-full", map[status] || "bg-muted", status === "rented" && "animate-pulse")} />;
}

export function StationGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-hairline bg-panel p-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="mt-3 h-7 w-24" />
          <Skeleton className="mt-2 h-3 w-20" />
          <Skeleton className="mt-4 h-8 w-full" />
        </div>
      ))}
    </div>
  );
}
