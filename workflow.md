# Workflow
### Gaming Lounge Management OS

---

## 1. Session: Start → Stop → Bill

```
Staff taps an available (Free) station card
   → "Start Session" sheet opens
   → choose customer: Walk-in | Existing | New (name + phone)
   → session created (status: active, startTime: now, hourlyRate set)
   → station status → Occupied (dashboard updates live on all devices via onSnapshot)
   → card shows live mono timer + running ₹ total
   → optional happy-hour rate auto-applied if inside the configured window
   → staff taps "Stop & Bill"
   → live base amount shown; staff adds snacks/extras, picks payment method
   → "Collect" → final cost computed (rounded to 30-min increments + extras)
   → session doc updated (status: completed, endTime, baseAmount, extrasAmount, paymentMethod, totalCost)
   → receipt bill doc created (fromSession: true)
   → station status → Free
   → toast: "₹___ collected (Cash/UPI/Card)" + PDF receipt download available
```

## 2. Manual Invoice (Bills section)

```
Admin opens Billing → "New Bill"
   → enters customer name, client company, client address, due date (defaults +7 days)
   → auto invoice number: LUX-YYYY-00X
   → adds line items (description, qty, rate) — live subtotal/total
   → optional discount + tax/GST %
   → payment method
   → create → invoice saved to bills collection
   → view: luxury on-screen invoice → Print or Download PDF (bank-wire remittance + thank-you)
```

## 3. Customers

```
Add customer (name, phone, optional prepaid balance)
   → starting a session for them increments totalVisits
   → click a customer → visit history (sessions + payments + amounts)
   → lifetime spend aggregated from completed sessions
```

## 4. Expenses

```
Log expense (description, category, amount, date, optional note)
   → dashboard/reports/AI include it in profit & margin
   → spending-by-category breakdown
   → categories: Rent, Electricity, Maintenance, Equipment, Salary, Snacks & Drinks,
     Internet, Marketing, Other
```

## 5. Daily / Period Close (Reports)

```
Admin opens Reports → choose range (7 / 30 / 90 days)
   → app aggregates completed sessions + standalone bills (excludes session receipts)
   → shows revenue, expenses, net profit, margin, sessions
   → revenue-vs-expense bars, revenue by station type, expense by category, top stations
   → Export CSV (spreadsheet) or Export PDF (branded report)
```

## 6. AI Assistant

```
Open AI → auto-generated insight cards (profitability, trends, peak hours, top station,
  expense concentration, idle capacity, loyalty)
   → chat: ask natural-language questions ("How much profit did I make?",
     "What's my best station?", "Forecast next month")
   → Export insights as PDF
```

## 7. Auth & data lifecycle

```
Sign up / Sign in (Email or Google)
   → cloud workspace users/{uid}/… (starts EMPTY for new accounts)
   → all writes cleaned (no undefined) before hitting Firestore
Guest / demo
   → isolated local bucket, seeded with demo data ONCE
Clear all data (Settings)
   → wipes current workspace AND marks guest initialized → stays cleared, never re-seeds
Sign out
   → returns to the login screen
```

## 8. Settings (one-time studio setup)

```
Studio name + logo (resized to ~256px base64)
Currency (₹) + default tax rate
Per-type hourly rates + happy-hour rate & time window
Snack / extras menu
Business identity (email, phone, address) — shown on invoices
Bank-wire details (beneficiary, bank, account, IFSC / SWIFT, UPI, PayPal) + payment terms
```
