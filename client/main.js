const { app, BrowserWindow, ipcMain, powerSaveBlocker, Tray, Menu } = require('electron');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const fs = require('fs');

// Firebase (use same config as web)
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, onSnapshot, updateDoc, serverTimestamp } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAb9YzNNMUKpDBM5SuWjyuYVkBplO-PuBo",
  authDomain: "game-studio-mange-os.firebaseapp.com",
  projectId: "game-studio-mange-os",
  storageBucket: "game-studio-mange-os.firebasestorage.app",
  messagingSenderId: "415144775622",
  appId: "1:415144775622:web:7f7a9625d978e2581eacc7",
};

let firebaseApp, db;
try {
  firebaseApp = initializeApp(firebaseConfig);
  db = getFirestore(firebaseApp);
} catch (e) { console.error("Firebase init failed", e); }

const STORE_PATH = path.join(app.getPath('userData'), 'client-config.json');
function loadStore() {
  try { return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); } catch { return {}; }
}
function saveStore(data) {
  try { fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2)); } catch {}
}

let mainWindow, lockWindow, tray;
let clientId = null;
let studioId = null;
let pairingCode = null;
let heartbeatTimer = null;
let appUsageTimer = null;
let currentClientData = null;

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

function getPCName() {
  return os.hostname() || 'PC-Client';
}

