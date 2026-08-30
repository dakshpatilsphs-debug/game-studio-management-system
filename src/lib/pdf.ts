import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Bill } from "./types";
import { formatMoney, formatDateTime, formatAmountInWords } from "./format";
import { generateUPIQRDataUrl } from "./upi";

type BillSettings = {
  studioName: string;
  currency: string;
  logo?: string;
  businessEmail?: string;
  businessPhone?: string;
  businessAddress?: string;
  upiId?: string;
  bankName?: string;
  bankAccount?: string;
  bankIfsc?: string;
  swift?: string;
  beneficiary?: string;
  paypal?: string;
  paymentTerms?: string;
};

// Luxury invoice palette: ink-black on warm neutrals with champagne-gold accents.
const LUX_INK: [number, number, number] = [26, 26, 26];
const LUX_GRAPHITE: [number, number, number] = [64, 64, 64];
const LUX_GREY: [number, number, number] = [138, 138, 138];
const LUX_GOLD: [number, number, number] = [184, 148, 95];
const LUX_GOLDD: [number, number, number] = [150, 120, 66];
const LUX_LINE: [number, number, number] = [228, 222, 210];

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function goldLine(doc: jsPDF, x1: number, x2: number, y: number, w = 0.5) {
  doc.setDrawColor(...LUX_GOLD);
  doc.setLineWidth(w);
  doc.line(x1, y, x2, y);
}
function hairLine(doc: jsPDF, x1: number, x2: number, y: number, w = 0.2) {
  doc.setDrawColor(...LUX_LINE);
  doc.setLineWidth(w);
  doc.line(x1, y, x2, y);
}

// Standard PDF fonts can't render the ₹ glyph (and other non-ASCII currency
// symbols), so we render those as "Rs." inside PDFs while the app shows ₹.
function pdfSym(currency: string): string {
  if (currency === "₹" || currency === "₨") return "Rs. ";
  return /^[\x00-\x7F]+$/.test(currency) ? currency : "Rs. ";
}
function pdfMoney(amount: number, currency: string): string {
  return formatMoney(amount, pdfSym(currency));
}

const VIOLET: [number, number, number] = [124, 58, 237];
const DARK: [number, number, number] = [15, 23, 42];
const SLATE: [number, number, number] = [100, 116, 139];
const MUTED: [number, number, number] = [148, 163, 184];
const LIGHT: [number, number, number] = [241, 245, 249];
const EMERALD: [number, number, number] = [5, 150, 105];
const ROSE: [number, number, number] = [225, 29, 72];

const PAGE_W = 210;
const MARGIN = 14;

function addLogo(doc: jsPDF, logo: string | undefined, x: number, y: number, size: number) {
  if (!logo) return;
  const fmt = logo.startsWith("data:image/png") ? "PNG" : "JPEG";
  try {
    doc.addImage(logo, fmt, x, y, size, size);
  } catch {
    /* skip on failure */
  }
}

/** Place a logo proportionally within a max bounding box (no squish). */
function fitLogo(doc: jsPDF, logo: string | undefined, x: number, y: number, maxW: number, maxH: number) {
  if (!logo) return;
  const fmt = logo.startsWith("data:image/png") ? "PNG" : "JPEG";
  try {
    const props = doc.getImageProperties(logo);
    const ratio = props.height / props.width;
    let w = maxW;
    let h = w * ratio;
    if (h > maxH) {
      h = maxH;
      w = h / ratio;
    }
    doc.addImage(logo, fmt, x, y, w, h);
  } catch {
    /* skip on failure */
  }
}

