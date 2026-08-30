# TRD — Technical Requirements Document
### Gaming Lounge Management OS

---

## 1. Stack
- **Frontend:** React 19 + Vite (build tool) + TypeScript + Tailwind CSS v4.
- **Backend / DB:** Cloud Firestore (NoSQL, Spark tier), data scoped per user at
  `users/{uid}/{collection}/{doc}`.
- **Auth:** Firebase Authentication — Email/Password **and** Google sign-in; plus a local
  "guest" demo mode.
- **Build:** `vite-plugin-singlefile` → one inlined `dist/index.html` (easy to host anywhere).
- **Libraries:** `jspdf` + `jspdf-autotable` (PDF), `recharts` (charts), `lucide-react`
  (icons), `firebase` (auth + firestore).

## 2. Why no Cloud Functions in v1
Cloud Functions on Firebase now require a **Blaze (billing-enabled)** project. To keep this
genuinely $0 with no card on file, all logic (timers, cost calculation, totals, receipts) runs
client-side and is written/read as plain data in Firestore. Cloud Functions can be added later
(e.g., scheduled nightly reports) once Blaze is enabled.

## 3. Spark Plan constraints (designed around)
- **Firestore:** 1 GiB storage, 50K reads / 20K writes & deletes per day (resets ~midnight PT).
- **Auth:** free up to 50K monthly active users — irrelevant at this scale.
- **Cloud Storage is NOT on Spark** → no large image uploads. Logos are resized to ~256px
  base64 and stored **inside Firestore** (small field), not in Storage.
- One real-time `onSnapshot` listener per collection keeps reads minimal (no polling).

## 4. Real-time & Offline
- Every collection uses a Firestore `onSnapshot` listener, so all counter devices update
  instantly when a session starts/stops elsewhere.
- Firestore **offline persistence** is enabled, so a brief internet drop doesn't lose an
  in-progress session — writes sync once reconnected.
- The UI shows a slim **offline banner** ("Offline — changes will sync when reconnected").
- If Firestore is unreachable (e.g., rules block access), the app falls back to a per-user
  local-storage mode so it still works.

## 5. Data isolation & Security Rules
- Each signed-in user owns a private workspace: `users/{uid}/…`.
- Guest/demo uses an isolated local-storage bucket (seeded once, never re-seeded after clear).
- **Never write `undefined` to Firestore** — it throws and is swallowed by `.catch()`, causing
  silent save failures. The store wraps every write in a `clean()` helper that strips
  `undefined` recursively.
- Rules (paste in Firebase Console → Firestore → Rules):
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

## 6. Billing math (client-side)
- Live cost during a session: `(elapsedHours × hourlyRate)` updated every second.
- Final cost on stop: rounds **up to 30-minute increments** (configurable in `format.ts`
  → `finalizeSessionCost`), then adds snack/extras.
- Stopping a session: writes the completed session **and** a receipt `bills` doc
  (`fromSession: true`). Revenue/KPI code excludes `fromSession` bills to avoid double counting.

## 7. Invoicing
- Numbering: `LUX-YYYY-00X` (auto-incremented per account).
- Two outputs kept in sync: `drawInvoice()` in `pdf.ts` (luxury A4) and `BillViewModal` in
  `Bills.tsx` (on-screen + printable).
- Luxury palette: ink-black `#1a1a1a` on warm neutrals, champagne-gold `#B8945F` accents,
  serif (Times in PDF / `font-serif` on screen), generous white space, bank-wire remittance
  block + upscale thank-you.
- ₹ is rendered as **"Rs."** inside PDFs (standard fonts can't show ₹); UI keeps ₹.

## 8. Build & deploy
- `npm run build` → `dist/index.html`.
- Deploy the single file to any static host (Firebase Hosting, Netlify, Vercel, GitHub Pages).
- No server, no secrets at runtime beyond the public Firebase config.
