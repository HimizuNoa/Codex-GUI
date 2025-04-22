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
  // Send initial API key status to renderer
  mainWin.webContents.on('did-finish-load', async () => {
    try {
      const stored = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
      mainWin.webContents.send('key-status', !!stored);
    } catch (err) {
      console.error('Error fetching API key status:', err);
      mainWin.webContents.send('key-status', false);
    }
  });
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
// ---------- API Key Onboarding ----------
// Open the onboarding window for setting/changing API key
ipcMain.handle('open-onboarding', () => {
  const win = new BrowserWindow({
    width: 640,
    height: 400,
    resizable: false,
    modal: true,
    parent: mainWin,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadURL(`file://${path.join(__dirname, '../renderer/onboarding/index.html')}`);
  // Close and notify on completion
  ipcMain.once('onboarding-complete', () => {
    if (!win.isDestroyed()) win.close();
    if (mainWin && mainWin.webContents) {
      mainWin.webContents.send('key-status', true);
    }
  });
});
// ---------- Run Codex CLI ----------
// Handle execution, security scan, review, and optional auto-patch
ipcMain.handle('run-codex', async (_, { prompt, mode }) => {
  // Validate mode
  if (!MODE_OPTIONS.includes(mode)) {
    return { success: false, error: 'Invalid mode.' };
  }
  // Validate prompt
  const validation = validatePrompt(prompt);
  if (!validation.ok) {
    return { success: false, error: validation.error };
  }
  // Retrieve API key
  let apiKey;
  try {
    apiKey = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
  } catch (err) {
    console.error('Error retrieving API key:', err);
  }
  if (!apiKey) {
    return { success: false, error: 'API key not set.' };
  }
  // Scan prompt for injection attacks
  try {
    const scan = await scanPrompt(prompt, apiKey);
    if (!scan.safe) {
      return { success: false, error: 'Unsafe prompt detected: ' + scan.issues.join('; ') };
    }
  } catch (err) {
    console.error('Prompt scan failed:', err);
    return { success: false, error: 'Prompt scan failed.' };
  }
  // Execute codex CLI
  let outputStr;
  try {
    outputStr = await runCodex(mode, prompt, apiKey);
  } catch (err) {
    console.error('Codex execution failed:', err);
    return { success: false, error: err.stderr || err.message || 'Codex execution failed.' };
  }
  // Review output for security issues
  try {
    const review = await reviewOutput(outputStr, apiKey);
    if (!review.safe) {
      // Save diff for history
      saveDiff(review.diff);
      const autoPatch = store.get('autoPatch');
      if (autoPatch) {
        return { success: true, data: review.patchedCode, autoPatched: true };
      } else {
        return {
          warning: true,
          issues: review.issues,
          data: outputStr,
          patchedCode: review.patchedCode,
          diff: review.diff
        };
      }
    }
  } catch (err) {
    console.error('Review output failed:', err);
    // proceed with original output on review errors
  }
  return { success: true, data: outputStr };
});