import { useMemo, useState, useEffect } from "react";
import { Receipt, Plus, Trash2, Pencil, TrendingDown, Wallet, Calendar } from "lucide-react";
import { useData } from "../lib/store";
import {
  Card,
  Button,
  Badge,
  Modal,
  Input,
  Select,
  Textarea,
  SectionTitle,
  EmptyState,
  StatCard,
} from "../components/ui";
import { formatMoney, formatDate, startOfDay } from "../lib/format";
import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategory } from "../lib/types";

const CAT_COLORS: Record<string, string> = {
  Rent: "#8b5cf6",
  Electricity: "#f59e0b",
  Maintenance: "#06b6d4",
  Equipment: "#ec4899",
  Salary: "#22c55e",
  "Snacks & Drinks": "#ef4444",
  Internet: "#3b82f6",
  Marketing: "#a855f7",
  Other: "#64748b",
};

export default function Expenses() {
  const { expenses, settings, addExpense, updateExpense, deleteExpense } = useData();
  const cur = settings.currency;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const monthStart = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }, []);

  const sorted = useMemo(
    () => [...expenses].sort((a, b) => b.date - a.date),
    [expenses]
  );

  const filtered = filter === "all" ? sorted : sorted.filter((e) => e.category === filter);

  const totalAll = expenses.reduce((s, e) => s + e.amount, 0);
  const totalMonth = expenses.filter((e) => e.date >= monthStart).reduce((s, e) => s + e.amount, 0);
  const todayTotal = expenses
    .filter((e) => startOfDay(e.date) === startOfDay(Date.now()))
    .reduce((s, e) => s + e.amount, 0);

  const byCat = useMemo(() => {
    const m: Record<string, number> = {};
    expenses.forEach((e) => (m[e.category] = (m[e.category] || 0) + e.amount));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="This Month" value={formatMoney(totalMonth, cur)} icon={<Calendar className="h-5 w-5" />} accent="rose" delta={`${expenses.filter((e) => e.date >= monthStart).length} expenses`} />
        <StatCard label="Today" value={formatMoney(todayTotal, cur)} icon={<Wallet className="h-5 w-5" />} accent="amber" />
        <StatCard label="All Time" value={formatMoney(totalAll, cur)} icon={<TrendingDown className="h-5 w-5" />} accent="violet" delta={`${expenses.length} records`} />
      </div>

      <Card className="p-5">
        <SectionTitle
          title="Expenses"
          subtitle="Track every cost running your studio"
          icon={<Receipt className="h-5 w-5" />}
          action={
            <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="h-4 w-4" /> Add Expense
            </Button>
          }
        />

        {/* Category filter chips */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === "all" ? "bg-free text-canvas" : "bg-panel2 text-muted hover:bg-panel2"
            }`}
          >
            All ({expenses.length})
          </button>
          {EXPENSE_CATEGORIES.map((c) => {
            const count = expenses.filter((e) => e.category === c).length;
            if (count === 0) return null;
            return (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  filter === c ? "bg-free text-canvas" : "bg-panel2 text-muted hover:bg-panel2"
                }`}
              >
                {c} ({count})
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-6 w-6" />}
            title="No expenses recorded"
            body="Add rent, electricity, equipment and other costs to see them here."
            action={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Add Expense</Button>}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((e) => (
              <div key={e.id} className="group flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ background: (CAT_COLORS[e.category] || "#64748b") + "22" }}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: CAT_COLORS[e.category] || "#64748b" }} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{e.description}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Badge>{e.category}</Badge>
                    <span>{formatDate(e.date)}</span>
                    {e.note && <span className="truncate">• {e.note}</span>}
                  </div>
                </div>
                <p className="font-semibold text-rose-300">-{formatMoney(e.amount, cur)}</p>
                <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => { setEditing(e); setOpen(true); }} className="rounded p-1.5 text-slate-500 hover:text-white">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => { if (confirm("Delete this expense?")) deleteExpense(e.id); }} className="rounded p-1.5 text-slate-500 hover:text-rose-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {byCat.length > 0 && (
        <Card className="p-5">
          <SectionTitle title="Spending by Category" icon={<TrendingDown className="h-5 w-5" />} />
          <div className="space-y-3">
            {byCat.map(([cat, amount]) => {
              const pct = totalAll > 0 ? (amount / totalAll) * 100 : 0;
              return (
                <div key={cat}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-slate-300">{cat}</span>
                    <span className="text-slate-400">
                      {formatMoney(amount, cur)} <span className="text-slate-500">({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CAT_COLORS[cat] || "#64748b" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <ExpenseModal
        open={open}
        onClose={() => setOpen(false)}
        editing={editing}
        defaultTax={0}
        onSave={(data, id) => {
          if (id) updateExpense(id, data);
          else addExpense(data as Omit<Expense, "id">);
          setOpen(false);
        }}
      />
    </div>
  );
}

function ExpenseModal({
  open,
  onClose,
  editing,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  editing: Expense | null;
  defaultTax: number;
  onSave: (data: Partial<Expense>, id?: string) => void;
}) {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("Rent");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      if (editing) {
        setDescription(editing.description);
        setCategory(editing.category);
        setAmount(String(editing.amount));
        setDate(new Date(editing.date).toISOString().slice(0, 10));
        setNote(editing.note || "");
      } else {
        setDescription("");
        setCategory("Rent");
        setAmount("");
        setDate(new Date().toISOString().slice(0, 10));
        setNote("");
      }
    }
  }, [open, editing]);

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit Expense" : "Add Expense"}>
      <div className="space-y-4">
        <Input label="Description" placeholder="e.g. Monthly shop rent" value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <Input label="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </div>
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Textarea label="Note (optional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!description.trim() || !amount}
            onClick={() =>
              onSave(
                {
                  description: description.trim(),
                  category,
                  amount: Number(amount) || 0,
                  date: date ? new Date(date).getTime() : Date.now(),
                  note: note.trim() || undefined,
                },
                editing?.id
              )
            }
          >
            {editing ? "Save Changes" : "Add Expense"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
