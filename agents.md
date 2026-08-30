# AGENTS.md

A guide for AI coding agents and contributors working on **Gaming Lounge Management OS**.
Read this before making changes.

---

## 1. What this project is

A web app for gaming café / lounge owners to manage PC & console (PS5/PS4/VR/Racing)
station rentals — live session timing, billing, customers, expenses, reports and an AI
assistant. Built entirely on **Firebase's free (Spark) tier**.

- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS v4
- **Backend / DB:** Cloud Firestore (NoSQL), data scoped per user at `users/{uid}/…`
- **Auth:** Firebase Authentication — Email/Password **and** Google sign-in, plus a local
  "demo" (guest) mode
- **PDF:** `jspdf` + `jspdf-autotable` (invoices, receipts, reports)
- **Charts:** `recharts`
- **Build output:** single inlined `dist/index.html` (via `vite-plugin-singlefile`)

> No Cloud Functions are used — all billing math runs client-side so the project stays on
> the $0 Spark plan.

---

## 2. Commands

```bash
npm run dev      # local dev server
npm run build    # production build -> dist/index.html
npm run preview  # preview the production build
```

> Never edit `package.json` or `vite.config.ts` directly. Use the install tool for packages.

---

## 3. Project structure

```
index.html                # fonts (Space Grotesk / Inter / JetBrains Mono), title, favicon
src/
  main.tsx                # React entry
  App.tsx                 # providers (Auth -> Data -> Toast) + page router + auth gate
  index.css               # Tailwind v4 theme tokens (color system, animations, print rules)
  lib/
    firebase.ts           # Firebase init (config, auth, firestore w/ offline persistence)
    auth.tsx              # AuthProvider — login/signup/google/guest, onAuthStateChanged
    store.tsx             # DataProvider — per-user data layer (cloud + local fallback)
    types.ts              # all domain types (Station, GameSession, Bill, Customer, Settings…)
    format.ts             # money/date/duration helpers, billing math (finalizeSessionCost)
    ai.ts                 # KPIs, insight engine, rule-based chat
    pdf.ts                # luxury invoice + report + insights PDF generators
    image.ts             # logo resize (fileToLogo), auth error messages
  components/
    Layout.tsx            # sidebar shell, Settings modal (rates, snacks, business/bank details)
    ui.tsx                # Card, Button, Modal, Input, Select, StatCard, Badge, Skeleton…
    Toaster.tsx           # toast context + UI
    SessionModals.tsx     # StartSessionModal + BillSessionModal (stop & bill w/ receipt)
    AuthScreen.tsx        # login / signup / google / guest
  pages/
    Dashboard.tsx         # station floor grid (hero), live sessions, AI CTA
    Rentals.tsx           # station CRUD + session history
    Customers.tsx         # customer log + visit history
    Bills.tsx             # invoices (create/view/print/PDF), LUX-YYYY-00X numbering
    Expenses.tsx          # expense CRUD + category breakdown
    Reports.tsx           # charts + CSV/PDF export
    AI.tsx                # insights + chat
```

---

## 4. Data model (Firestore)

All collections live under a user's private workspace:

```
users/{uid}/
  stations/{id}        name, type, hourlyRate, status, specs
  sessions/{id}        customerId?, stationId, startTime, endTime?, status, baseAmount,
                       extrasAmount, extras[], paymentMethod?, totalCost
  expenses/{id}        description, category, amount, date
  bills/{id}           billNumber, customerName, items[], subtotal, taxRate, taxAmount,
                       discount, total, paymentMethod, createdAt, fromSession?, dueDate?,
                       clientCompany?, clientAddress?
  customers/{id}       name, phone, prepaidBalance, totalVisits, createdAt
  settings/main        studioName, currency, taxRate, logo?, rates{}, snacks[],
                       businessEmail/Phone/Address, upiId, bank*, swift?, beneficiary?,
                       paypal?, paymentTerms?
```

---

## 5. Firebase setup (required for cloud sync)

1. **Authentication → Sign-in method:** enable **Email/Password** and **Google**.
2. **Authentication → Settings → Authorized domains:** add your hosting domain.
3. **Firestore → Rules:** (per-user isolation)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 6. Critical conventions

- **Never write `undefined` to Firestore.** Firestore rejects it and the `.catch()` swallows
  the error, so data silently fails to save. Always pass objects through the exported
  `clean()` helper in `store.tsx` before `addDoc` / `updateDoc` / `setDoc`.
- **Per-user isolation.** Guest uses a local `gsm_guest_*` bucket (seeded once). Each signed-in
  account gets its own `gsm_<uid>_*` local bucket AND its own Firestore workspace. New accounts
  start empty; "Clear all data" stays cleared.
- **Session receipts.** Stopping/billing a session from the dashboard also writes a `bills`
  doc with `fromSession: true`. Revenue calcs **exclude** `fromSession` bills to avoid
  double counting (the session itself already carries the revenue).
- **Money in PDFs.** Standard PDF fonts can't render ₹, so `pdf.ts` renders it as "Rs." via
  `pdfSym()`. The on-screen UI still shows ₹ everywhere.
- **Currency is ₹ (INR)** by default; configurable in Settings.

---

## 7. Design system

- Dark "control room" theme. Status = color:
  `free #00D9C0`, `occupied #FF6B4A`, `warn #FFB020`, `danger #F0455C`.
- Fonts: Space Grotesk (display), Inter (UI), JetBrains Mono (timers/prices, `tabular-nums`).
- Motion is functional only and respects `prefers-reduced-motion`.
- The **invoice** uses a separate luxury treatment (ink-black + champagne-gold, serif).

---

## 8. Typical tasks

- **Add a field to an entity:** update `types.ts`, the Settings modal / page form, the store
  mutation (wrapped in `clean()`), and the PDF/view if it should print.
- **Change the invoice layout:** edit `drawInvoice()` in `pdf.ts` **and** the `BillViewModal`
  in `Bills.tsx` (keep them in sync).
- **New report:** compute in `ai.ts` (`computeKPIs`) or inline in the page; reuse
  `generateReportPDF` / `generateInsightsPDF`.
