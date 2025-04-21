const { session } = require('electron');
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
// Onboarding set key handler
ipcMain.handle('onboarding-set-key', async (_, key) => {
  console.log('[MAIN] Received onboarding-set-key');
  console.log('[MAIN] onboarding-set-key');
  try {
      console.log('[MAIN] Attempting keytar.setPassword...');
  await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, key.trim());
  console.log('[MAIN] keytar.setPassword successful.');
    console.log('[MAIN] key saved');
    // mainWin.webContents.send('key-status', true);
  } catch (err) {
    console.error('[MAIN] key save failed', err);
  }
  // proceed regardless of key save result
  ipcMain.emit('onboarding-complete');
  return { success: true };
});

// Inject CSP header to include frame-ancestors
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; frame-ancestors 'self';";
    const headers = details.responseHeaders;
    headers['Content-Security-Policy'] = [csp];
    callback({ responseHeaders: headers });
  });
  try {
    const ok = await ensureApiKey();
    if (!ok) {
      dialog.showErrorBox('Setup required', 'API key setup was not completed. The app will now quit.');
      return app.quit();
    }
    createMainWindow();
  } catch (err) {
    console.error('Error during startup sequence:', err);
    app.quit();
  }
});
const path = require('path');
const keytar = require('keytar');
const logger = require('../services/logger');
const Store = require('electron-store');
const store = new Store({defaults:{autoPatch:false}});
const isDev = process.env.NODE_ENV === 'development';

const { KEYTAR_SERVICE, KEYTAR_ACCOUNT, MODE_OPTIONS } = require('../config');
const validatePrompt = require('../services/validatePrompt');
const runCodex = require('../services/runCodex');
const reviewOutput = require('../services/reviewOutput');
const { saveDiff, listDiffs, loadDiff } = require('../services/diffStore');
const { scanPrompt } = require('../utils/promptScanner');

let mainWin;

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWin.loadURL(
    isDev
      ? 'http://localhost:5173'
      : `file://${path.join(__dirname, '../dist/index.html')}`
  );
}


async function ensureApiKey() {
  const stored = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
  if (stored) return true;

  return new Promise((resolve) => {
    const setupWin = new BrowserWindow({
      width: 640,
      height: 400,
      resizable: false,
      modal: true,
      parent: mainWin || undefined,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    setupWin.loadURL(`file://${path.join(__dirname, '../renderer/onboarding/index.html')}`);
    ipcMain.once('onboarding-complete', () => {
  console.log('[MAIN] Received onboarding-complete signal. Resolving promise and closing window.');
      resolve(true);
      if (!setupWin.isDestroyed()) setupWin.close();
    });
    setupWin.on('closed', () => {
      resolve(false);
    });
  });
}

// ---------- Settings ----------
ipcMain.handle('get-user-settings', ()=>({autoPatch:store.get('autoPatch')}));

ipcMain.handle('set-user-settings', (_, cfg)=>{ 
  store.set('autoPatch', !!cfg.autoPatch);
  return true;
});

ipcMain.handle('open-settings', () => {
  const win=new BrowserWindow({
    width:500,height:300,resizable:false,
    parent:mainWin,modal:true,
    webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false}
  });
  win.loadURL(`file://${path.join(__dirname,'../renderer/settings/index.html')}`);
});

// ---------- Diff history ----------
ipcMain.handle('list-diffs', () => listDiffs());
ipcMain.handle('get-diff', (_ , filePath) => {
  const data=loadDiff(filePath);
  if(!data) return {error:'E_PATH'};
  return {data};
});