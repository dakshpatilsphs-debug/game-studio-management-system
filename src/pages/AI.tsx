import { useMemo, useState, useRef, useEffect } from "react";
import { Send, Lightbulb, Brain, Bot, User, RefreshCw, FileDown } from "lucide-react";
import { useData } from "../lib/store";
import { generateInsights, aiChat, computeKPIs } from "../lib/ai";
import { generateInsightsPDF } from "../lib/pdf";
import { Card, SectionTitle, Button } from "../components/ui";
import { formatMoney } from "../lib/format";
import { cn } from "../utils/cn";

const TYPE_STYLES: Record<string, { ring: string; bg: string; text: string }> = {
  success: { ring: "ring-free/20", bg: "from-free/10", text: "text-free" },
  warning: { ring: "ring-warn/20", bg: "from-warn/10", text: "text-warn" },
  info: { ring: "ring-occupied/20", bg: "from-occupied/10", text: "text-occupied" },
  tip: { ring: "ring-free/20", bg: "from-free/10", text: "text-free" },
  danger: { ring: "ring-danger/20", bg: "from-danger/10", text: "text-danger" },
};

interface Msg {
  role: "user" | "ai";
  text: string;
}

const SUGGESTIONS = [
  "How much profit did I make?",
  "What's my best station?",
  "When are my peak hours?",
  "How can I grow revenue?",
  "Forecast next month",
  "What are my biggest expenses?",
];

export default function AI() {
  const { sessions, stations, expenses, bills, settings } = useData();
  const cur = settings.currency;
  const ctx = { sessions, stations, expenses, bills, settings };

  const insights = useMemo(() => generateInsights(ctx), [sessions, stations, expenses, bills, settings]);
  const k = useMemo(() => computeKPIs(ctx), [sessions, expenses, bills, stations, settings]);

  const [messages, setMessages] = useState<Msg[]>([
    { role: "ai", text: "👋 Hi! I'm your lounge AI. I've analyzed your data and generated insights below. Ask me anything about revenue, expenses, or performance." },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  function ask(q: string) {
    const question = q.trim();
    if (!question) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setMessages((m) => [...m, { role: "ai", text: aiChat(question, ctx) }]);
      setTyping(false);
    }, 650 + Math.random() * 500);
  }

  const avgDaily = k.week.reduce((a, b) => a + b.value, 0) / 7;

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden p-6">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-free/10 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-free/15 ring-1 ring-free/30">
            <Brain className="h-7 w-7 text-free" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl font-bold text-ink">Lounge AI Assistant</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-occupied/10 px-2.5 py-0.5 text-xs font-medium text-occupied ring-1 ring-inset ring-occupied/30">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-occupied" /> Online
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted">Analyzes rentals, revenue & expenses in real time to surface opportunities, predict trends, and answer your questions.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniStat label="Net profit" value={formatMoney(k.profit, cur)} good={k.profit >= 0} />
              <MiniStat label="Avg / day" value={formatMoney(avgDaily, cur)} good />
              <MiniStat label="Active now" value={String(k.activeSessions)} good />
              <MiniStat label="Margin" value={`${k.margin.toFixed(0)}%`} good={k.margin >= 20} />
            </div>
          </div>
        </div>
      </Card>

      <div>
        <SectionTitle
          title="AI-Generated Insights"
          subtitle="Smart observations & recommendations from your data"
          icon={<Lightbulb className="h-5 w-5" />}
          action={insights.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => generateInsightsPDF(settings.studioName, cur, settings.logo, insights, { revenue: k.totalRevenue, expenses: k.totalExpenses, profit: k.profit, margin: k.margin })}>
              <FileDown className="h-4 w-4" /> Export PDF
            </Button>
          )}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {insights.map((ins) => {
            const st = TYPE_STYLES[ins.type] || TYPE_STYLES.info;
            return (
              <Card key={ins.id} className={cn("bg-gradient-to-br to-transparent p-4 ring-1 ring-inset", st.bg, st.ring)}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xl">{ins.icon}</span>
                  <h3 className={cn("font-display text-sm font-semibold", st.text)}>{ins.title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted">{ins.body}</p>
              </Card>
            );
          })}
        </div>
      </div>

      <Card className="flex h-[560px] flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-free" />
            <h3 className="font-display text-sm font-semibold text-ink">Chat with AI</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setMessages([messages[0]])}>
            <RefreshCw className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", m.role === "ai" ? "bg-free/15 text-free" : "bg-panel2 text-muted")}>
                {m.role === "ai" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div className={cn("max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed", m.role === "ai" ? "rounded-tl-sm bg-panel2 text-ink" : "rounded-tr-sm bg-free text-canvas")}>
                {m.text}
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-free/15 text-free"><Bot className="h-4 w-4" /></div>
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-panel2 px-4 py-3">
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted" />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-hairline px-5 pt-3">
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => ask(s)} className="rounded-full border border-hairline bg-panel2 px-3 py-1 text-xs text-muted transition hover:border-free/40 hover:text-ink">
                {s}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex items-center gap-2 p-4">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about profit, peak hours, expenses…" className="flex-1 rounded-xl border border-hairline bg-panel2 px-4 py-2.5 text-sm text-ink outline-none transition focus:border-free/50 focus:ring-2 focus:ring-free/20" />
          <Button type="submit" disabled={!input.trim() || typing}><Send className="h-4 w-4" /></Button>
        </form>
      </Card>
    </div>
  );
}

function MiniStat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-xl border border-hairline bg-panel2 px-3 py-1.5">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={cn("mono text-sm font-bold", good ? "text-free" : "text-danger")}>{value}</p>
    </div>
  );
}
