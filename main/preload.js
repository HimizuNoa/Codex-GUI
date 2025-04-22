const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  listDiffs: ()=>ipcRenderer.invoke('list-diffs'),
  getDiff: (path)=>ipcRenderer.invoke('get-diff', path),
  onToast: (cb) => ipcRenderer.on('toast', (_, msg) => cb(msg)),
  onKeyStatus: (cb) => ipcRenderer.on('key-status', (_, status) => cb(status)),
  onDebug: (cb) => ipcRenderer.on('debug', (_, info) => cb(info)),
  // Working folder APIs
  selectWorkingFolder: () => ipcRenderer.invoke('select-working-folder'),
  getWorkingFolder: () => ipcRenderer.invoke('get-working-folder'),
  onWorkingFolderChanged: (cb) => ipcRenderer.on('working-folder-changed', (_, folder) => cb(folder)),
  // Run logs
  onRunLog: (cb) => ipcRenderer.on('run-log', (_, msg) => cb(msg)),
  // File browser APIs
  listFiles: () => ipcRenderer.invoke('list-files'),
  readFile: (relPath) => ipcRenderer.invoke('read-file', relPath),
  writeFile: (opts) => ipcRenderer.invoke('write-file', opts),
  // Shell scanning API
  scanShell: (cmd, args) => ipcRenderer.invoke('scan-shell', cmd, args),
  // Shell execution APIs
  executeShell: (cmd, args) => ipcRenderer.send('exec-shell', cmd, args),
  onShellLog: (cb) => ipcRenderer.on('shell-log', (_, log) => cb(log)),
  onShellExit: (cb) => ipcRenderer.on('shell-exit', (_, code) => cb(code)),
  deleteFile: (relPath) => ipcRenderer.invoke('delete-file', relPath),
  // Config file import/export
  importConfig: () => ipcRenderer.invoke('import-config'),
  exportConfig: () => ipcRenderer.invoke('export-config'),
  getCliHelp: () => ipcRenderer.invoke('get-cli-help'),
  // Context store APIs
  context: {
    add: (entry) => ipcRenderer.invoke('context:add', entry),
    list: () => ipcRenderer.invoke('context:list'),
    clear: () => ipcRenderer.invoke('context:clear')
  },
  // Memory store APIs
  memory: {
    add: (node) => ipcRenderer.invoke('memory:add', node),
    list: () => ipcRenderer.invoke('memory:list'),
    query: (filter) => ipcRenderer.invoke('memory:query', filter)
  },
  // LLM model settings APIs
  getLlmModels: () => ipcRenderer.invoke('get-llm-models'),
  setLlmModels: (models) => ipcRenderer.invoke('set-llm-models', models),
  // Report false-positive prompt flagging
  reportPromptFlag: (args) => ipcRenderer.invoke('report-prompt-flag', args),
});
// Expose onboarding IPC to renderer
contextBridge.exposeInMainWorld('onboardAPI', {
  saveKey: (key) => ipcRenderer.invoke('onboarding-set-key', key),
  complete: () => ipcRenderer.send('onboarding-complete')
});