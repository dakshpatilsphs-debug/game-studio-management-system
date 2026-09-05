let currentData = null;
let timerInterval = null;

async function init() {
  const cfg = await window.clientAPI.getConfig();
  document.getElementById('pcInfo').textContent = `${cfg.pcName} • ${cfg.ip} • ${cfg.clientId.slice(0,8)}`;
  if (cfg.studioId && cfg.pairingCode) {
    document.getElementById('uidInput').value = cfg.studioId;
    document.getElementById('codeInput').value = cfg.pairingCode;
    document.getElementById('pairCard').classList.add('hidden');
    document.getElementById('statusCard').classList.remove('hidden');
    document.getElementById('studioInfo').textContent = `Paired to ${cfg.studioId.slice(0,8)}… • Code ${cfg.pairingCode} • WiFi/LAN connected`;
  }
  window.clientAPI.onClientUpdate((data) => {
    currentData = data;
    renderStatus(data);
  });
  window.clientAPI.onTimerExpired((data)=>{
    // lock handled in main, just update UI
    renderStatus(currentData);
  });
}

function renderStatus(data) {
  if (!data) return;
  const pill = document.getElementById('statusPill');
  const dot = pill.querySelector('.status-dot');
  const map = { ready: '#00d9c0', busy: '#ff6b4a', maintenance: '#ffb020', locked: '#f0455c', offline: '#7a8699' };
  pill.innerHTML = `<span class="status-dot" style="background:${map[data.status]||'#7a8699'}"></span> ${data.status}`;
  document.getElementById('appUsage').textContent = data.appUsage || '—';
  
  // fetch cooldown from settings? For now show from data or default 10
  const timerBox = document.getElementById('timerBox');
  const readyBox = document.getElementById('readyBox');
  if (data.status === 'busy' && data.sessionEnd) {
    timerBox.classList.remove('hidden');
    readyBox.classList.add('hidden');
    startTimer(data.sessionEnd);
  } else if (data.status === 'locked') {
    timerBox.classList.remove('hidden');
    readyBox.classList.add('hidden');
    document.getElementById('timer').textContent = 'LOCKED';
    document.getElementById('timer').style.color = '#ffb020';
  } else {
    timerBox.classList.add('hidden');
    readyBox.classList.remove('hidden');
    stopTimer();
  }
}

function startTimer(endTs) {
  stopTimer();
  const el = document.getElementById('timer');
  el.style.color = '#ff6b4a';
  function tick() {
    const diff = Math.max(0, Math.floor((endTs - Date.now())/1000));
    const m = Math.floor(diff/60), s = diff%60;
    el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    if (diff <= 0) {
      clearInterval(timerInterval);
      el.textContent = '00:00 — LOCKING';
    }
  }
  tick();
  timerInterval = setInterval(tick, 1000);
}
function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
}

async function pair() {
  const uidRaw = document.getElementById('uidInput').value.trim();
  let uid = uidRaw;
  // extract ?prebook= from link if pasted full URL
  try {
    if (uidRaw.includes('?prebook=')) uid = new URL(uidRaw).searchParams.get('prebook') || uidRaw;
    else if (uidRaw.includes('prebook')) {
      const m = uidRaw.match(/prebook[=/]([A-Za-z0-9_-]+)/);
      if (m) uid = m[1];
    }
  } catch {}
  const code = document.getElementById('codeInput').value.trim().toUpperCase();
  const btn = document.getElementById('pairBtn');
  btn.disabled = true;
  btn.textContent = 'Pairing...';
  const res = await window.clientAPI.pair(code, uid);
  const msg = document.getElementById('pairMsg');
  if (res.ok) {
    msg.textContent = 'Paired! PC will appear in Admin → PC Clients via WiFi/LAN.';
    msg.style.color = '#00d9c0';
    setTimeout(()=> location.reload(), 800);
  } else {
    msg.textContent = res.error || 'Pair failed';
    msg.style.color = '#f0455c';
    btn.disabled = false;
    btn.textContent = 'Pair & Connect';
  }
}

async function setStatus(s) {
  await window.clientAPI.setStatus(s);
}

async function unpair() {
  localStorage.clear();
  // also clear store file via main? For now just reload and clear
  // we need to clear electron store file – main will handle on next pair? Simulate by clearing and reloading
  // call pair with empty to clear? We'll just reload and the main store still has old pairing – need to clear via IPC not yet implemented
  // For demo, just clear inputs and show pair card
  document.getElementById('pairCard').classList.remove('hidden');
  document.getElementById('statusCard').classList.add('hidden');
  document.getElementById('pairMsg').textContent = 'Unpaired locally. Restart client and re-pair, or delete client-config.json';
}

document.getElementById('pairBtn').addEventListener('click', pair);
document.getElementById('codeInput').addEventListener('keydown', e=>{ if(e.key==='Enter') pair(); });
init();
