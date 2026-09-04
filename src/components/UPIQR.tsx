import { useEffect, useState } from "react";
import { generateUPIQRDataUrl } from "../lib/upi";
import type { Bill, Settings } from "../lib/types";

export function UPIQR({ bill, settings, size = 140 }: { bill: Bill; settings: Pick<Settings, "upiId" | "studioName">; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setErr(false);
    if (!settings.upiId) return;
    if (!bill.total || bill.total <= 0) return;
    generateUPIQRDataUrl(bill, settings)
      .then((u) => {
        if (!cancelled) {
          if (u) setUrl(u);
          else setErr(true);
        }
      })
      .catch(() => {
        if (!cancelled) setErr(true);
      });
    return () => {
      cancelled = true;
    };
  }, [bill.billNumber, bill.total, settings.upiId, settings.studioName]);
  if (!settings.upiId) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-[#fefdfb] px-2 text-center"
        style={{ width: size, height: size, borderColor: "#e4ded2" }}
      >
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted">No UPI</span>
        <span className="mt-1 text-xs text-muted">Set UPI ID in Settings → Business & payment</span>
      </div>
    );
  }
  if (err) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-lg border bg-white p-2 text-center"
        style={{ width: size, height: size, borderColor: "#e4ded2" }}
      >
        <span className="text-xs text-muted">QR failed</span>
        <span className="mt-1 break-all text-[10px] text-muted">{settings.upiId}</span>
      </div>
    );
  }
  if (!url) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed bg-[#fefdfb] text-xs text-muted"
        style={{ width: size, height: size, borderColor: "#e4ded2" }}
      >
        QR…
      </div>
    );
  }
  return <img src={url} alt="UPI QR — amount auto-filled" width={size} height={size} className="rounded-lg border bg-white p-1" style={{ borderColor: "#e4ded2" }} />;
}
