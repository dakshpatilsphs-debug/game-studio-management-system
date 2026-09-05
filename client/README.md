# GameLounge Client (EXE) — PC Agent

Install this **Electron** app on **each gaming PC** (PC / PS-linked PC / VR rig). It connects via **WiFi/LAN** (Firebase) using a **special pairing code** and appears live in **Admin → PC Clients** dashboard with status `Ready / Busy / Maintenance / Locked`.

## Features (as requested)

- **Live status**: `ready` (free), `busy` (timer running), `maintenance` (admin toggled), `locked` (cooldown), `offline` (no heartbeat >90s). Admin sees IP, specs, app usage, timer.
- **Special app usage handling**: Client polls `tasklist` every 10s, reports `appUsage` to dashboard. Settings `allowedApps` / `blockedApps` (comma list) at admin controls what is allowed — client can be extended to kill blocked apps.
- **Timer + 10-min lock**: When admin starts a session (or prebook converted), client receives `sessionEnd`. Countdown in client. At `00:00`:
  - Client shows fullscreen **kiosk lock** ("Time's Up! PC locked for 10 min") — **cannot be accessed** until cooldown ends.
  - **Message to main PC**: Admin dashboard sees `locked` with countdown `lockUntil` — “going to shut / locked”.
  - After `lockCooldownMinutes` (editable in Settings → Client PCs, default **10**), PC auto-unlocks to `ready`. Cooldown message disappears.
- **Increase time**: Admin in **PC Clients** can click **+10 / +30 / +60** → `extendClientTime` updates `sessionEnd` in Firestore → client instantly extends timer and unlocks if was locked. Also Unlock Now button.
- **WiFi/LAN + special code**: All PCs on same WiFi/LAN install same EXE, enter **same Pairing Code** (`Settings → Client PCs → Pairing Code`, unique per studio/user) + **Prebook Link UID** (`Prebooks → Prebook Link ?prebook=UID`). Pairing writes to `users/{studioId}/clients/{clientId}` — admin dashboard queries that collection, so **only that studio's PCs show** (different user = different link/code = different dashboard).

## Build EXE (Windows)

```bash
cd client
npm install
npm run build   # -> dist/GameLounge Client Setup.exe (NSIS installer)
# or for portable dir:
npm run pack
```

Requires Node 18+ and internet (Firebase). Output is single `dist/index.html`-style singlefile? No, client is separate Electron installer.

Icon: replace `icon.ico` with your logo.

## Pairing Steps (for each PC)

1. Admin: open web app → **Settings** → **Client PCs** → note `Pairing Code` (e.g., `LUX4A9`) → **Prebooks** → copy `Prebook Link` → extract UID after `?prebook=` (e.g., `Ab9Yz...` or `guest` for demo).
2. On gaming PC: install `GameLounge-Client-Setup.exe` → launch → paste **Studio UID / Prebook Link** + **Pairing Code** → **Pair & Connect**.
3. Admin → **PC Clients** → new card appears with IP, status `ready`, green dot.

All PCs on same WiFi/LAN with same code appear together; different studio's code shows only theirs.

## Firestore Rules (add to allow public prebooks + clients read, pairing)

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    // public prebook creation + client heartbeat (unauthenticated can create client/prebook for that studio)
    match /users/{userId}/prebooks/{docId} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId}/clients/{docId} {
      allow read: if request.auth != null && request.auth.uid == userId; // admin reads
      allow create, update: if true; // client can write (pairingCode check in app)
    }
    match /pairingCodes/{code} {
      allow read, write: if true;
    }
  }
}
```

For Spark free tier, local fallback via `localStorage` also works if offline.

## Admin Controls

- **PC Clients** page: see all, timer live, lock countdown, app usage.
- Buttons: **+10 / +30 / +60** (extend), **Maintenance ↔ Ready**, **Unlock Now**, **Delete**.
- **Settings**: edit `Pairing Code` (Regen), `Lock cooldown`, `Allowed/Blocked apps`.

## Demo without EXE

For demo, store seeds 4 clients: `PC-01` ready, `PC-02` busy (45 min left), `VR-01` maintenance, `PC-04` locked (8 min). They appear in **PC Clients** even without installing.

## Notes

- Client needs internet for Firebase (WiFi). For pure LAN without internet, future: run local relay server on main PC.
- Timer is server-time based (client uses `sessionEnd` epoch ms from admin). Admin increase instantly propagates via `onSnapshot`.
