# PRD — Product Requirements Document
### Gaming Lounge Management OS

---

## 1. Purpose
A web app for gaming café / lounge owners to manage PC and console (PS5/PS4/VR/Racing)
station rentals — timing sessions, billing customers, tracking customers & expenses, and
viewing daily revenue — built entirely on Firebase's free (Spark) tier.

## 2. Target Users
- **Owner / Admin** — full access: stations, rates, reports, customers, expenses, settings.
- **Staff / Counter operator** — daily use: start/stop sessions, take payments, log snack
  sales, add customers. (Phase 2 will add explicit staff roles.)
- **Guest / demo** — explore the product locally without an account.

## 3. Goals
- Replace manual notebook/Excel billing with real-time session tracking.
- Reduce billing errors and give the owner a live revenue dashboard.
- Work fully within Firebase's free quotas — no cost to run for a single-location lounge.
- Produce clean, professional, printable/PDF invoices for customers.

## 4. MVP Feature Scope (Phase 1) — ✅ Shipped
| Module | Status |
|---|---|
| Station Dashboard | ✅ Live grid grouped by type (Free / Occupied / Maintenance), start/stop timer |
| Session Billing | ✅ Auto-calc cost on stop, manual rate override, snacks/extras, payment method |
| Customer Log | ✅ Name/phone, visit history, prepaid balance, lifetime spend |
| Rate Management | ✅ Per-station-type hourly rates + happy-hour rate & window |
| Payment Logging | ✅ Cash/UPI/Card per session, daily/period revenue |
| Snacks / Extras | ✅ Editable snack catalog billed with a session |
| Expenses | ✅ Categorized expense tracking + breakdown |
| Reports | ✅ Daily revenue, busiest hours, top stations, CSV & PDF export |
| Invoices / Bills | ✅ Formal luxury invoices (LUX-YYYY-00X), PDF + print, bank-wire details |
| AI Assistant | ✅ Auto-generated insights + natural-language Q&A |

## 5. Phase 2 (later)
- Explicit staff role + shift log (role-based Firestore rules).
- Advance booking / reservation calendar.
- Loyalty / prepaid packages (10-hr pack, monthly pass) using the existing `prepaidBalance`.
- Multi-location support.
- AI-based peak-hour prediction.

## 6. Out of Scope (v1)
- Online payment gateway integration.
- Native mobile app (web app, mobile-responsive, is enough for v1).
- Large image/photo uploads via Firebase Storage (Spark limitation) — small base64 logos only.

## 7. Success Metrics
- Session billed within a few seconds of the Stop/Bill tap.
- Zero double-booking of a station (a station's status gates a new start).
- Owner sees "today's revenue" in one screen load.
- Invoice PDF renders correctly and aligns cleanly on one A4 page.
