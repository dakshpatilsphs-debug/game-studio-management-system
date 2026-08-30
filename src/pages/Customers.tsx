import { useMemo, useState } from "react";
import {
  Users,
  UserPlus,
  Phone,
  Trash2,
  Pencil,
  Search,
  History,
  Wallet,
} from "lucide-react";
import { useData } from "../lib/store";
import { useToast } from "../components/Toaster";
import {
  Card,
  Button,
  Badge,
  Modal,
  Input,
  SectionTitle,
  EmptyState,
  StatCard,
} from "../components/ui";
import { formatMoney, formatDateTime } from "../lib/format";
import type { Customer } from "../lib/types";

export default function Customers() {
  const { customers, sessions, settings, addCustomer, updateCustomer, deleteCustomer } = useData();
  const { toast } = useToast();
  const cur = settings.currency;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [viewing, setViewing] = useState<Customer | null>(null);
  const [query, setQuery] = useState("");

  const spentByCustomer = useMemo(() => {
    const map: Record<string, number> = {};
    sessions.forEach((s) => {
      if (s.status !== "completed") return;
      const key = s.customerId || s.customerName.toLowerCase();
      map[key] = (map[key] || 0) + (s.totalCost || 0);
    });
    return map;
  }, [sessions]);

  const filtered = customers.filter(
    (c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query)
  );

  const totalPrepaid = customers.reduce((s, c) => s + c.prepaidBalance, 0);
  const totalVisits = customers.reduce((s, c) => s + c.totalVisits, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Customers" value={String(customers.length)} icon={<Users className="h-5 w-5" />} accent="free" />
        <StatCard label="Total Visits" value={String(totalVisits)} icon={<History className="h-5 w-5" />} accent="occupied" />
        <StatCard label="Prepaid Balances" value={formatMoney(totalPrepaid, cur)} icon={<Wallet className="h-5 w-5" />} accent="warn" />
      </div>

      <Card className="p-5">
        <SectionTitle
          title="Customer Log"
          subtitle="Track visits, contact & prepaid balances"
          icon={<Users className="h-5 w-5" />}
          action={
            <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
              <UserPlus className="h-4 w-4" /> Add Customer
            </Button>
          }
        />

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or phone…"
            className="w-full rounded-xl border border-hairline bg-panel2 py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-free/50 sm:w-72"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title={customers.length === 0 ? "No customers yet" : "No matches"}
            body={customers.length === 0 ? "Add your first customer to start a visit log." : "Try a different search."}
            action={customers.length === 0 ? <Button onClick={() => { setEditing(null); setOpen(true); }}><UserPlus className="h-4 w-4" /> Add Customer</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs uppercase tracking-wide text-muted">
                  <th className="pb-3 pr-3 font-medium">Name</th>
                  <th className="pb-3 pr-3 font-medium">Phone</th>
                  <th className="pb-3 pr-3 text-center font-medium">Visits</th>
                  <th className="pb-3 pr-3 text-right font-medium">Spent</th>
                  <th className="pb-3 pr-3 text-right font-medium">Prepaid</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-hairline/50 last:border-0 hover:bg-panel2/50">
                    <td className="py-3 pr-3">
                      <button onClick={() => setViewing(c)} className="font-medium text-ink hover:text-free">
                        {c.name}
                      </button>
                    </td>
                    <td className="py-3 pr-3 text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" /> {c.phone || "—"}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-center">
                      <Badge tone="muted">{c.totalVisits}</Badge>
                    </td>
                    <td className="mono py-3 pr-3 text-right text-ink">{formatMoney(spentByCustomer[c.id] || spentByCustomer[c.name.toLowerCase()] || 0, cur)}</td>
                    <td className="mono py-3 pr-3 text-right">{c.prepaidBalance > 0 ? <span className="text-warn">{formatMoney(c.prepaidBalance, cur)}</span> : <span className="text-muted">—</span>}</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => { setEditing(c); setOpen(true); }} className="rounded p-1.5 text-muted hover:text-ink"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => { if (confirm(`Delete ${c.name}?`)) { deleteCustomer(c.id); toast("Customer deleted", "danger"); } }} className="rounded p-1.5 text-muted hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CustomerModal
        open={open}
        onClose={() => setOpen(false)}
        editing={editing}
        onSave={(data, id) => {
          if (id) { updateCustomer(id, data); toast("Customer updated", "free"); }
          else { addCustomer({ name: data.name!, phone: data.phone || "", prepaidBalance: data.prepaidBalance || 0 }); toast("Customer added", "free"); }
          setOpen(false);
        }}
      />

      {viewing && (
        <CustomerHistory
          customer={viewing}
          spent={spentByCustomer[viewing.id] || spentByCustomer[viewing.name.toLowerCase()] || 0}
          sessions={sessions.filter((s) => s.customerId === viewing.id || s.customerName.toLowerCase() === viewing.name.toLowerCase())}
          cur={cur}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

function CustomerModal({
  open,
  onClose,
  editing,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  editing: Customer | null;
  onSave: (data: Partial<Customer>, id?: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [balance, setBalance] = useState("0");

  useMemo(() => {
    if (open) {
      setName(editing?.name || "");
      setPhone(editing?.phone || "");
      setBalance(String(editing?.prepaidBalance || 0));
    }
  }, [open, editing]);

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit Customer" : "Add Customer"}>
      <div className="space-y-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Arjun Mehta" autoFocus />
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 98765 43210" />
        <Input label="Prepaid balance" type="number" mono value={balance} onChange={(e) => setBalance(e.target.value)} />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), phone: phone.trim(), prepaidBalance: Number(balance) || 0 }, editing?.id)}>
            {editing ? "Save" : "Add Customer"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CustomerHistory({
  customer,
  spent,
  sessions,
  cur,
  onClose,
}: {
  customer: Customer;
  spent: number;
  sessions: import("../lib/types").GameSession[];
  cur: string;
  onClose: () => void;
}) {
  const history = [...sessions].sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
  return (
    <Modal open={!!customer} onClose={onClose} title={customer.name} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Mini label="Phone" value={customer.phone || "—"} />
          <Mini label="Visits" value={String(customer.totalVisits)} />
          <Mini label="Lifetime spend" value={formatMoney(spent, cur)} />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-muted">Visit history</p>
          {history.length === 0 ? (
            <p className="rounded-xl border border-dashed border-hairline py-8 text-center text-sm text-muted">No sessions recorded yet.</p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {history.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border border-hairline bg-panel2 px-4 py-2.5 text-sm">
                  <Badge color={s.status}>{s.status}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-ink">{s.stationName} • {s.type}</p>
                    <p className="text-xs text-muted">{s.endTime ? formatDateTime(s.endTime) : formatDateTime(s.startTime)}{s.paymentMethod ? ` • ${s.paymentMethod}` : ""}</p>
                  </div>
                  <span className="mono font-semibold text-ink">{formatMoney(s.totalCost || 0, cur)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-panel2 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mono mt-1 font-semibold text-ink">{value}</p>
    </div>
  );
}
