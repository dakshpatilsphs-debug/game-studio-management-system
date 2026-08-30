import QRCode from "qrcode";
import type { Bill, Settings } from "./types";

export function buildUPIString(bill: Bill, settings: Pick<Settings, "upiId" | "studioName">): string | null {
  const pa = settings.upiId?.trim();
  if (!pa) return null;
  if (!bill.total || bill.total <= 0) return null;
  const pn = encodeURIComponent(settings.studioName || "Merchant");
  const am = bill.total.toFixed(2);
  const tn = encodeURIComponent(`Bill ${bill.billNumber} - ${bill.customerName}`);
  // UPI spec: pa=UPI ID, pn=payee name, am=amount, cu=INR, tn=note
  return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR&tn=${tn}`;
}

export async function generateUPIQRDataUrl(
  bill: Bill,
  settings: Pick<Settings, "upiId" | "studioName">
): Promise<string | null> {
  const upi = buildUPIString(bill, settings);
  if (!upi) return null;
  try {
    return await QRCode.toDataURL(upi, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#1a1a1a", light: "#ffffff" },
    });
  } catch {
    return null;
  }
}
