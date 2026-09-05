const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clientAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  pair: (code, uid) => ipcRenderer.invoke('pair', { code, uid }),
  setStatus: (status) => ipcRenderer.invoke('set-status', status),
  extendTime: (minutes) => ipcRenderer.invoke('extend-time', minutes),
  onClientUpdate: (cb) => ipcRenderer.on('client-update', (e, data) => cb(data)),
  onStatusUpdate: (cb) => ipcRenderer.on('status-update', (e, data) => cb(data)),
  onTimerExpired: (cb) => ipcRenderer.on('timer-expired', (e, data) => cb(data)),
});
