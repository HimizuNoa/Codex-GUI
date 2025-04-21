const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  listDiffs: ()=>ipcRenderer.invoke('list-diffs'),
  getDiff: (path)=>ipcRenderer.invoke('get-diff', path),
  onToast: (cb) => ipcRenderer.on('toast', (_, msg) => cb(msg)),
  onKeyStatus: (cb) => ipcRenderer.on('key-status', (_, status) => cb(status)),
  onDebug: (cb) => ipcRenderer.on('debug', (_, info) => cb(info))
});
// Expose onboarding IPC to renderer
contextBridge.exposeInMainWorld('onboardAPI', {
  saveKey: (key) => ipcRenderer.invoke('onboarding-set-key', key),
  complete: () => ipcRenderer.send('onboarding-complete')
});