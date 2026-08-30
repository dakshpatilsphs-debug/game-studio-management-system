import { useMemo, useState } from "react";
import {
  Gamepad2,
  Plus,
  Trash2,
  Pencil,
  Wrench,
  Power,
  Search,
  Clock,
} from "lucide-react";
import { useData } from "../lib/store";
import { useToast } from "../components/Toaster";
import {
  Card,
  Button,
  StatusBadge,
  Modal,
  Input,
  Select,
  SectionTitle,
  EmptyState,
} from "../components/ui";
import { formatMoney, formatDuration, formatDateTime } from "../lib/format";
import { STATION_TYPES, type Station, type StationType } from "../lib/types";

export default function Rentals() {
  const { stations, sessions, settings, addStation, updateStation, deleteStation, deleteSession } = useData();
  const { toast } = useToast();
  const cur = settings.currency;

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Station | null>(null);
  const [query, setQuery] = useState("");

  const completed = useMemo(
    () => sessions.filter((s) => s.status === "completed").sort((a, b) => (b.endTime || 0) - (a.endTime || 0)),
    [sessions]
  );
  const filtered = completed.filter(
    (s) => s.customerName.toLowerCase().includes(query.toLowerCase()) || s.stationName.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <SectionTitle
          title="Stations"
          subtitle="Manage your PCs, consoles & rigs"
          icon={<Gamepad2 className="h-5 w-5" />}
          action={<Button size="sm" onClick={() => { setEditing(null); setModal(true); }}><Plus className="h-4 w-4" /> Add Station</Button>}
        />
        {stations.length === 0 ? (
          <EmptyState icon={<Gamepad2 className="h-6 w-6" />} title="No stations yet" body="Add your PCs, PS5s and other rigs to start renting." action={<Button onClick={() => { setEditing(null); setModal(true); }}><Plus className="h-4 w-4" /> Add your first station</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs uppercase tracking-wide text-muted">
                  <th className="pb-3 pr-3 font-medium">Station</th>
                  <th className="pb-3 pr-3 font-medium">Type</th>
                  <th className="pb-3 pr-3 font-medium">Status</th>
                  <th className="pb-3 pr-3 text-right font-medium">Rate</th>
                  <th className="pb-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stations.map((s) => (
                  <tr key={s.id} className="border-b border-hairline/50 last:border-0 hover:bg-panel2/50">
                    <td className="py-3 pr-3">
                      <p className="font-display font-semibold text-ink">{s.name}</p>
                      {s.specs && <p className="text-xs text-muted">{s.specs}</p>}
                    </td>
                    <td className="py-3 pr-3 text-muted">{s.type}</td>
                    <td className="py-3 pr-3"><StatusBadge status={s.status} label={s.status === "available" ? "Free" : s.status === "rented" ? "Occupied" : "Maintenance"} /></td>
                    <td className="mono py-3 pr-3 text-right text-ink">{formatMoney(s.hourlyRate, cur)}/hr</td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-1">
                        {s.status !== "rented" && (
                          <button
                            onClick={() => { updateStation(s.id, { status: s.status === "maintenance" ? "available" : "maintenance" }); toast(s.status === "maintenance" ? "Marked free" : "Marked maintenance", s.status === "maintenance" ? "free" : "warn"); }}
                            className="inline-flex items-center gap-1 rounded-lg border border-hairline px-2 py-1 text-xs text-muted hover:text-ink"
                            title="Toggle maintenance"
                          >
                            {s.status === "maintenance" ? <Power className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}
                          </button>
                        )}
                        <button onClick={() => { setEditing(s); setModal(true); }} className="rounded p-1.5 text-muted hover:text-ink"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => { if (confirm(`Delete ${s.name}?`)) { deleteStation(s.id); toast("Station deleted", "danger"); } }} className="rounded p-1.5 text-muted hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <SectionTitle title="Session History" subtitle={`${completed.length} completed`} icon={<Clock className="h-5 w-5" />} />
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer or station…" className="w-full rounded-xl border border-hairline bg-panel2 py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-free/50 sm:w-72" />
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={<Clock className="h-6 w-6" />} title="No completed sessions" body="Ended sessions appear here with payment details." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs uppercase tracking-wide text-muted">
                  <th className="pb-3 pr-3 font-medium">Customer</th>
                  <th className="pb-3 pr-3 font-medium">Station</th>
                  <th className="pb-3 pr-3 font-medium">Duration</th>
                  <th className="pb-3 pr-3 font-medium">Paid</th>
                  <th className="pb-3 pr-3 font-medium">When</th>
                  <th className="pb-3 pr-3 text-right font-medium">Amount</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 60).map((s) => (
                  <tr key={s.id} className="border-b border-hairline/50 last:border-0">
                    <td className="py-3 pr-3 font-medium text-ink">{s.customerName}</td>
                    <td className="py-3 pr-3 text-muted">{s.stationName}</td>
                    <td className="mono py-3 pr-3 text-muted">{formatDuration(s.startTime, s.endTime)}</td>
                    <td className="py-3 pr-3"><StatusBadge status="completed" label={s.paymentMethod || "—"} /></td>
                    <td className="py-3 pr-3 text-muted">{s.endTime ? formatDateTime(s.endTime) : "—"}</td>
                    <td className="mono py-3 pr-3 text-right font-semibold text-free">{formatMoney(s.totalCost, cur)}</td>
                    <td className="py-3 text-right"><button onClick={() => { if (confirm("Delete this session?")) deleteSession(s.id); }} className="rounded p-1 text-muted hover:text-danger"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <StationModal
        open={modal}
        onClose={() => setModal(false)}
        editing={editing}
        onSave={(data, id) => {
          if (id) { updateStation(id, data); toast("Station updated", "free"); }
          else { addStation(data as Omit<Station, "id">); toast("Station added", "free"); }
          setModal(false);
        }}
      />
    </div>
  );
}

function StationModal({
  open,
  onClose,
  editing,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  editing: Station | null;
  onSave: (data: Partial<Station>, id?: string) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<StationType>("PC");
  const [rate, setRate] = useState("60");
  const [specs, setSpecs] = useState("");

  useMemo(() => {
    if (open) {
      setName(editing?.name || "");
      setType(editing?.type || "PC");
      setRate(String(editing?.hourlyRate ?? 60));
      setSpecs(editing?.specs || "");
    }
  }, [open, editing]);

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit Station" : "Add Station"}>
      <div className="space-y-4">
        <Input label="Station name" placeholder="e.g. PC-01" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value as StationType)}>
            {STATION_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
          </Select>
          <Input label="Hourly rate" type="number" mono value={rate} onChange={(e) => setRate(e.target.value)} />
        </div>
        <Input label="Specs (optional)" value={specs} onChange={(e) => setSpecs(e.target.value)} placeholder="e.g. RTX 4080 • i9 • 32GB" />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), type, hourlyRate: Number(rate) || 0, specs: specs.trim() || undefined, status: "available" as const }, editing?.id)}>
            {editing ? "Save Changes" : "Add Station"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
