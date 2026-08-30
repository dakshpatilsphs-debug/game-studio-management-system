import type {
  Station,
  GameSession,
  Expense,
  Bill,
  Settings,
} from "./types";
import { isSameDay, startOfDay, formatMoney } from "./format";

export interface Insight {
  id: string;
  type: "success" | "warning" | "info" | "tip" | "danger";
  title: string;
  body: string;
  icon: string;
}

interface AIContext {
  stations: Station[];
  sessions: GameSession[];
  expenses: Expense[];
  bills: Bill[];
  settings: Settings;
}

const cur = (n: number, c: string) => formatMoney(n, c);

function revenueFromSessions(sessions: GameSession[]): number {
  return sessions.reduce((sum, s) => sum + (s.totalCost || 0), 0);
}

/** last N days revenue map keyed by day-start */
function dailyRevenue(sessions: GameSession[], days: number): { label: string; value: number }[] {
  const out: { label: string; value: number }[] = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = startOfDay(now - i * 86400000);
    const next = dayStart + 86400000;
    const value = sessions
      .filter((s) => s.status === "completed" && s.endTime && s.endTime >= dayStart && s.endTime < next)
      .reduce((sum, s) => sum + (s.totalCost || 0), 0);
    out.push({ label: new Date(dayStart).toLocaleDateString(undefined, { weekday: "short" }), value });
  }
  return out;
}

export function computeKPIs(ctx: AIContext) {
  const { sessions, expenses, bills, settings } = ctx;
  const now = Date.now();
  const today = isSameDay;
  const completed = sessions.filter((s) => s.status === "completed");

  const todaySessions = sessions.filter((s) => s.startTime >= startOfDay(now)).length;
  const activeSessions = sessions.filter((s) => s.status === "active").length;

  // Session receipts (fromSession) are already counted via sessionRevenue,
  // so exclude them from billRevenue to avoid double counting.
  const standaloneBills = bills.filter((b) => !b.fromSession);
  const sessionRevenue = revenueFromSessions(completed);
  const billRevenue = standaloneBills.reduce((sum, b) => sum + b.total, 0);
  const totalRevenue = sessionRevenue + billRevenue;

  const todayRevenue =
    completed.filter((s) => s.endTime && today(s.endTime, now)).reduce((sum, s) => sum + (s.totalCost || 0), 0) +
    standaloneBills.filter((b) => today(b.createdAt, now)).reduce((sum, b) => sum + b.total, 0);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const profit = totalRevenue - totalExpenses;
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  // utilization: rented+completed sessions per station count
  const availableStations = ctx.stations.filter((s) => s.status !== "maintenance").length;
  const utilRate = availableStations > 0 ? Math.min(100, (activeSessions / availableStations) * 100) : 0;

  // weekly trend
  const week = dailyRevenue(completed, 7);
  const lastWeek = week.slice(0, 3).reduce((a, b) => a + b.value, 0);
  const recent = week.slice(4).reduce((a, b) => a + b.value, 0);
  const trend = lastWeek > 0 ? ((recent - lastWeek) / lastWeek) * 100 : recent > 0 ? 100 : 0;

  return {
    todaySessions,
    activeSessions,
    sessionRevenue,
    billRevenue,
    totalRevenue,
    todayRevenue,
    totalExpenses,
    profit,
    margin,
    utilRate,
    week,
    trend,
    avgSessionValue: completed.length > 0 ? sessionRevenue / completed.length : 0,
    currency: settings.currency,
  };
}

