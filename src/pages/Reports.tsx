import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from "recharts";
import { BarChart3, Download, TrendingUp, TrendingDown, Wallet, Trophy, FileDown } from "lucide-react";
import { generateReportPDF } from "../lib/pdf";
import { useData } from "../lib/store";
import { Card, SectionTitle, StatCard, Button, Select } from "../components/ui";
import { formatMoney, dayKey, startOfDay } from "../lib/format";

type Range = "7" | "30" | "90";

const TYPE_COLORS: Record<string, string> = {
  PC: "#8b5cf6",
  PS5: "#06b6d4",
  PS4: "#3b82f6",
  VR: "#ec4899",
  "Nintendo Switch": "#22c55e",
  Racing: "#f59e0b",
};

export default function Reports() {
  const { sessions, expenses, bills, settings } = useData();
  const cur = settings.currency;
  const [range, setRange] = useState<Range>("30");

  const days = Number(range);
  const since = startOfDay(Date.now() - (days - 1) * 86400000);

  const inRange = useMemo(() => {
    const rs = sessions.filter((s) => (s.endTime || s.startTime) >= since && s.status === "completed");
    const re = expenses.filter((e) => e.date >= since);
    // Exclude session-generated receipts — their money is already counted via rs.
    const rb = bills.filter((b) => b.createdAt >= since && !b.fromSession);
    return { rs, re, rb };
  }, [sessions, expenses, bills, since]);

  // revenue vs expense daily series
  const series = useMemo(() => {
    const map: Record<string, { label: string; revenue: number; expense: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const t = startOfDay(Date.now() - i * 86400000);
      map[t] = { label: dayKey(t), revenue: 0, expense: 0 };
    }
    inRange.rs.forEach((s) => {
      if (s.endTime) {
        const k = startOfDay(s.endTime);
        if (map[k]) map[k].revenue += s.totalCost || 0;
      }
    });
    inRange.rb.forEach((b) => {
      const k = startOfDay(b.createdAt);
      if (map[k]) map[k].revenue += b.total;
    });
    inRange.re.forEach((e) => {
      const k = startOfDay(e.date);
      if (map[k]) map[k].expense += e.amount;
    });
    // sample to keep chart readable for 90 days
    const arr = Object.values(map);
    if (days <= 7) return arr;
    if (days <= 30) return arr.filter((_, i) => i % 2 === 0 || i === arr.length - 1);
    return arr.filter((_, i) => i % 5 === 0 || i === arr.length - 1);
  }, [inRange, days]);

  const totalRevenue =
    inRange.rs.reduce((s, x) => s + (x.totalCost || 0), 0) +
    inRange.rb.reduce((s, x) => s + x.total, 0);
  const totalExpense = inRange.re.reduce((s, x) => s + x.amount, 0);
  const profit = totalRevenue - totalExpense;

  // revenue by station type
  const byType = useMemo(() => {
    const m: Record<string, number> = {};
    inRange.rs.forEach((s) => (m[s.type] = (m[s.type] || 0) + (s.totalCost || 0)));
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [inRange.rs]);

  // expense by category
  const byCat = useMemo(() => {
    const m: Record<string, number> = {};
    inRange.re.forEach((e) => (m[e.category] = (m[e.category] || 0) + e.amount));
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [inRange.re]);

  // top stations
  const topStations = useMemo(() => {
    const m: Record<string, number> = {};
    inRange.rs.forEach((s) => (m[s.stationName] = (m[s.stationName] || 0) + (s.totalCost || 0)));
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [inRange.rs]);

  function exportCSV() {
    const rows: string[] = [];
    rows.push("Type,Date,Customer/Description,Category/Station,Payment,Amount");
    inRange.rs.forEach((s) =>
      rows.push(`Session,${s.endTime ? new Date(s.endTime).toLocaleDateString() : ""},${escapeCsv(s.customerName)},${s.type},-,${s.totalCost}`)
    );
    inRange.rb.forEach((b) =>
      rows.push(`Bill,${new Date(b.createdAt).toLocaleDateString()},${escapeCsv(b.customerName)},Invoice,${b.paymentMethod},${b.total}`)
    );
    inRange.re.forEach((e) =>
      rows.push(`Expense,${new Date(e.date).toLocaleDateString()},${escapeCsv(e.description)},${e.category},-,${-e.amount}`)
    );
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `studio-report-${range}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    generateReportPDF({
      studioName: settings.studioName,
      currency: cur,
      logo: settings.logo,
      rangeLabel: `Last ${range} days`,
      kpis: {
        revenue: totalRevenue,
        expenses: totalExpense,
        profit,
        sessions: inRange.rs.length,
      },
      series,
      byType,
      byCat,
      topStations,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Financial Reports</h2>
          <p className="text-sm text-slate-400">Track revenue, expenses & profitability over time</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onChange={(e) => setRange(e.target.value as Range)} className="w-auto">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button size="sm" onClick={exportPDF}>
            <FileDown className="h-4 w-4" /> Export PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Revenue" value={formatMoney(totalRevenue, cur)} icon={<TrendingUp className="h-5 w-5" />} accent="emerald" />
        <StatCard label="Expenses" value={formatMoney(totalExpense, cur)} icon={<TrendingDown className="h-5 w-5" />} accent="rose" />
        <StatCard label="Net Profit" value={formatMoney(profit, cur)} icon={<Wallet className="h-5 w-5" />} accent={profit >= 0 ? "violet" : "rose"} />
        <StatCard label="Sessions" value={String(inRange.rs.length)} icon={<BarChart3 className="h-5 w-5" />} accent="cyan" />
      </div>

      <Card className="p-5">
        <SectionTitle title="Revenue vs Expenses" subtitle={`Last ${range} days`} icon={<BarChart3 className="h-5 w-5" />} />
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ left: -10, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
                contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                formatter={(v, n) => [formatMoney(Number(v), cur), n === "revenue" ? "Revenue" : "Expenses"]}
              />
              <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Revenue by Type" icon={<Trophy className="h-5 w-5" />} />
          {byType.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">No data in this range</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byType} dataKey="value" nameKey="name" outerRadius={90} label={(e: any) => `${((e.percent ?? 0) * 100).toFixed(0)}%`}>
                    {byType.map((e) => (
                      <Cell key={e.name} fill={TYPE_COLORS[e.name] || "#8b5cf6"} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                    formatter={(v) => formatMoney(Number(v), cur)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle title="Expenses by Category" icon={<Wallet className="h-5 w-5" />} />
          {byCat.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">No data in this range</p>
          ) : (
            <div className="space-y-3 pt-2">
              {byCat.map(({ name, value }) => {
                const amount = value;
                const pct = totalExpense > 0 ? (amount / totalExpense) * 100 : 0;
                return (
                  <div key={name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-slate-300">{name}</span>
                      <span className="text-slate-400">{formatMoney(amount, cur)} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle title="Top Performing Stations" subtitle={`Last ${range} days`} icon={<Trophy className="h-5 w-5" />} />
        {topStations.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No completed sessions in this range</p>
        ) : (
          <div className="space-y-2">
            {topStations.map(([name, amount], i) => (
              <div key={name} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-free/15 text-sm font-bold text-free">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm font-medium text-ink">{name}</span>
                <span className="mono font-semibold text-free">{formatMoney(amount, cur)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