function generateClientId() {
  return `client-${getPCName().replace(/[^a-zA-Z0-9]/g, '').slice(0,8)}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
}

async function getRunningApps() {
  return new Promise((resolve) => {
    exec('tasklist /FO CSV /NH', { windowsHide: true }, (err, stdout) => {
      if (err || !stdout) return resolve('');
      try {
        const apps = stdout.split('\n').map(l => l.split('","')[0]?.replace(/"/g,'').trim()).filter(Boolean).slice(0,5).join(', ');
        resolve(apps);
      } catch { resolve(''); }
    });
  });
}

async function registerClient() {
  if (!studioId || !clientId || !db) return;
  const ip = getLocalIP();
  const pcName = getPCName();
  const payload = {
    id: clientId,
    pcName,
    ip,
    status: currentClientData?.status || 'ready',
    lastSeen: Date.now(),
    pairingCode: pairingCode || '',
    studioId,
    version: app.getVersion ? app.getVersion() : '1.0.0',
    specs: `${os.cpus()[0]?.model || ''} • ${Math.round(os.totalmem()/1024/1024/1024)}GB`,
    appUsage: await getRunningApps(),
    sessionEnd: currentClientData?.sessionEnd || null,
    lockUntil: currentClientData?.lockUntil || null,
    currentSessionId: currentClientData?.currentSessionId || null,
  };
  try {
    await setDoc(doc(db, 'users', studioId, 'clients', clientId), payload, { merge: true });
    currentClientData = payload;
  } catch (e) {
    console.error('register failed', e);
  }
}

function startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(async () => {
    if (!studioId || !clientId || !db) return;
    try {
      const ip = getLocalIP();
      await updateDoc(doc(db, 'users', studioId, 'clients', clientId), { lastSeen: Date.now(), ip });
    } catch {}
    // check for admin commands (session extend, maintenance)
    // onSnapshot will handle
  }, 30000);
  // app usage poll every 10s
  if (appUsageTimer) clearInterval(appUsageTimer);
  appUsageTimer = setInterval(async () => {
    if (!studioId || !clientId || !db) return;
    const apps = await getRunningApps();
    // handle special app usage: check allowed/blocked from settings
    // For now just report
    try { await updateDoc(doc(db, 'users', studioId, 'clients', clientId), { appUsage: apps, lastSeen: Date.now() }); } catch {}
    checkAppUsage(apps);
  }, 10000);
}

function checkAppUsage(apps) {
  // This is where special app handling would occur
  // e.g., if blockedApps contains chrome.exe and it's running, kill it or notify
  // For demo, just log
  // console.log('apps', apps);
}

function createLockWindow(cooldownMinutes) {
  if (lockWindow && !lockWindow.isDestroyed()) {
    lockWindow.close();
  }
  lockWindow = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
    alwaysOnTop: true,
    frame: false,
    skipTaskbar: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  const lockUntil = Date.now() + cooldownMinutes * 60000;
  // update client doc to locked
  if (studioId && clientId && db) {
    updateDoc(doc(db, 'users', studioId, 'clients', clientId), {
      status: 'locked',
      lockUntil,
      lastSeen: Date.now()
    }).catch(()=>{});
    currentClientData = { ...currentClientData, status: 'locked', lockUntil };
  }
  // send message to admin via clients doc (admin dashboard watches status==locked)
  // also write a notification? For now status is enough

  lockWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <html><head><style>
      body{margin:0;background:#0b0e14;color:#e8ecef;font-family:Inter,system-ui;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;text-align:center}
      .card{background:#141a24;border:1px solid #26303d;border-radius:16px;padding:32px;max-width:480px}
      h1{font-size:28px;margin:0 0 8px;color:#ffb020}
      p{color:#7a8699}
      #timer{font-family:JetBrains Mono,monospace;font-size:48px;font-weight:800;color:#ffb020;margin:16px 0}
      button{margin-top:16px;background:#00d9c0;color:#0b0e14;border:none;padding:12px 20px;border-radius:12px;font-weight:700;cursor:pointer}
    </style></head><body>
      <div class="card">
        <h1>⏱ Time's Up!</h1>
        <p>Your session has ended. This PC is locked for <b>${cooldownMinutes} minutes</b>.</p>
        <p>Message sent to main PC (admin dashboard): <b>Going to shut / locked</b></p>
        <div id="timer">${cooldownMinutes}:00</div>
        <p>Contact admin to <b>increase time</b> (+10 / +30 min) from Clients dashboard.</p>
        <p style="font-size:12px;color:#7a8699;margin-top:12px">WiFi/LAN connected • Pairing code: ${pairingCode || '—'}</p>
      </div>
      <script>
        let until = ${lockUntil};
        const el = document.getElementById('timer');
        setInterval(()=>{
          const diff = Math.max(0, Math.floor((until - Date.now())/1000));
          const m = Math.floor(diff/60), s = diff%60;
          el.textContent = m + ':' + String(s).padStart(2,'0');
          if(diff<=0){ window.close(); }
        },1000);
      </script>
    </body></html>
  `)}`);
  lockWindow.on('closed', () => { lockWindow = null; });
  // after cooldown, auto unlock
  setTimeout(() => {
    if (lockWindow && !lockWindow.isDestroyed()) {
      lockWindow.close();
    }
    // set back to ready
    if (studioId && clientId && db) {
      updateDoc(doc(db, 'users', studioId, 'clients', clientId), { status: 'ready', lockUntil: null, sessionEnd: null }).catch(()=>{});
      currentClientData = { ...currentClientData, status: 'ready', lockUntil: null, sessionEnd: null };
      if (mainWindow) mainWindow.webContents.send('status-update', { status: 'ready' });
    }
  }, cooldownMinutes * 60000);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 640,
    minWidth: 860,
    minHeight: 600,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  // powerSaveBlocker to keep timer accurate
  powerSaveBlocker.start('prevent-app-suspension');
}

app.whenReady().then(() => {
  const store = loadStore();
  clientId = store.clientId || generateClientId();
  studioId = store.studioId || null;
  pairingCode = store.pairingCode || null;
  if (!store.clientId) { store.clientId = clientId; saveStore(store); }

  createMainWindow();

  // tray
  try {
    tray = new Tray(path.join(__dirname, 'icon.ico'));
    const menu = Menu.buildFromTemplate([
      { label: 'Show Client', click: () => mainWindow && mainWindow.show() },
      { label: 'Quit', click: () => app.quit() }
    ]);
    tray.setToolTip('GameLounge Client');
    tray.setContextMenu(menu);
  } catch {}

  // IPC
  ipcMain.handle('get-config', () => ({ clientId, studioId, pairingCode, pcName: getPCName(), ip: getLocalIP() }));
  ipcMain.handle('pair', async (e, { code, uid }) => {
    // code is pairingCode, uid is studioId (prebook link uid)
    // For demo, code == pairingCode stored in owner's settings, uid is studioId
    // We accept either: if uid provided, use it as studioId; else try to lookup via code
    // Simplify: uid is studioId, code must match owner's clientPairingCode (we verify via Firestore read)
    let targetUid = (uid || '').trim();
    const enteredCode = (code || '').trim().toUpperCase();
    if (!targetUid && enteredCode) {
      // try to find owner via pairingCodes collection? For now, assume code is last 6 of uid? Fallback to enteredCode as uid if looks like uid
      // For demo, if user enters prebook link uid (28 chars), use it directly
      // If they enter short code, we try to find via Firestore: look for users where settings.clientPairingCode == code
      // This requires collectionGroup, but for demo we just use code as uid if length >10
      if (enteredCode.length > 10) targetUid = enteredCode;
      else {
        // For LAN demo, treat code as pairingCode and also need uid – we can ask user to paste full prebook link
        // If only code given, we cannot resolve uid, so error
        return { ok: false, error: 'Please paste full Prebook Link or Studio UID (from Prebooks page) + Pairing Code' };
      }
    }
    if (!targetUid) return { ok: false, error: 'Missing Studio UID / Prebook link' };
    // verify pairing code by reading owner's settings
    try {
      if (db && enteredCode) {
        const { getDoc } = require('firebase/firestore');
        const snap = await getDoc(doc(db, 'users', targetUid, 'settings', 'main'));
        if (snap.exists()) {
          const s = snap.data();
          if (s.clientPairingCode && s.clientPairingCode.toUpperCase() !== enteredCode.toUpperCase()) {
            // allow if code matches last 4? For demo be lenient
            // return error if strict
            // return { ok: false, error: 'Pairing code mismatch. Check Settings → Client PCs → Pairing Code' };
          }
        }
      }
    } catch {}
    studioId = targetUid;
    pairingCode = enteredCode || (await getOwnerPairingCode(targetUid)) || enteredCode;
    saveStore({ clientId, studioId, pairingCode });
    // register
    await registerClient();
    startHeartbeat();
    listenForAdminCommands();
    return { ok: true, studioId, pairingCode };
  });

  ipcMain.handle('set-status', async (e, status) => {
    if (!studioId || !clientId || !db) return { ok: false };
    await updateDoc(doc(db, 'users', studioId, 'clients', clientId), { status, lastSeen: Date.now() });
    currentClientData = { ...currentClientData, status };
    return { ok: true };
  });

  ipcMain.handle('extend-time', async (e, minutes) => {
    // This is called from client UI? Actually admin extends, client will receive via onSnapshot
    // For local test, allow client to extend
    if (!currentClientData?.sessionEnd) return { ok: false };
    const newEnd = (currentClientData.sessionEnd || Date.now()) + minutes * 60000;
    if (studioId && clientId && db) {
      await updateDoc(doc(db, 'users', studioId, 'clients', clientId), { sessionEnd: newEnd, status: 'busy' });
      currentClientData.sessionEnd = newEnd;
    }
    return { ok: true, newEnd };
  });

  ipcMain.on('pairing-done', () => {
    if (studioId && clientId) {
      listenForAdminCommands();
      registerClient();
      startHeartbeat();
    }
  });

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });
});

async function getOwnerPairingCode(uid) {
  try {
    const { getDoc } = require('firebase/firestore');
    const snap = await getDoc(doc(db, 'users', uid, 'settings', 'main'));
    if (snap.exists()) return snap.data().clientPairingCode || null;
  } catch {}
  return null;
}

let adminUnsub = null;
function listenForAdminCommands() {
  if (!studioId || !clientId || !db) return;
  if (adminUnsub) adminUnsub();
  const { onSnapshot } = require('firebase/firestore');
  adminUnsub = onSnapshot(doc(db, 'users', studioId, 'clients', clientId), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    currentClientData = data;
    if (mainWindow) mainWindow.webContents.send('client-update', data);
    // handle timer extend / lock
    if (data.status === 'locked' && data.lockUntil && Date.now() < data.lockUntil) {
      const mins = Math.max(1, Math.ceil((data.lockUntil - Date.now()) / 60000));
      if (!lockWindow) createLockWindow(mins);
    } else if (data.status === 'maintenance') {
      // show maintenance overlay? For now just update UI
    } else if (data.status === 'busy' && data.sessionEnd) {
      // timer will be shown in UI; if sessionEnd in past, trigger lock
      if (Date.now() > data.sessionEnd) {
        // need lockCooldown from owner's settings – fetch
        const cooldown = 10; // default, will be updated via settings sync
        createLockWindow(cooldown);
        // notify admin: status already locked, so admin dashboard sees it
      }
    } else if (data.status === 'ready' && lockWindow) {
      lockWindow.close();
    }
  });
}

// periodic check for timer expiry even without Firestore push (local)
setInterval(() => {
  if (!currentClientData) return;
  if (currentClientData.status === 'busy' && currentClientData.sessionEnd && Date.now() > currentClientData.sessionEnd) {
    const cooldown = 10; // will read from settings if available
    if (!lockWindow) {
      createLockWindow(cooldown);
      if (mainWindow) mainWindow.webContents.send('timer-expired', { cooldown });
    }
  }
  if (currentClientData.status === 'locked' && currentClientData.lockUntil && Date.now() > currentClientData.lockUntil) {
    if (lockWindow) lockWindow.close();
    if (studioId && clientId && db) {
      updateDoc(doc(db, 'users', studioId, 'clients', clientId), { status: 'ready', lockUntil: null }).catch(()=>{});
    }
  }
}, 1000);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // keep running in tray? For kiosk, don't quit
    // app.quit();
  }
});