export function generateInsights(ctx: AIContext): Insight[] {
  const out: Insight[] = [];
  const k = computeKPIs(ctx);
  const { expenses, sessions, stations } = ctx;

  // 1. Profitability
  if (k.profit >= 0) {
    out.push({
      id: "profit",
      type: "success",
      icon: "📈",
      title: "Profitable operations",
      body: `Your studio is netting ${cur(k.profit, k.currency)} profit (${k.margin.toFixed(
        1
      )}% margin) across ${sessions.filter((s) => s.status === "completed").length} sessions. ${
        k.margin > 40 ? "Excellent margin — consider reinvesting." : "Solid. Watch expenses to grow margin."
      }`,
    });
  } else {
    out.push({
      id: "profit",
      type: "danger",
      icon: "📉",
      title: "Operating at a loss",
      body: `Expenses (${cur(k.totalExpenses, k.currency)}) exceed revenue (${cur(
        k.totalRevenue,
        k.currency
      )}). Cut non-essential spending or push rentals to reach profitability.`,
    });
  }

  // 2. Revenue trend
  if (Math.abs(k.trend) >= 5) {
    out.push({
      id: "trend",
      type: k.trend > 0 ? "success" : "warning",
      icon: k.trend > 0 ? "🚀" : "⚠️",
      title: k.trend > 0 ? "Revenue trending up" : "Revenue trending down",
      body: `Weekly rental revenue is ${k.trend > 0 ? "up" : "down"} ${Math.abs(k.trend).toFixed(
        0
      )}% compared to the start of the week. ${
        k.trend > 0 ? "Keep the momentum with promotions." : "Try a weekend discount to boost traffic."
      }`,
    });
  }

  // 3. Peak hours detection
  const hourCounts: Record<number, number> = {};
  sessions.forEach((s) => {
    const h = new Date(s.startTime).getHours();
    hourCounts[h] = (hourCounts[h] || 0) + 1;
  });
  let peakHour = -1;
  let peakCount = 0;
  Object.entries(hourCounts).forEach(([h, c]) => {
    if (c > peakCount) {
      peakCount = c;
      peakHour = Number(h);
    }
  });
  if (peakHour >= 0) {
    out.push({
      id: "peak",
      type: "info",
      icon: "⏰",
      title: "Peak hours insight",
      body: `Most sessions start around ${peakHour}:00. Staff up and run targeted ads in that window to maximize occupancy. ${
        peakHour < 17 ? "Evenings may be under-booked — consider happy-hour pricing." : ""
      }`,
    });
  }

  // 4. Top station
  const stationRev: Record<string, number> = {};
  sessions.forEach((s) => {
    stationRev[s.stationName] = (stationRev[s.stationName] || 0) + (s.totalCost || 0);
  });
  const topStation = Object.entries(stationRev).sort((a, b) => b[1] - a[1])[0];
  if (topStation) {
    out.push({
      id: "topstation",
      type: "info",
      icon: "🏆",
      title: "Star performer",
      body: `${topStation[0]} is your highest earner at ${cur(
        topStation[1],
        k.currency
      )}. This station type is in demand — consider adding another.`,
    });
  }

  // 5. Underutilized / maintenance
  const maint = stations.filter((s) => s.status === "maintenance");
  if (maint.length > 0) {
    out.push({
      id: "maint",
      type: "warning",
      icon: "🔧",
      title: "Stations offline",
      body: `${maint.length} station${maint.length > 1 ? "s are" : " is"} under maintenance (${maint
        .map((m) => m.name)
        .join(", ")}). Every offline hour is lost revenue — prioritize repairs.`,
    });
  }

  // 6. Expense concentration
  const byCat: Record<string, number> = {};
  expenses.forEach((e) => {
    byCat[e.category] = (byCat[e.category] || 0) + e.amount;
  });
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  if (topCat && k.totalExpenses > 0) {
    const pct = (topCat[1] / k.totalExpenses) * 100;
    if (pct > 50) {
      out.push({
        id: "expcat",
        type: "tip",
        icon: "💡",
        title: "Expense concentration",
        body: `${topCat[0]} makes up ${pct.toFixed(0)}% of all expenses (${cur(
          topCat[1],
          k.currency
        )}). Negotiate bulk deals or find alternatives to lower this fixed cost.`,
      });
    }
  }

  // 7. Idle capacity
  const available = stations.filter((s) => s.status === "available").length;
  if (available > stations.length / 2 && stations.length > 0) {
    out.push({
      id: "idle",
      type: "tip",
      icon: "🎯",
      title: "Capacity available",
      body: `${available} of ${stations.length} stations are free right now. Run a flash promotion or student discount to fill idle seats.`,
    });
  }

  // 8. Repeat customers
  const custCounts: Record<string, number> = {};
  sessions.forEach((s) => {
    custCounts[s.customerName] = (custCounts[s.customerName] || 0) + 1;
  });
  const repeats = Object.entries(custCounts).filter(([, c]) => c >= 2);
  if (repeats.length > 0) {
    out.push({
      id: "loyalty",
      type: "success",
      icon: "❤️",
      title: "Loyal customers detected",
      body: `${repeats.length} customer${repeats.length > 1 ? "s have" : " has"} returned multiple times (${
        repeats[0][0]
      } is a regular). Launch a loyalty program to reward and retain them.`,
    });
  }

  return out;
}

