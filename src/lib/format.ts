// ===== Formatting & calculation helpers =====

export function formatMoney(amount: number, currency = "$"): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  return `${sign}${currency}${abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Duration in hours between two timestamps, returns a human string. */
export function formatDuration(start: number, end: number | null): string {
  const e = end ?? Date.now();
  const ms = Math.max(0, e - start);
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Live cost for an active session based on elapsed hours. */
export function liveSessionCost(start: number, end: number | null, hourlyRate: number, roundOffMinutes?: number): number {
  const e = end ?? Date.now();
  const ms = Math.max(0, e - start);
  if (roundOffMinutes && roundOffMinutes > 0) {
    return finalizeSessionCost(start, e, hourlyRate, roundOffMinutes);
  }
  const hours = ms / 3600000;
  return Math.round(hours * hourlyRate * 100) / 100;
}

/** Final cost: round up to nearest billingRoundOffMinutes (default 15). Minimum 1 unit. */
export function finalizeSessionCost(start: number, end: number, hourlyRate: number, roundOffMinutes = 15): number {
  const ms = Math.max(0, end - start);
  // if less than 30 seconds, treat as 0? but still apply min charge - caller decides.
  // For very short sessions (<60s) we still bill minimum per original spec; but with 1-min granularity it will be small.
  const inc = Math.max(1, roundOffMinutes);
  const totalMinutes = ms / 60000;
  // Ceil to nearest increment; if totalMinutes is 0 (instant stop) -> 1 unit (= inc minutes)
  // If user stopped within a few seconds, e.g. 0.4 min, ceil(0.4/15)=1 -> 15 min
  const units = Math.max(1, Math.ceil(totalMinutes / inc));
  const billedHours = (units * inc) / 60;
  // Round to 2 decimals
  return Math.round(billedHours * hourlyRate * 100) / 100;
}

/** Amount in words - Indian numbering (Crore/Lakh) - e.g. "Rupees One Thousand Two Hundred Only" */
export function amountInWords(amount: number, currency = "₹"): string {
  const n = Math.floor(Math.abs(amount));
  if (n === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function twoDigits(num: number): string {
    if (num < 20) return ones[num];
    const t = Math.floor(num / 10);
    const o = num % 10;
    return tens[t] + (o ? " " + ones[o] : "");
  }
  function threeDigits(num: number): string {
    const h = Math.floor(num / 100);
    const rem = num % 100;
    let s = "";
    if (h) s += ones[h] + " Hundred";
    if (rem) s += (s ? " " : "") + twoDigits(rem);
    return s;
  }

  let num = n;
  let parts: string[] = [];

  const crore = Math.floor(num / 10000000);
  if (crore) { parts.push(threeDigits(crore) + " Crore"); num %= 10000000; }
  const lakh = Math.floor(num / 100000);
  if (lakh) { parts.push(threeDigits(lakh) + " Lakh"); num %= 100000; }
  const thousand = Math.floor(num / 1000);
  if (thousand) { parts.push(threeDigits(thousand) + " Thousand"); num %= 1000; }
  if (num) parts.push(threeDigits(num));

  let words = parts.join(" ");
  // Add paise if needed
  const paise = Math.round((Math.abs(amount) - n) * 100);
  if (paise) {
    words += " and " + twoDigits(paise) + " Paise";
  }
  return words.trim();
}

export function formatAmountInWords(amount: number, currency = "₹"): string {
  const curWord = currency === "₹" || currency === "₨" ? "Rupees" : currency;
  const words = amountInWords(amount, currency);
  return `${curWord} ${words} Only`;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

export function dayKey(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