/** Branded header band with optional logo + right-aligned title. */
function header(doc: jsPDF, studioName: string, subtitle: string, title: string, logo?: string) {
  const bandH = 32;
  doc.setFillColor(...VIOLET);
  doc.rect(0, 0, PAGE_W, bandH, "F");
  doc.setFillColor(...DARK);
  doc.rect(0, bandH, PAGE_W, 1.5, "F");

  const logoSize = 18;
  const hasLogo = !!logo;
  const textX = hasLogo ? MARGIN + logoSize + 6 : MARGIN;
  if (hasLogo) {
    // white rounded tile behind the logo for contrast on colored band
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(MARGIN, 7, logoSize, logoSize, 2, 2, "F");
    addLogo(doc, logo, MARGIN + 1, 8, logoSize - 2);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(truncate(studioName, 26), textX, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(225, 220, 255);
  doc.text(subtitle, textX, 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(title, PAGE_W - MARGIN, 15, { align: "right" });
}

function sectionTitle(doc: jsPDF, text: string, x: number, y: number, w?: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text(text, x, y);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(x, y + 1.5, w ?? PAGE_W - MARGIN, y + 1.5);
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function kpiRow(doc: jsPDF, y: number, cards: { label: string; value: string; color: [number, number, number] }[]) {
  const cardW = (PAGE_W - MARGIN * 2 - 9) / 4;
  cards.forEach((c, i) => {
    const x = MARGIN + i * (cardW + 3);
    doc.setFillColor(...LIGHT);
    doc.roundedRect(x, y, cardW, 22, 2, 2, "F");
    doc.setFillColor(...c.color);
    doc.roundedRect(x, y, 1.5, 22, 0.8, 0.8, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SLATE);
    doc.text(c.label.toUpperCase(), x + 4, y + 7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...c.color);
    doc.text(truncate(c.value, 14), x + 4, y + 16);
  });
}

function drawInvoice(doc: jsPDF, bill: Bill, s: BillSettings, qrDataUrl?: string | null) {
  const cur = s.currency;
  const M = 18;
  const W = 210;
  const R = W - M; // right edge — every block aligns to M (left) and R (right)
  const leftText = s.logo ? M + 18 : M;

  // ---- Top hairline (gold) ----
  goldLine(doc, M, R, 14, 0.8);

  let y = 27;

  // ===== HEADER =====
  if (s.logo) fitLogo(doc, s.logo, M, y - 5, 16, 16);
  doc.setFont("times", "bold");
  doc.setFontSize(21);
  doc.setTextColor(...LUX_INK);
  doc.text(s.studioName, leftText, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...LUX_GREY);
  let iy = y + 12;
  if (s.businessAddress) {
    doc.text(s.businessAddress.toUpperCase(), leftText, iy, { charSpace: 0.8 });
    iy += 4.6;
  }
  if (s.businessEmail || s.businessPhone) {
    doc.text([s.businessEmail, s.businessPhone].filter(Boolean).join("    ").toUpperCase(), leftText, iy, { charSpace: 0.8 });
    iy += 4.6;
  }

  // Right: INVOICE wordmark + meta
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...LUX_GOLDD);
  doc.text("INVOICE", R, y, { align: "right", charSpace: 4 });

  const meta: [string, string][] = [
    ["Invoice No.", bill.billNumber],
    ["Issue Date", fmtDate(bill.createdAt)],
    ["Due Date", bill.dueDate ? fmtDate(bill.dueDate) : "Upon receipt"],
  ];
  let my = y + 9;
  meta.forEach(([l, v]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...LUX_GREY);
    doc.text(l.toUpperCase(), R - 56, my, { charSpace: 0.6 });
    doc.setFont("times", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...LUX_INK);
    doc.text(truncate(v, 20), R, my, { align: "right" });
    my += 6.5;
  });

  y = Math.max(iy, my) + 3;
  hairLine(doc, M, R, y, 0.25);
  y += 13;

  // ===== PREPARED FOR + BALANCE DUE =====
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...LUX_GOLDD);
  doc.text("PREPARED FOR", M, y, { charSpace: 1.4 });
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...LUX_INK);
  doc.text(bill.customerName, M, y + 7);
  doc.setFont("times", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...LUX_GRAPHITE);
  let cy = y + 13;
  if (bill.clientCompany) {
    doc.text(bill.clientCompany, M, cy);
    cy += 5;
  }
  if (bill.clientAddress) {
    doc.text(bill.clientAddress, M, cy);
    cy += 5;
  }
  if (bill.note) {
    doc.setFont("times", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...LUX_GREY);
    doc.text(`Note: ${bill.note}`, M, cy);
    cy += 5;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...LUX_GOLDD);
  doc.text("BALANCE DUE", R, y, { align: "right", charSpace: 1.4 });
  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...LUX_INK);
  doc.text(pdfMoney(bill.total, cur), R, y + 8, { align: "right" });

  y = Math.max(cy, y + 14) + 9;

  // ===== ITEMIZED TABLE =====
  autoTable(doc, {
    startY: y,
    head: [["Item", "Hours / Qty", "Rate", "Total"]],
    body: bill.items.map((it) => [
      it.description,
      String(it.qty),
      pdfMoney(it.price, cur),
      pdfMoney(it.qty * it.price, cur),
    ]),
    theme: "plain",
    styles: { font: "times", fontSize: 10, textColor: LUX_GRAPHITE, cellPadding: { top: 6, bottom: 6, left: 0, right: 0 } },
    headStyles: {
      font: "helvetica",
      fontStyle: "bold",
      fontSize: 7.5,
      textColor: LUX_GOLDD,
      cellPadding: { top: 2, bottom: 5, left: 0, right: 0 },
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "center", cellWidth: 30 },
      2: { halign: "right", cellWidth: 34 },
      3: { halign: "right", cellWidth: 34 },
    },
    margin: { left: M, right: M },
    didDrawCell: (data) => {
      const c = data.cell;
      if (data.section === "head") {
        goldLine(doc, c.x, c.x + c.width, c.y + c.height, 0.4);
      } else {
        hairLine(doc, c.x, c.x + c.width, c.y + c.height, 0.18);
      }
    },
  });

  // @ts-expect-error injected by the plugin
  let ty: number = doc.lastAutoTable.finalY + 9;
  const tX = R - 60;

  const totals: [string, string][] = [["Subtotal", pdfMoney(bill.subtotal, cur)]];
  if (bill.discount > 0) totals.push(["Discount", "-" + pdfMoney(bill.discount, cur)]);
  if (bill.taxAmount > 0) totals.push([`Tax / GST (${bill.taxRate}%)`, pdfMoney(bill.taxAmount, cur)]);

  totals.forEach(([l, v]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...LUX_GREY);
    doc.text(l, tX, ty);
    doc.setFont("times", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...LUX_GRAPHITE);
    doc.text(v, R, ty, { align: "right" });
    ty += 6.5;
  });

  goldLine(doc, tX, R, ty - 1, 0.4);
  ty += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...LUX_GOLDD);
  doc.text("TOTAL DUE", tX, ty, { charSpace: 1 });
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...LUX_INK);
  doc.text(pdfMoney(bill.total, cur), R, ty, { align: "right" });
  ty += 7;
  // Amount in words
  {
    const words = formatAmountInWords(bill.total, cur);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...LUX_GOLDD);
    doc.text("AMOUNT IN WORDS", M, ty, { charSpace: 0.7 });
  doc.setFont("times", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...LUX_GRAPHITE);
  const lines = doc.splitTextToSize(words, R - M);
  doc.text(lines, M, ty + 4.5);
  ty += 4.5 + lines.length * 4.5 + 2;
  }

  // ===== UPI QR (if enabled) =====
  if (qrDataUrl && s.upiId) {
    const qrSize = 28;
    const qrX = (W - qrSize) / 2;
    // ensure we have space; push bank wire down if needed
    if (ty + qrSize + 12 > 255) {
      // not enough space, skip QR to avoid overflow - will be on next page if needed
    } else {
      try {
        doc.addImage(qrDataUrl, "PNG", qrX, ty, qrSize, qrSize);
        ty += qrSize + 2;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...LUX_GOLDD);
        doc.text("SCAN TO PAY VIA UPI", W / 2, ty, { align: "center", charSpace: 0.6 });
        ty += 3.5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...LUX_GRAPHITE);
        doc.text(`${s.upiId}  •  ${pdfMoney(bill.total, cur)}  (amount auto-filled)`, W / 2, ty, { align: "center" });
        ty += 3.5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        doc.setTextColor(...LUX_GREY);
        doc.text("GPay  •  PhonePe  •  Paytm  •  BHIM", W / 2, ty, { align: "center" });
        ty += 6;
      } catch {}
    }
  }

  // ===== BANK WIRE / REMITTANCE =====
  const hasPayment = s.bankName || s.bankAccount || s.upiId || s.paypal || s.swift;
  if (hasPayment) {
    ty = Math.max(ty + 6, 230);
    hairLine(doc, M, R, ty - 6, 0.25);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...LUX_GOLDD);
    doc.text("REMITTANCE · BANK WIRE INSTRUCTIONS", M, ty, { charSpace: 1.4 });
    doc.setFont("times", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...LUX_GRAPHITE);
    let py = ty + 6.5;
    const lines: string[] = [];
    if (s.beneficiary || s.studioName) lines.push(`Beneficiary — ${s.beneficiary || s.studioName}`);
    if (s.bankName) lines.push(`Bank — ${s.bankName}`);
    if (s.bankAccount) lines.push(`Account No. — ${s.bankAccount}`);
    if (s.swift) lines.push(`SWIFT / BIC — ${s.swift}`);
    else if (s.bankIfsc) lines.push(`IFSC — ${s.bankIfsc}`);
    if (s.upiId) lines.push(`UPI — ${s.upiId}`);
    if (s.paypal) lines.push(`PayPal — ${s.paypal}`);
    lines.forEach((l) => {
      doc.text(l, M, py);
      py += 5.4;
    });
    ty = py;
  }

  // ===== THANK YOU =====
  const tyY = Math.max(ty + 8, 268);
  doc.setFont("times", "italic");
  doc.setFontSize(11);
  doc.setTextColor(...LUX_GRAPHITE);
  doc.text("It is a genuine pleasure to be of service.", W / 2, tyY, { align: "center" });
  doc.setFont("times", "italic");
  doc.setFontSize(10);
  doc.setTextColor(...LUX_GREY);
  doc.text("With our deepest appreciation for your continued patronage.", W / 2, tyY + 6, { align: "center" });
  goldLine(doc, W / 2 - 16, W / 2 + 16, tyY + 10, 0.5);
}