export function aiChat(question: string, ctx: AIContext): string {
  const k = computeKPIs(ctx);
  const q = question.toLowerCase();
  const { sessions, expenses, bills, stations } = ctx;
  const completed = sessions.filter((s) => s.status === "completed");

  if (/(hello|hi|hey|salam|assalam)/.test(q)) {
    return `Hello! 👋 I'm your studio AI assistant. I can analyze your rentals, revenue, expenses, and give recommendations. Try asking "How much profit did I make?" or "What's my best station?"`;
  }
  if (/(profit|loss|net|margin)/.test(q)) {
    return k.profit >= 0
      ? `You have a net profit of ${cur(k.profit, k.currency)} with a ${k.margin.toFixed(
          1
        )}% margin. Total revenue ${cur(k.totalRevenue, k.currency)} minus expenses ${cur(
          k.totalExpenses,
          k.currency
        )}.`
      : `You're currently at a loss of ${cur(Math.abs(k.profit), k.currency)}. Expenses (${cur(
          k.totalExpenses,
          k.currency
        )}) are higher than revenue (${cur(k.totalRevenue, k.currency)}).`;
  }
  if (/(revenue|income|earn|sales|made today)/.test(q)) {
    if (q.includes("today")) {
      return `Today you've earned ${cur(k.todayRevenue, k.currency)} from ${k.todaySessions} sessions.`;
    }
    return `Total revenue so far is ${cur(k.totalRevenue, k.currency)} (rentals ${cur(
      k.sessionRevenue,
      k.currency
    )} + bills ${cur(k.billRevenue, k.currency)}).`;
  }
  if (/(expense|cost|spending|spend)/.test(q)) {
    const byCat: Record<string, number> = {};
    expenses.forEach((e) => (byCat[e.category] = (byCat[e.category] || 0) + e.amount));
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return `Total expenses: ${cur(k.totalExpenses, k.currency)}. Biggest categories: ${top
      .map(([c, v]) => `${c} (${cur(v, k.currency)})`)
      .join(", ")}.`;
  }
  if (/(best|top|highest|busiest|most profitable|popular).*(station|pc|ps|console)/.test(q) || /(best|top).*(station|pc|ps)/.test(q)) {
    const rev: Record<string, number> = {};
    sessions.forEach((s) => (rev[s.stationName] = (rev[s.stationName] || 0) + (s.totalCost || 0)));
    const top = Object.entries(rev).sort((a, b) => b[1] - a[1])[0];
    return top
      ? `Your best performing station is ${top[0]} with ${cur(top[1], k.currency)} in revenue. Consider expanding this category.`
      : `Not enough completed sessions yet to determine the top station.`;
  }
  if (/(busy|peak|popular time|best time|when).*(hour|time|day)/.test(q)) {
    const hourCounts: Record<number, number> = {};
    sessions.forEach((s) => {
      const h = new Date(s.startTime).getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    });
    const top = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    return top ? `Your peak time is around ${top[0]}:00 with ${top[1]} sessions starting then. Staff accordingly!` : `I don't have enough session timing data yet.`;
  }
  if (/(how many|count|number).*(session|rental|customer|active)/.test(q) || /(active|ongoing|now)/.test(q)) {
    return `Right now there are ${k.activeSessions} active session(s). You've recorded ${completed.length} completed sessions in total and issued ${bills.length} bills.`;
  }
  if (/(available|free|empty|open|vacant).*(station|pc|ps|seat)/.test(q)) {
    const free = stations.filter((s) => s.status === "available");
    return free.length > 0
      ? `${free.length} station(s) are free right now: ${free.map((s) => s.name).join(", ")}.`
      : `All stations are currently busy or under maintenance.`;
  }
  if (/(recommend|advice|suggest|improve|tip|grow|increase|boost)/.test(q)) {
    const tips = generateInsights(ctx)
      .filter((i) => i.type === "tip" || i.type === "warning")
      .slice(0, 2);
    if (tips.length) {
      return `Here's what I'd focus on:\n\n• ${tips[0].title}: ${tips[0].body}${
        tips[1] ? `\n\n• ${tips[1].title}: ${tips[1].body}` : ""
      }`;
    }
    return `To grow revenue: fill idle stations with promotions, push your best time slot, upsell snacks, and turn one-off customers into regulars with a loyalty program.`;
  }
  if (/(predict|forecast|future|next|expect|will i)/.test(q)) {
    const avgDaily = k.week.reduce((a, b) => a + b.value, 0) / 7;
    return `Based on this week's average of ${cur(avgDaily, k.currency)}/day, you're on track for roughly ${cur(
      avgDaily * 30,
      k.currency
    )} this month. Pushing occupancy up 10% could add ${cur(avgDaily * 0.1 * 30, k.currency)} more.`;
  }
  if (/(avg|average).*(session|value|spend|ticket)/.test(q)) {
    return `Your average session is worth ${cur(k.avgSessionValue, k.currency)} across ${completed.length} completed rentals.`;
  }
  if (/(thank|thx|shukran)/.test(q)) {
    return `You're welcome! Keep those controllers hot and the cash flowing. 🎮`;
  }
  return `I analyzed your studio: revenue ${cur(k.totalRevenue, k.currency)}, expenses ${cur(
    k.totalExpenses,
    k.currency
  )}, profit ${cur(k.profit, k.currency)}, ${k.activeSessions} active session(s). Ask me about profit, top stations, peak hours, expenses, or recommendations!`;
}
