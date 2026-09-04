import { useMemo, useState, useEffect } from "react";
import {
  FileText,
  Plus,
  Trash2,
  Eye,
  Printer,
  X,
  ShoppingBag,
  FileDown,
  Download,
} from "lucide-react";
import { generateBillPDF, generateAllBillsPDF, generateSessionReceiptPDF } from "../lib/pdf";
import { useData } from "../lib/store";
import { UPIQR } from "../components/UPIQR";
import {
  Card,
  Button,
  Badge,
  Modal,
  Input,
  Select,
  SectionTitle,
  EmptyState,
  StatCard,
} from "../components/ui";
import { formatMoney, formatDateTime, formatAmountInWords } from "../lib/format";
import type { Bill, BillItem, Settings } from "../lib/types";

// Luxury invoice color palette (matches pdf.ts)
const LUX_INK = "#1a1a1a";
const LUX_GRAPHITE = "#404040";
const LUX_GREY = "#8a8a8a";
const LUX_GOLD = "#B8945F";
const LUX_GOLDD = "#967842";
const LUX_LINE = "#e4ded2";
const LUX_WHITE = "#ffffff";

export default function Bills() {
  const { bills, sessions, customers, settings, addBill, deleteBill } = useData();
  const cur = settings.currency;
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<Bill | null>(null);

  const recentCustomers = useMemo(() => {
    const names = [...customers.map((c) => c.name), ...sessions.map((s) => s.customerName)].filter(Boolean) as string[];
    return [...new Set(names)].slice(0, 50);
  }, [customers, sessions]);

  const sorted = useMemo(() => [...bills].sort((a, b) => b.createdAt - a.createdAt), [bills]);
  const totalRevenue = bills.reduce((s, b) => s + b.total, 0);
  const todayRevenue = bills
    .filter((b) => new Date(b.createdAt).toDateString() === new Date().toDateString())
    .reduce((s, b) => s + b.total, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Billed" value={formatMoney(totalRevenue, cur)} icon={<FileText className="h-5 w-5" />} accent="violet" delta={`${bills.length} invoices`} />
        <StatCard label="Today's Bills" value={formatMoney(todayRevenue, cur)} icon={<ShoppingBag className="h-5 w-5" />} accent="emerald" />
        <StatCard
          label="Avg Bill Value"
          value={formatMoney(bills.length ? totalRevenue / bills.length : 0, cur)}
          icon={<ShoppingBag className="h-5 w-5" />}
          accent="cyan"
        />
      </div>

      <Card className="p-5">
        <SectionTitle
          title="Invoices & Bills"
          subtitle="Generate invoices for customers"
          icon={<FileText className="h-5 w-5" />}
          action={
            <div className="flex gap-2">
              {bills.length > 0 && (
                <Button size="sm" variant="outline" onClick={async () => await generateAllBillsPDF(bills, settings)}>
                  <Download className="h-4 w-4" /> All PDF
                </Button>
              )}
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> New Bill
              </Button>
            </div>
          }
        />
        {sorted.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="No bills yet"
            body="Create invoices for rentals, snacks, and other purchases."
            action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Create Bill</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-3 pr-3 font-medium">Bill #</th>
                  <th className="pb-3 pr-3 font-medium">Customer</th>
                  <th className="pb-3 pr-3 font-medium">Date</th>
                  <th className="pb-3 pr-3 font-medium">Payment</th>
                  <th className="pb-3 pr-3 text-right font-medium">Total</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((b) => (
                  <tr key={b.id} className="border-b border-white/5 last:border-0">
                    <td className="py-3 pr-3">
                      <span className="mono text-xs text-free">{b.billNumber}</span>
                      {b.fromSession && <span className="ml-2 rounded bg-occupied/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-occupied">Session</span>}
                    </td>
                    <td className="py-3 pr-3 font-medium text-white">{b.customerName}</td>
                    <td className="py-3 pr-3 text-slate-400">{formatDateTime(b.createdAt)}</td>
                    <td className="py-3 pr-3"><Badge>{b.paymentMethod}</Badge></td>
                    <td className="py-3 pr-3 mono text-right font-semibold text-free">{formatMoney(b.total, cur)}</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setViewing(b)} className="rounded p-1.5 text-slate-500 hover:text-white">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={async () => {
                            if (b.fromSession) {
                              await generateSessionReceiptPDF(b, settings);
                            } else {
                              await generateBillPDF(b, settings);
                            }
                          }}
                          className="rounded p-1.5 text-muted hover:text-free"
                          title="Download PDF"
                        >
<FileDown className="h-4 w-4" />
                        </button>
                        <button onClick={() => { if (confirm("Delete this bill?")) deleteBill(b.id); }} className="rounded p-1.5 text-slate-500 hover:text-rose-400">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreateBillModal
        open={open}
        onClose={() => setOpen(false)}
        currency={cur}
        defaultTax={settings.taxRate}
        nextNumber={bills.length + 1}
        recentCustomers={recentCustomers}
        onCreate={(bill) => {
          addBill(bill);
          setOpen(false);
        }}
      />

      <BillViewModal bill={viewing} settings={settings} onClose={() => setViewing(null)} />
    </div>
  );
}

function CreateBillModal({
  open,
  onClose,
  currency,
  defaultTax,
  nextNumber,
  recentCustomers,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  currency: string;
  defaultTax: number;
  nextNumber: number;
  recentCustomers: string[];
  onCreate: (bill: Omit<Bill, "id">) => void;
}) {
  const [customer, setCustomer] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [items, setItems] = useState<BillItem[]>([{ description: "", qty: 1, price: 0 }]);
  const [taxRate, setTaxRate] = useState(String(defaultTax));
  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [clientCompany, setClientCompany] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setCustomer("");
      setBillNumber(`LUX-${new Date().getFullYear()}-${String(nextNumber).padStart(3, "0")}`);
      setItems([{ description: "", qty: 1, price: 0 }]);
      setTaxRate(String(defaultTax));
      setDiscount("0");
      setPaymentMethod("Cash");
      setClientCompany("");
      setClientAddress("");
      setNote("");
      // default due date = issue + 7 days
      const d = new Date(Date.now() + 7 * 86400000);
      setDueDate(d.toISOString().slice(0, 10));
    }
  }, [open, nextNumber, defaultTax]);

  const subtotal = items.reduce((s, it) => s + it.qty * it.price, 0);
  const taxAmount = (subtotal * (Number(taxRate) || 0)) / 100;
  const total = Math.max(0, subtotal + taxAmount - (Number(discount) || 0));

  function updateItem(i: number, patch: Partial<BillItem>) {
    setItems((p) => p.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Bill" wide>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Input label="Customer name" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="e.g. Alex Rivera" list="customers" autoFocus />
            <datalist id="customers">
              {recentCustomers.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Bill #" value={billNumber} onChange={(e) => setBillNumber(e.target.value)} />
            <Select label="Payment" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option>Cash</option>
              <option>Card</option>
              <option>UPI / Transfer</option>
              <option>Wallet</option>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Client company (optional)" value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} placeholder="e.g. Acme Pvt Ltd" />
          <Input label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <Input label="Client address (optional)" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} placeholder="Street, City, ZIP" />

        {/* Note field */}
        <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Additional notes for the invoice" />

        {/* line items */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">Items</span>
            <Button size="sm" variant="outline" onClick={() => setItems((p) => [...p, { description: "", qty: 1, price: 0 }])}>
              <Plus className="h-3.5 w-3.5" /> Add item
            </Button>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <div className="mb-2 hidden grid-cols-12 gap-2 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 sm:grid">
              <span className="col-span-6">Description</span><span className="col-span-2 text-center">Qty</span><span className="col-span-2 text-right">Price</span><span className="col-span-2 text-right">Total</span>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 items-center gap-2">
                  <input
                    value={it.description}
                    onChange={(e) => updateItem(i, { description: e.target.value })}
                    placeholder="Description"
                    className="col-span-12 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50 sm:col-span-6"
                  />
                  <input
                    type="number"
                    value={it.qty}
                    onChange={(e) => updateItem(i, { qty: Number(e.target.value) || 0 })}
                    className="col-span-4 rounded-lg border border-white/10 bg-slate-900/60 px-2 py-2 text-sm text-white outline-none focus:border-violet-500/50 sm:col-span-2"
                    placeholder="Qty"
                  />
                  <input
                    type="number"
                    value={it.price}
                    onChange={(e) => updateItem(i, { price: Number(e.target.value) || 0 })}
                    placeholder="Price"
                    className="col-span-4 rounded-lg border border-white/10 bg-slate-900/60 px-2 py-2 text-sm text-white outline-none focus:border-violet-500/50 sm:col-span-2"
                  />
                  <div className="col-span-4 flex items-center justify-end gap-1 sm:col-span-2">
                    <span className="hidden text-sm text-slate-300 sm:block">{formatMoney(it.qty * it.price, currency)}</span>
                    <span className="text-xs text-slate-400 sm:hidden">{formatMoney(it.qty * it.price, currency)}</span>
                    {items.length > 1 ? (
                      <button onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))} className="rounded p-1.5 text-slate-500 hover:text-rose-400">
                        <X className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="w-7" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Discount" type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          <Input label="Tax rate (%)" type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
        </div>

        {/* totals */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex justify-between py-1 text-sm text-slate-400"><span>Subtotal</span><span>{formatMoney(subtotal, currency)}</span></div>
          <div className="flex justify-between py-1 text-sm text-slate-400"><span>Tax ({Number(taxRate) || 0}%)</span><span>{formatMoney(taxAmount, currency)}</span></div>
          <div className="flex justify-between py-1 text-sm text-slate-400"><span>Discount</span><span>-{formatMoney(Number(discount) || 0, currency)}</span></div>
          <div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-base font-bold text-white">
            <span>Total</span><span>{formatMoney(total, currency)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!customer.trim() || items.every((it) => !it.description.trim())}
            onClick={() =>
              onCreate({
                billNumber: billNumber.trim() || `LUX-${new Date().getFullYear()}-${String(nextNumber).padStart(3, "0")}`,
                customerName: customer.trim(),
                items: items.filter((it) => it.description.trim()),
                subtotal,
                taxRate: Number(taxRate) || 0,
                taxAmount,
                discount: Number(discount) || 0,
                total,
                paymentMethod,
                createdAt: Date.now(),
                clientCompany: clientCompany.trim() || undefined,
                clientAddress: clientAddress.trim() || undefined,
                dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
                note: note.trim() || undefined,
              })
            }
          >
            <FileText className="h-4 w-4" /> Create Bill
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function BillViewModal({
  bill,
  settings,
  onClose,
}: {
  bill: Bill | null;
  settings: Settings;
  onClose: () => void;
}) {
  if (!bill) return null;
  const cur = settings.currency;
  const pdfSym = cur === "₹" || cur === "₨" ? "Rs. " : cur;
  const fmtMoney = (amt: number) => `${pdfSym}${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const issue = fmtDate(bill.createdAt);
  const due = bill.dueDate ? fmtDate(bill.dueDate) : "Upon receipt";
  const isReceipt = !!bill.fromSession;

  const handleDownload = async () => {
    if (isReceipt) await generateSessionReceiptPDF(bill, settings);
    else await generateBillPDF(bill, settings);
  };

  return (
    <Modal open={!!bill} onClose={onClose} title={`${isReceipt ? "Receipt" : "Invoice"} ${bill.billNumber}`} wide>
      <div className="space-y-4">
        {/* Document preview - faithful to PDF, scrollable on small screens */}
        <div className="print-bill overflow-hidden rounded-2xl border border-[#e4ded2] bg-white text-[#1a1a1a]">
          <div className="border-t-4 border-[#B8945F]" />
          <div className="overflow-x-auto">
            <div className={isReceipt ? "min-w-[640px] px-6 py-6 sm:px-8 sm:py-7" : "min-w-[680px] px-6 py-6 sm:px-10 sm:py-9"} style={{ fontFamily: "'Times New Roman', Times, serif" }}>
              {isReceipt ? (
                <>
                  {/* RECEIPT HEADER - matches pdf.ts drawSessionReceipt */}
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex items-start gap-3">
                      {settings.logo && <img src={settings.logo} alt={settings.studioName} className="h-12 w-12 rounded-md object-cover" style={{ border: "2px solid white", borderRadius: "4px" }} />}
                      <div>
                        <p className="font-serif text-xl font-bold leading-tight" style={{ color: LUX_INK }}>{settings.studioName}</p>
                        {(settings.businessAddress || settings.businessEmail || settings.businessPhone) && (
                          <p className="mt-1 text-[10px] uppercase tracking-[0.12em]" style={{ color: LUX_GREY }}>
                            {[settings.businessAddress, settings.businessEmail, settings.businessPhone].filter(Boolean).join("   ·   ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-sans text-lg font-bold tracking-[0.35em]" style={{ color: LUX_GOLDD }}>RECEIPT</p>
                      <div className="mt-2 space-y-1 text-xs">
                        <div className="flex items-center justify-end gap-6"><span className="text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: LUX_GREY }}>Receipt No.</span><span className="font-serif text-sm" style={{ color: LUX_INK }}>{bill.billNumber}</span></div>
                        <div className="flex items-center justify-end gap-6"><span className="text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: LUX_GREY }}>Date</span><span className="font-serif text-sm" style={{ color: LUX_INK }}>{issue}</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 border-t" style={{ borderColor: LUX_LINE }} />

                  {/* RECEIVED FROM + AMOUNT - fixed spread with boxed amount */}
                  <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_180px]">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: LUX_GOLDD }}>RECEIVED FROM</p>
                      <p className="mt-1.5 font-serif text-lg font-bold" style={{ color: LUX_INK }}>{bill.customerName}</p>
                      {bill.clientCompany && <p className="font-serif text-sm" style={{ color: LUX_GRAPHITE }}>{bill.clientCompany}</p>}
                      {bill.note && <p className="mt-2 font-serif text-sm italic" style={{ color: LUX_GREY }}>Note: {bill.note}</p>}
                    </div>
                    <div className="rounded-xl border bg-[#fefdfb] px-4 py-3 text-center" style={{ borderColor: LUX_LINE }}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: LUX_GOLDD }}>AMOUNT RECEIVED</p>
                      <p className="mt-1 font-serif text-xl font-bold" style={{ color: LUX_INK }}>{fmtMoney(bill.total)}</p>
                    </div>
                  </div>

                  {/* Items */}
                  <table className="mt-7 w-full text-sm" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                    <thead>
                      <tr className="border-b-2 text-[10px] uppercase tracking-[0.14em]" style={{ borderColor: LUX_GOLD, color: LUX_GOLDD }}>
                        <th className="px-1 pb-2 text-left font-bold">Item</th>
                        <th className="px-1 pb-2 text-center font-bold">Qty</th>
                        <th className="px-1 pb-2 text-right font-bold">Rate</th>
                        <th className="px-1 pb-2 text-right font-bold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bill.items.map((it, i) => (
                        <tr key={i} className="border-b" style={{ borderColor: "#f0ebe0" }}>
                          <td className="px-1 py-2.5" style={{ color: LUX_GRAPHITE }}>{it.description}</td>
                          <td className="px-1 py-2.5 text-center" style={{ color: LUX_GRAPHITE }}>{it.qty}</td>
                          <td className="px-1 py-2.5 text-right" style={{ color: LUX_GRAPHITE }}>{fmtMoney(it.price)}</td>
                          <td className="px-1 py-2.5 text-right font-bold" style={{ color: LUX_INK }}>{fmtMoney(it.qty * it.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Totals */}
                  <div className="mt-4 flex justify-end">
                    <div className="w-64 space-y-1.5">
                      <div className="flex items-center justify-between"><span className="text-xs" style={{ color: LUX_GREY }}>Payment</span><span className="text-sm" style={{ color: LUX_GRAPHITE }}>{bill.paymentMethod}</span></div>
                      <div className="flex items-center justify-between"><span className="text-xs" style={{ color: LUX_GREY }}>Total</span><span className="text-sm font-bold" style={{ color: LUX_GRAPHITE }}>{fmtMoney(bill.total)}</span></div>
                      <div className="mt-1 border-t pt-2" style={{ borderColor: LUX_GOLD }} />
                    </div>
                  </div>

                  {/* Amount in words */}
                  <div className="mt-4 rounded-lg bg-[#fefdfb] px-3 py-2" style={{ border: `1px solid ${LUX_LINE}` }}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: LUX_GOLDD }}>Amount in words</p>
                    <p className="mt-1 font-serif text-sm italic" style={{ color: LUX_GRAPHITE }}>{formatAmountInWords(bill.total, cur)}</p>
                  </div>

                  <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border bg-white p-4" style={{ borderColor: LUX_LINE }}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: LUX_GOLDD }}>Scan to Pay via UPI — Amount Auto-filled</p>
                    <UPIQR bill={bill} settings={settings} size={150} />
                    <p className="font-serif text-xs" style={{ color: LUX_GRAPHITE }}>
                      {settings.upiId ? `UPI: ${settings.upiId} • ${fmtMoney(bill.total)}` : "Set UPI ID in Settings → Business & payment"}
                    </p>
                    <p className="text-[10px] text-muted">GPay • PhonePe • Paytm • BHIM — scan with any UPI app</p>
                  </div>

                  {/* Paid via */}
                  {bill.paymentMethod && (
                    <div className="mt-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: LUX_GOLDD }}>PAID VIA</p>
                      <p className="font-serif text-sm font-bold" style={{ color: LUX_INK }}>{bill.paymentMethod}</p>
                    </div>
                  )}

                  <div className="mt-8 text-center">
                    <p className="font-serif text-sm italic" style={{ color: LUX_GRAPHITE }}>Thank you for your business!</p>
                    <div className="mx-auto mt-2 h-px w-8" style={{ backgroundColor: LUX_GOLD }} />
                  </div>
                </>
              ) : (
                <>
                  {/* INVOICE HEADER - matches pdf.ts drawInvoice */}
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex items-start gap-3">
                      {settings.logo && <img src={settings.logo} alt={settings.studioName} className="h-14 w-14 rounded-md object-cover" style={{ border: "2px solid white", borderRadius: "4px" }} />}
                      <div>
                        <p className="font-serif text-2xl font-bold leading-tight" style={{ color: LUX_INK }}>{settings.studioName}</p>
                        {(settings.businessAddress || settings.businessEmail || settings.businessPhone) && (
                          <p className="mt-1 text-[10px] uppercase tracking-[0.12em]" style={{ color: LUX_GREY }}>
                            {[settings.businessAddress, settings.businessEmail, settings.businessPhone].filter(Boolean).join("   ·   ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-sans text-lg font-bold tracking-[0.35em]" style={{ color: LUX_GOLDD }}>INVOICE</p>
                      <div className="mt-2.5 space-y-1 text-xs">
                        <div className="flex items-center justify-end gap-8"><span className="text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: LUX_GREY }}>Invoice No.</span><span className="font-serif text-base" style={{ color: LUX_INK }}>{bill.billNumber}</span></div>
                        <div className="flex items-center justify-end gap-8"><span className="text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: LUX_GREY }}>Issue Date</span><span className="font-serif text-base" style={{ color: LUX_INK }}>{issue}</span></div>
                        <div className="flex items-center justify-end gap-8"><span className="text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: LUX_GREY }}>Due Date</span><span className="font-serif text-base" style={{ color: LUX_INK }}>{due}</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 border-t" style={{ borderColor: LUX_LINE }} />

                  {/* Prepared For + Balance Due */}
                  <div className="mt-7 flex items-start justify-between gap-6">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: LUX_GOLDD }}>PREPARED FOR</p>
                      <p className="mt-1.5 font-serif text-lg font-bold" style={{ color: LUX_INK }}>{bill.customerName}</p>
                      {bill.clientCompany && <p className="font-serif text-sm" style={{ color: LUX_GRAPHITE }}>{bill.clientCompany}</p>}
                      {bill.clientAddress && <p className="font-serif text-sm" style={{ color: LUX_GREY }}>{bill.clientAddress}</p>}
                      {bill.note && <p className="mt-3 font-serif text-sm italic" style={{ color: LUX_GREY }}>Note: {bill.note}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: LUX_GOLDD }}>BALANCE DUE</p>
                      <p className="mt-1.5 font-serif text-3xl font-bold" style={{ color: LUX_INK }}>{fmtMoney(bill.total)}</p>
                    </div>
                  </div>

                  <table className="mt-8 w-full text-sm" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                    <thead>
                      <tr className="border-b-2 text-[10px] uppercase tracking-[0.14em]" style={{ borderColor: LUX_GOLD, color: LUX_GOLDD }}>
                        <th className="px-1 pb-2 text-left font-bold">Item</th>
                        <th className="px-1 pb-2 text-center font-bold">Hours / Qty</th>
                        <th className="px-1 pb-2 text-right font-bold">Rate</th>
                        <th className="px-1 pb-2 text-right font-bold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bill.items.map((it, i) => (
                        <tr key={i} className="border-b" style={{ borderColor: "#f0ebe0" }}>
                          <td className="px-1 py-3" style={{ color: LUX_GRAPHITE }}>{it.description}</td>
                          <td className="px-1 py-3 text-center" style={{ color: LUX_GRAPHITE }}>{it.qty}</td>
                          <td className="px-1 py-3 text-right" style={{ color: LUX_GRAPHITE }}>{fmtMoney(it.price)}</td>
                          <td className="px-1 py-3 text-right font-bold" style={{ color: LUX_INK }}>{fmtMoney(it.qty * it.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-5 flex justify-end">
                    <div className="w-full max-w-xs space-y-2 sm:w-72">
                      <div className="flex items-center justify-between"><span className="text-xs" style={{ color: LUX_GREY }}>Subtotal</span><span style={{ color: LUX_GRAPHITE }}>{fmtMoney(bill.subtotal)}</span></div>
                      {bill.discount > 0 && <div className="flex items-center justify-between"><span className="text-xs" style={{ color: LUX_GREY }}>Discount</span><span style={{ color: LUX_GRAPHITE }}>-{fmtMoney(bill.discount)}</span></div>}
                      {bill.taxAmount > 0 && <div className="flex items-center justify-between"><span className="text-xs" style={{ color: LUX_GREY }}>Tax / GST ({bill.taxRate}%)</span><span style={{ color: LUX_GRAPHITE }}>{fmtMoney(bill.taxAmount)}</span></div>}
                      <div className="mt-1 border-t-2 pt-2.5" style={{ borderColor: LUX_GOLD }}>
                        <div className="flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: LUX_GOLDD }}>Total Due</span><span className="font-serif text-2xl font-bold" style={{ color: LUX_INK }}>{fmtMoney(bill.total)}</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg bg-[#fefdfb] px-3 py-2.5" style={{ border: `1px solid ${LUX_LINE}` }}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: LUX_GOLDD }}>Amount in words</p>
                    <p className="mt-1 font-serif text-sm italic leading-snug" style={{ color: LUX_GRAPHITE }}>{formatAmountInWords(bill.total, cur)}</p>
                  </div>

                  <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border bg-white p-4" style={{ borderColor: LUX_LINE }}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: LUX_GOLDD }}>Scan to Pay via UPI — Amount Auto-filled</p>
                    <UPIQR bill={bill} settings={settings} size={150} />
                    <p className="font-serif text-xs" style={{ color: LUX_GRAPHITE }}>
                      {settings.upiId ? `UPI: ${settings.upiId} • ${fmtMoney(bill.total)}` : "Set UPI ID in Settings → Business & payment to enable"}
                    </p>
                    <p className="text-[10px] text-muted">GPay • PhonePe • Paytm • BHIM — scan with any UPI app</p>
                  </div>

                  {(settings.bankName || settings.bankAccount || settings.upiId || settings.paypal || settings.swift) && (
                    <div className="mt-9 border-t pt-4" style={{ borderColor: LUX_LINE }}>
                      <div className="flex justify-between gap-8">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: LUX_GOLDD }}>Remittance · Bank Wire</p>
                          {(settings.beneficiary || settings.studioName) && <p className="font-serif text-xs" style={{ color: LUX_GRAPHITE }}>Beneficiary — {settings.beneficiary || settings.studioName}</p>}
                          {settings.bankName && <p className="font-serif text-xs" style={{ color: LUX_GRAPHITE }}>Bank — {settings.bankName}{settings.bankAccount ? ` · A/C ${settings.bankAccount}` : ""}</p>}
                          {settings.swift ? <p className="font-serif text-xs" style={{ color: LUX_GRAPHITE }}>SWIFT / BIC — {settings.swift}</p> : settings.bankIfsc ? <p className="font-serif text-xs" style={{ color: LUX_GRAPHITE }}>IFSC — {settings.bankIfsc}</p> : null}
                          {settings.upiId && <p className="font-serif text-xs" style={{ color: LUX_GRAPHITE }}>UPI — {settings.upiId}</p>}
                          {settings.paypal && <p className="font-serif text-xs" style={{ color: LUX_GRAPHITE }}>PayPal — {settings.paypal}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: LUX_GOLDD }}>Terms</p>
                          <p className="font-serif text-xs" style={{ color: LUX_GRAPHITE }}>{settings.paymentTerms || "Due upon receipt"}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-8 text-center">
                    <p className="font-serif text-sm italic" style={{ color: LUX_GRAPHITE }}>It is a genuine pleasure to be of service.</p>
                    <p className="font-serif text-xs italic" style={{ color: LUX_GREY }}>With our deepest appreciation for your continued patronage.</p>
                    <div className="mx-auto mt-2 h-px w-8" style={{ backgroundColor: LUX_GOLD }} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        {isReceipt && <p className="text-center text-xs text-muted sm:hidden">This receipt matches the downloaded PDF exactly.</p>}
        {!isReceipt && <p className="hidden text-center text-xs text-muted sm:block">Preview matches the downloaded PDF — A4 luxury layout.</p>}
        <p className="text-center text-xs text-muted sm:hidden">↔ Swipe to view full document ↔</p>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto">Close</Button>
          <Button variant="outline" onClick={() => window.print()} className="w-full sm:w-auto">
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button onClick={handleDownload} className="w-full sm:w-auto">
            <FileDown className="h-4 w-4" /> Download {isReceipt ? "Receipt" : "PDF"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-8">
      <span className="text-[10px] uppercase tracking-[0.1em] text-[#8a8a8a]">{label}</span>
      <span className="font-serif text-[#1a1a1a]">{value}</span>
    </div>
  );
}
function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[#8a8a8a]">{label}</span>
      <span className="font-serif text-[#404040]">{value}</span>
    </div>
  );
}

