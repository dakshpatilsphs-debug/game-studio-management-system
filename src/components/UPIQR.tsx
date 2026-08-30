import { useEffect, useState } from "react";
import { generateUPIQRDataUrl } from "../lib/upi";
import type { Bill, Settings } from "../lib/types";

export function UPIQR({ bill, settings, size = 140 }: { bill: Bill; settings: Pick<Settings, "upiId" | "studioName">; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    generateUPIQRDataUrl(bill, settings).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [bill.billNumber, bill.total, settings.upiId, settings.studioName]);
  if (!settings.upiId) return null;
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
  return <img src={url} alt="UPI QR" width={size} height={size} className="rounded-lg border bg-white p-1" style={{ borderColor: "#e4ded2" }} />;
}