export async function generateBillPDF(bill: Bill, settings: BillSettings) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const qr = await generateUPIQRDataUrl(bill, settings);
  drawInvoice(doc, bill, settings, qr);
  doc.save(`${bill.billNumber}.pdf`);
}

export async function generateAllBillsPDF(bills: Bill[], settings: BillSettings) {
  if (bills.length === 0) return;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const sorted = [...bills].sort((a, b) => b.createdAt - a.createdAt);
  for (let i = 0; i < sorted.length; i++) {
    const bill = sorted[i];
    if (i > 0) doc.addPage();
    const qr = await generateUPIQRDataUrl(bill, settings);
    if (bill.fromSession) {
      drawSessionReceipt(doc, bill, settings, qr);
    } else {
      drawInvoice(doc, bill, settings, qr);
    }
  }
  doc.save(`all-invoices-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** Simpler receipt layout for session bills (fromSession: true) */
export async function generateSessionReceiptPDF(bill: Bill, settings: BillSettings) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const qr = await generateUPIQRDataUrl(bill, settings);
  drawSessionReceipt(doc, bill, settings, qr);
  doc.save(`${bill.billNumber}.pdf`);
}

function drawSessionReceipt(doc: jsPDF, bill: Bill, s: BillSettings, qrDataUrl?: string | null) {
  const cur = s.currency;
  const M = 18;
  const W = 210;
  const R = W - M;

  // Top hairline
  goldLine(doc, M, R, 14, 0.8);

  let y = 24;

  // Logo + Studio name
  if (s.logo) fitLogo(doc, s.logo, M, y - 4, 14, 14);
  const leftText = s.logo ? M + 16 : M;

  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...LUX_INK);
  doc.text(s.studioName, leftText, y + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...LUX_GREY);
  let iy = y + 10;
  if (s.businessAddress) {
    doc.text(s.businessAddress.toUpperCase(), leftText, iy, { charSpace: 0.8 });
    iy += 4;
  }
  if (s.businessEmail || s.businessPhone) {
    doc.text([s.businessEmail, s.businessPhone].filter(Boolean).join("    ").toUpperCase(), leftText, iy, { charSpace: 0.8 });
    iy += 4;
  }

  // Right: RECEIPT wordmark + meta (align RECEIPT with studio name baseline)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...LUX_GOLDD);
  doc.text("RECEIPT", R, y + 4, { align: "right", charSpace: 3 });

  const meta: [string, string][] = [
    ["Receipt No.", bill.billNumber],
    ["Date", fmtDate(bill.createdAt)],
  ];
  let my = y + 11;
  meta.forEach(([l, v]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...LUX_GREY);
    doc.text(l.toUpperCase(), R - 50, my, { charSpace: 0.6 });
    doc.setFont("times", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...LUX_INK);
    doc.text(truncate(v, 18), R, my, { align: "right" });
    my += 5.5;
  });

  y = Math.max(iy, my) + 3;
  hairLine(doc, M, R, y, 0.25);
  y += 8;

  // Customer + Amount - less spread: amount box inset 8mm from right edge
  const labelY = y;
  const amountBoxX = R - 42;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...LUX_GOLDD);
  doc.text("RECEIVED FROM", M, labelY, { charSpace: 0.9 });
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...LUX_INK);
  doc.text(truncate(bill.customerName, 28), M, labelY + 6);

  // Amount - right column, not fully flush to R, with subtle box
  doc.setFillColor(254, 253, 251);
  doc.setDrawColor(...LUX_LINE);
  doc.roundedRect(amountBoxX, labelY - 3, 42, 14, 1, 1, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...LUX_GOLDD);
  doc.text("AMOUNT RECEIVED", amountBoxX + 21, labelY, { align: "center", charSpace: 0.6 });
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...LUX_INK);
  doc.text(pdfMoney(bill.total, cur), amountBoxX + 21, labelY + 7, { align: "center" });

  let cy = labelY + 12;
  if (bill.clientCompany) {
    doc.setFont("times", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...LUX_GRAPHITE);
    doc.text(bill.clientCompany, M, cy);
    cy += 4.5;
  }
  if (bill.note) {
    doc.setFont("times", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...LUX_GREY);
    doc.text(`Note: ${bill.note}`, M, cy);
    cy += 4.5;
  }

  y = Math.max(cy, labelY + 14) + 8;

  // Items table
  autoTable(doc, {
    startY: y,
    head: [["Item", "Qty", "Rate", "Total"]],
    body: bill.items.map((it) => [
      it.description,
      String(it.qty),
      pdfMoney(it.price, cur),
      pdfMoney(it.qty * it.price, cur),
    ]),
    theme: "plain",
    styles: { font: "times", fontSize: 9.5, textColor: LUX_GRAPHITE, cellPadding: { top: 5, bottom: 5, left: 0, right: 0 } },
    headStyles: {
      font: "helvetica",
      fontStyle: "bold",
      fontSize: 7,
      textColor: LUX_GOLDD,
      cellPadding: { top: 2, bottom: 4, left: 0, right: 0 },
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "center", cellWidth: 25 },
      2: { halign: "right", cellWidth: 35 },
      3: { halign: "right", cellWidth: 35 },
    },
    margin: { left: M, right: M },
    didDrawCell: (data) => {
      const c = data.cell;
      if (data.section === "head") {
        goldLine(doc, c.x, c.x + c.width, c.y + c.height, 0.3);
      } else {
        hairLine(doc, c.x, c.x + c.width, c.y + c.height, 0.15);
      }
    },
  });

  // @ts-expect-error injected by plugin
  let ty: number = doc.lastAutoTable.finalY + 6;
  const tX = R - 55;

  const totals: [string, string][] = [["Total", pdfMoney(bill.total, cur)]];
  if (bill.paymentMethod) totals.unshift(["Payment", bill.paymentMethod]);

  totals.forEach(([l, v]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...LUX_GREY);
    doc.text(l, tX, ty);
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...LUX_GRAPHITE);
    doc.text(v, R, ty, { align: "right" });
    ty += 6;
  });

  goldLine(doc, tX, R, ty - 1, 0.3);
  ty += 6;

  // Amount in words (letter amount)
  {
    const words = formatAmountInWords(bill.total, cur);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...LUX_GOLDD);
    doc.text("AMOUNT IN WORDS", M, ty, { charSpace: 0.6 });
    doc.setFont("times", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...LUX_GRAPHITE);
    const lines = doc.splitTextToSize(words, W - M * 2);
    doc.text(lines, M, ty + 4);
    ty += 4 + lines.length * 4;
  }

  // UPI QR for receipt
  if (qrDataUrl && s.upiId) {
    const qrSize = 28;
    const qrX = (W - qrSize) / 2;
    if (ty + qrSize + 12 <= 255) {
      try {
        doc.addImage(qrDataUrl, "PNG", qrX, ty, qrSize, qrSize);
        ty += qrSize + 2;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(...LUX_GOLDD);
        doc.text("SCAN TO PAY VIA UPI", W / 2, ty, { align: "center", charSpace: 0.6 });
        ty += 3.5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...LUX_GRAPHITE);
        doc.text(`${s.upiId}  •  ${pdfMoney(bill.total, cur)}`, W / 2, ty, { align: "center" });
        ty += 4;
      } catch {}
    }
  }

  // Payment method badge
  if (bill.paymentMethod) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...LUX_GOLDD);
    doc.text("PAID VIA", M, ty, { charSpace: 1.2 });
    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...LUX_INK);
    doc.text(bill.paymentMethod, M, ty + 5);
    ty += 12;
  }

  // Thank you
  const tyY = Math.max(ty + 6, 260);
  doc.setFont("times", "italic");
  doc.setFontSize(10);
  doc.setTextColor(...LUX_GRAPHITE);
  doc.text("Thank you for your business!", W / 2, tyY, { align: "center" });
  goldLine(doc, W / 2 - 12, W / 2 + 12, tyY + 5, 0.4);
}

interface ReportInput {
  studioName: string;
  currency: string;
  logo?: string;
  rangeLabel: string;
  kpis: { revenue: number; expenses: number; profit: number; sessions: number };
  series: { label: string; revenue: number; expense: number }[];
  byType: { name: string; value: number }[];
  byCat: { name: string; value: number }[];
  topStations: [string, number][];
}

export function generateReportPDF(input: ReportInput) {
  const { studioName, currency, logo, rangeLabel, kpis, series, byType, byCat, topStations } = input;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  header(doc, studioName, "Studio Financial Report", rangeLabel, logo);

  let y = 45;
  kpiRow(doc, y, [
    { label: "Total Revenue", value: pdfMoney(kpis.revenue, currency), color: EMERALD },
    { label: "Total Expenses", value: pdfMoney(kpis.expenses, currency), color: ROSE },
    { label: "Net Profit", value: pdfMoney(kpis.profit, currency), color: kpis.profit >= 0 ? VIOLET : ROSE },
    { label: "Sessions", value: String(kpis.sessions), color: DARK },
  ]);
  y += 30;

  // Daily revenue vs expense
  sectionTitle(doc, "Revenue vs Expenses (Recent Days)", MARGIN, y);
  autoTable(doc, {
    startY: y + 3,
    head: [["Day", "Revenue", "Expenses", "Net"]],
    body: series.slice(-12).map((s) => [
      s.label,
      pdfMoney(s.revenue, currency),
      pdfMoney(s.expense, currency),
      pdfMoney(s.revenue - s.expense, currency),
    ]),
    theme: "striped",
    headStyles: { fillColor: VIOLET, textColor: 255, fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    styles: { fontSize: 9, cellPadding: 2.5, textColor: DARK },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: MARGIN, right: MARGIN },
  });
  // @ts-expect-error injected by plugin
  y = doc.lastAutoTable.finalY + 10;

  // Two columns: revenue by type + expenses by category
  const colW = (PAGE_W - MARGIN * 2 - 6) / 2;

  sectionTitle(doc, "Revenue by Station Type", MARGIN, y, MARGIN + colW);
  autoTable(doc, {
    startY: y + 3,
    head: [["Type", "Revenue", "%"]],
    body: byType.length
      ? byType.map((t) => [
          t.name,
          pdfMoney(t.value, currency),
          kpis.revenue > 0 ? `${((t.value / kpis.revenue) * 100).toFixed(0)}%` : "0%",
        ])
      : [["—", pdfMoney(0, currency), "0%"]],
    theme: "grid",
    headStyles: { fillColor: EMERALD, textColor: 255, fontStyle: "bold", fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 2.5, textColor: DARK },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    margin: { left: MARGIN },
    tableWidth: colW,
  });
  // @ts-expect-error injected by plugin
  const col1End = doc.lastAutoTable.finalY;

  const rightX = MARGIN + colW + 6;
  sectionTitle(doc, "Expenses by Category", rightX, y, rightX + colW);
  autoTable(doc, {
    startY: y + 3,
    head: [["Category", "Amount", "%"]],
    body: byCat.length
      ? byCat.map((t) => [
          t.name,
          pdfMoney(t.value, currency),
          kpis.expenses > 0 ? `${((t.value / kpis.expenses) * 100).toFixed(0)}%` : "0%",
        ])
      : [["—", pdfMoney(0, currency), "0%"]],
    theme: "grid",
    headStyles: { fillColor: ROSE, textColor: 255, fontStyle: "bold", fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 2.5, textColor: DARK },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    margin: { left: rightX },
    tableWidth: colW,
  });
  // @ts-expect-error injected by plugin
  y = Math.max(col1End, doc.lastAutoTable.finalY) + 10;

  // Top stations
  sectionTitle(doc, "Top Performing Stations", MARGIN, y);
  autoTable(doc, {
    startY: y + 3,
    head: [["#", "Station", "Revenue"]],
    body: topStations.length
      ? topStations.map(([name, value], i) => [String(i + 1), name, pdfMoney(value, currency)])
      : [["—", "No data", pdfMoney(0, currency)]],
    theme: "striped",
    headStyles: { fillColor: DARK, textColor: 255, fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    styles: { fontSize: 9, cellPadding: 2.5, textColor: DARK },
    columnStyles: { 0: { halign: "center", cellWidth: 14 }, 2: { halign: "right" } },
    margin: { left: MARGIN, right: MARGIN },
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Generated by ${studioName} Management OS • ${formatDateTime(Date.now())}`, PAGE_W / 2, 288, {
    align: "center",
  });

  doc.save(`studio-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export interface InsightPdfItem {
  icon: string;
  title: string;
  body: string;
  type: "success" | "warning" | "info" | "tip" | "danger";
}

export function generateInsightsPDF(
  studioName: string,
  currency: string,
  logo: string | undefined,
  insights: InsightPdfItem[],
  kpis: { revenue: number; expenses: number; profit: number; margin: number }
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  header(doc, studioName, "AI Insights & Recommendations", "AI Report", logo);

  let y = 45;
  kpiRow(doc, y, [
    { label: "Revenue", value: pdfMoney(kpis.revenue, currency), color: EMERALD },
    { label: "Expenses", value: pdfMoney(kpis.expenses, currency), color: ROSE },
    { label: "Net Profit", value: pdfMoney(kpis.profit, currency), color: kpis.profit >= 0 ? VIOLET : ROSE },
    { label: "Margin", value: `${kpis.margin.toFixed(0)}%`, color: DARK },
  ]);
  y += 30;

  sectionTitle(doc, `Key Insights (${insights.length})`, MARGIN, y);

  autoTable(doc, {
    startY: y + 3,
    head: [["", "Insight", "Analysis & Recommendation"]],
    body: insights.map((i) => [`  ${i.icon}`, i.title, i.body]),
    theme: "grid",
    headStyles: { fillColor: VIOLET, textColor: 255, fontStyle: "bold", fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3, textColor: DARK, valign: "top", lineColor: [226, 232, 240], lineWidth: 0.1 },
    columnStyles: {
      0: { cellWidth: 12, halign: "center", fontSize: 11 },
      1: { cellWidth: 48, fontStyle: "bold" },
      2: { cellWidth: "auto" },
    },
    margin: { left: MARGIN, right: MARGIN },
    didParseCell: (data) => {
      if (data.section === "body") {
        const type = insights[data.row.index].type;
        const colors: Record<string, [number, number, number]> = {
          success: EMERALD,
          warning: [217, 119, 6],
          info: [2, 132, 199],
          tip: VIOLET,
          danger: ROSE,
        };
        data.cell.styles.textColor = colors[type] || DARK;
      }
    },
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Generated by ${studioName} Management OS • ${formatDateTime(Date.now())}`, PAGE_W / 2, 288, {
    align: "center",
  });

  doc.save(`ai-insights-${new Date().toISOString().slice(0, 10)}.pdf`);
}
