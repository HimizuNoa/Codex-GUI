const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const path = require('path');
const keytar = require('keytar');
const logger = require('../services/logger');
const { spawn } = require('child_process');
// Scan shell commands via LLM before execution
const { scanShell } = require('../services/shellScanner');
// Shell execution IPC: run arbitrary shell commands and stream logs
// IPC to scan shell commands
ipcMain.handle('scan-shell', async (_, cmd, args = []) => {
  // Retrieve stored API key
  let apiKey;
  try { apiKey = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT); } catch {};
  if (!apiKey) {
    return { safe: false, issues: ['API key not set'] };
  }
  return scanShell([cmd, ...(args || [])].join(' '), apiKey);
});
// ---------- CLI Help ----------
ipcMain.handle('get-cli-help', async () => {
  // Spawn codex CLI with --help
  const vendorCli = path.resolve(__dirname, '..', 'vendor', 'codex', 'codex-cli', 'bin', 'codex.js');
  let cmd = 'codex';
  let args = ['--help'];
  if (fs.existsSync(vendorCli)) {
    cmd = process.execPath;
    args = [vendorCli, '--help'];
  }
  return new Promise((resolve) => {
    let helpText = '';
    try {
      const child = spawn(cmd, args, { shell: true });
      child.stdout.on('data', (chunk) => { helpText += chunk.toString(); });
      child.stderr.on('data', (chunk) => { helpText += chunk.toString(); });
      child.on('close', () => resolve(helpText));
    } catch (err) {
      resolve(`Failed to get help: ${err.message}`);
    }
  });
});
// IPC to execute shell commands after scanning
ipcMain.on('exec-shell', (event, cmd, args = []) => {
  try {
    const child = spawn(cmd, args, { shell: true });
    child.stdout.on('data', (chunk) => {
      event.sender.send('shell-log', { type: 'stdout', data: chunk.toString() });
    });
    child.stderr.on('data', (chunk) => {
      event.sender.send('shell-log', { type: 'stderr', data: chunk.toString() });
    });
    child.on('close', (code) => {
      event.sender.send('shell-exit', code);
    });
  } catch (err) {
    event.sender.send('shell-log', { type: 'stderr', data: err.message });
    event.sender.send('shell-exit', -1);
  }
});
const Store = require('electron-store');
// Persist user settings (autoPatch, workingFolder)
// Import central config for defaults
const config = require('../config');
const store = new Store({
  defaults: {
    autoPatch: false,
    workingFolder: '',
    // CLI options for codex flags
    cliOptions: {
      model: config.MAIN_MODEL || '',
      temperature: 0.0,
      max_tokens: null,
      top_p: null,
      n: null,
      stream: false,
      stop: [],
      logprobs: null
    },
    // History of prompts
    promptHistory: []
    ,
    // User-configurable LLM models
    promptModel: config.LLM_PROMPT_MODEL,
    reviewModel: config.LLM_REVIEW_MODEL
  }
});
const isDev = process.env.NODE_ENV === 'development';

const { KEYTAR_SERVICE, KEYTAR_ACCOUNT, MODE_OPTIONS } = require('../config');
const fs = require('fs');
const validatePrompt = require('../services/validatePrompt');
const runCodex = require('../services/runCodex');
const reviewOutput = require('../services/reviewOutput');
const { OpenAI } = require('openai');
const { saveDiff, listDiffs, loadDiff } = require('../services/diffStore');
const { scanPrompt } = require('../utils/promptScanner');
// Utility: parse output for code fences and write to files
function saveFilesFromOutput(outputText) {
  const files = {};
  const re = /```(html|css|javascript)[\r\n]([\s\S]*?)```/gi;
  let m;
  while ((m = re.exec(outputText))) {
    const lang = m[1].toLowerCase();
    const content = m[2];
    let name = 'file';
    if (lang === 'html') name = 'index.html';
    else if (lang === 'css') name = 'style.css';
    else if (lang === 'javascript') name = 'script.js';
    files[name] = content;
  }
  const wf = store.get('workingFolder') || process.cwd();
  const saved = [];
  for (const [fname, cont] of Object.entries(files)) {
    try {
      fs.writeFileSync(path.join(wf, fname), cont, 'utf-8');
      saved.push(fname);
    } catch (e) {
      console.error('saveFilesFromOutput error:', e);
    }
  }
  return saved;
}
const { addContext, listContext, clearContext } = require('../services/contextStore');
const { addNode, listNodes, queryNodes } = require('../services/memoryStore');

// Escape HTML special characters to prevent XSS
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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
  // Check if key is stored in system keytar
  let stored = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
  // If not stored, but environment variable provided, save it and proceed
  if (!stored && process.env.OPENAI_API_KEY) {
    try {
      await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, process.env.OPENAI_API_KEY.trim());
      stored = process.env.OPENAI_API_KEY.trim();
    } catch (err) {
      console.error('Failed to save API key from environment variable:', err);
    }
  }
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
/**
 * Return the directory for auto-saving HTML outputs.
 */
function getOutputDir() {
  const wf = store.get('workingFolder');
  const dir = wf ? path.join(wf, '.codex-gui', 'outputs') : path.join(__dirname, '..', 'outputs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ---------- Settings ----------
ipcMain.handle('get-user-settings', ()=>({autoPatch:store.get('autoPatch')}));

ipcMain.handle('set-user-settings', (_, cfg)=>{ 
  store.set('autoPatch', !!cfg.autoPatch);
  return true;
});
// CLI options handlers
ipcMain.handle('get-cli-options', () => {
  return store.get('cliOptions');
});
ipcMain.handle('set-cli-options', (_, opts) => {
  store.set('cliOptions', opts);
  return true;
});
// ---------- LLM Model Settings ----------
ipcMain.handle('get-llm-models', () => {
  return {
    promptModel: store.get('promptModel'),
    reviewModel: store.get('reviewModel')
  };
});
ipcMain.handle('set-llm-models', (_, { promptModel, reviewModel }) => {
  if (promptModel != null) store.set('promptModel', promptModel);
  if (reviewModel != null) store.set('reviewModel', reviewModel);
  return true;
});

// ---------- Context Store IPC ----------
ipcMain.handle('context:add', (_, entry) => addContext(entry));
ipcMain.handle('context:list', () => listContext());
ipcMain.handle('context:clear', () => clearContext());

// ---------- Memory Store IPC ----------
ipcMain.handle('memory:add', (_, node) => addNode(node));
ipcMain.handle('memory:list', () => listNodes());
ipcMain.handle('memory:query', (_, filter) => queryNodes(filter));
// Prompt history APIs
ipcMain.handle('get-prompt-history', () => {
  return store.get('promptHistory') || [];
});
ipcMain.handle('add-prompt-history', (_, entry) => {
  const hist = store.get('promptHistory') || [];
  const newHist = [entry, ...hist];
  store.set('promptHistory', newHist);
  return newHist;
});
// Config file import/export
ipcMain.handle('import-config', async () => {
  const wf = store.get('workingFolder');
  const result = await dialog.showOpenDialog(mainWin, {
    title: 'Import Config File',
    defaultPath: wf || undefined,
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths.length) return { success: false };
  const file = result.filePaths[0];
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const cfg = JSON.parse(raw);
    if (cfg.autoPatch != null) store.set('autoPatch', !!cfg.autoPatch);
    if (cfg.cliOptions) store.set('cliOptions', cfg.cliOptions);
    return { success: true, path: file };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
ipcMain.handle('export-config', async () => {
  const wf = store.get('workingFolder');
  const defaultPath = wf ? path.join(wf, 'codex.config.json') : 'codex.config.json';
  const result = await dialog.showSaveDialog(mainWin, {
    title: 'Export Config File',
    defaultPath,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return { success: false };
  const file = result.filePath;
  try {
    const cfg = {
      autoPatch: store.get('autoPatch'),
      cliOptions: store.get('cliOptions')
    };
    fs.writeFileSync(file, JSON.stringify(cfg, null, 2), 'utf-8');
    return { success: true, path: file };
  } catch (e) {
    return { success: false, error: e.message };
  }
});


// ---------- Diff history ----------
ipcMain.handle('list-diffs', () => listDiffs());
ipcMain.handle('get-diff', (_ , filePath) => {
  const data = loadDiff(filePath);
  if (!data) return { error: 'E_PATH' };
  return { data };
});

// ---------- Working Folder ----------
/**
 * Open a dialog to select a working folder. Saves to store and notifies renderer.
 */
ipcMain.handle('select-working-folder', async () => {
  const result = await dialog.showOpenDialog(mainWin, { properties: ['openDirectory'] });
  if (result.canceled || !result.filePaths.length) return '';
  const selected = result.filePaths[0];
  store.set('workingFolder', selected);
  // Notify renderer
  if (mainWin && mainWin.webContents) {
    mainWin.webContents.send('working-folder-changed', selected);
  }
  return selected;
});

/**
 * Get the currently selected working folder path.
 */
ipcMain.handle('get-working-folder', () => store.get('workingFolder') || '');
// ---------- File Browser APIs ----------
/**
 * List all files under the working folder recursively.
 * Returns array of relative paths (from workingFolder) or [].
 */
ipcMain.handle('list-files', () => {
  const wf = store.get('workingFolder');
  if (!wf) return [];
  const walk = (dir, base) => {
    let results = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const full = path.join(dir, file);
      const rel = path.join(base, file);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        results = results.concat(walk(full, rel));
      } else if (stat.isFile()) {
        results.push(rel);
      }
    }
    return results;
  };
  try {
    return walk(wf, '');
  } catch (e) {
    console.error('list-files error', e);
    return [];
  }
});
/**
 * Read the content of a file under working folder.
 * @param {string} relPath
 * @returns {string} file content or ''
 */
ipcMain.handle('read-file', (_, relPath) => {
  const wf = store.get('workingFolder');
  if (!wf) return '';
  const full = path.join(wf, relPath);
  try {
    return fs.readFileSync(full, 'utf-8');
  } catch (e) {
    console.error('read-file error', e);
    return '';
  }
});
/**
 * Write content to a file under working folder.
 * @param {{path:string, content:string}} opts
 * @returns {boolean}
 */
ipcMain.handle('write-file', (_, opts) => {
  const wf = store.get('workingFolder');
  if (!wf) return false;
  const full = path.join(wf, opts.path);
  try {
    fs.writeFileSync(full, opts.content, 'utf-8');
    return true;
  } catch (e) {
    console.error('write-file error', e);
    return false;
  }
});
// Delete a file: backup to .codex-backups then remove
ipcMain.handle('delete-file', async (_, relPath) => {
  const wf = store.get('workingFolder');
  if (!wf) return { success: false, error: 'Working folder not set' };
  const full = path.join(wf, relPath);
  try {
    // Prepare backup directory
    const backupDir = path.join(wf, '.codex-backups', path.dirname(relPath));
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const base = path.basename(relPath);
    const backupPath = path.join(backupDir, `${base}.${Date.now()}.bak`);
    fs.copyFileSync(full, backupPath);
    fs.unlinkSync(full);
    return { success: true, backupPath: path.relative(wf, backupPath) };
  } catch (e) {
    console.error('delete-file error', e);
    return { success: false, error: e.message };
  }
});
// ---------- File Save ----------
/**
 * Save given content to a file via save dialog.
 * params: { filename?: string, content: string }
 * returns: selected filepath or ''
 */
ipcMain.handle('save-file', async (_, {filename, content}) => {
  const options = { defaultPath: filename || 'output.html' };
  if (store.get('workingFolder')) {
    options.defaultPath = path.join(store.get('workingFolder'), filename || 'output.html');
  }
  const { canceled, filePath } = await dialog.showSaveDialog(mainWin, options);
  if (canceled || !filePath) return '';
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  } catch (err) {
    console.error('Save file failed:', err);
    return '';
  }
});
// ---------- API Key Onboarding ----------
/**
 * Open a modal window to onboard or update the API key.
 * Returns true when window is shown.
 */
function openOnboardingWindow() {
  const win = new BrowserWindow({
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
  win.loadURL(`file://${path.join(__dirname, '../renderer/onboarding/index.html')}`);
  ipcMain.once('onboarding-complete', () => {
    if (!win.isDestroyed()) win.close();
    if (mainWin && mainWin.webContents) {
      mainWin.webContents.send('key-status', true);
    }
  });
  return true;
}
// Handler exposed to renderer to open API key setup
ipcMain.handle('open-onboarding', () => openOnboardingWindow());
// ---------- Run Codex CLI ----------
// Handle execution, security scan, review, and optional auto-patch
ipcMain.handle('run-codex', async (_, { prompt, mode }) => {
  // Log start
  if (mainWin && mainWin.webContents) mainWin.webContents.send('run-log', 'Validating prompt...');
  // Validate mode
  if (!MODE_OPTIONS.includes(mode)) {
    return { success: false, error: 'Invalid mode.' };
  }
  if (mainWin && mainWin.webContents) mainWin.webContents.send('run-log', 'Checking prompt constraints...');
  // Validate prompt
  const validation = validatePrompt(prompt);
  if (!validation.ok) {
    return { success: false, error: validation.error };
  }
  if (mainWin && mainWin.webContents) mainWin.webContents.send('run-log', 'Retrieving API key...');
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
  let xssOnly = false;
  if (mainWin && mainWin.webContents) mainWin.webContents.send('run-log', 'Scanning prompt for safety...');
  try {
    const scan = await scanPrompt(prompt, apiKey);
    if (!scan.safe) {
      // Handle XSS-only warnings by sanitizing output later
      const onlyXss = scan.issues.every(issue => /xss/i.test(issue));
      if (!onlyXss) {
        // Return details of scan (messages sent and raw LLM response)
        return {
          success: false,
          error: 'Unsafe prompt detected: ' + scan.issues.join('; '),
          scan: {
            messages: scan.messages,
            raw: scan.raw
          }
        };
      }
      // Mark for HTML escape
      xssOnly = true;
      console.warn('[run-codex] XSS-only scan issues detected, will escape HTML in output:', scan.issues);
    }
  } catch (err) {
    console.error('Prompt scan failed:', err);
    if (err.status === 401 || err.code === 'invalid_api_key') {
      openOnboardingWindow();
      return { success: false, error: 'Invalid API key. Please enter a valid API key.' };
    }
    return { success: false, error: 'Prompt scan failed.' };
  }
  // Invoke Codex via OpenAI SDK
  if (mainWin && mainWin.webContents) mainWin.webContents.send('run-log', 'Invoking OpenAI SDK...');
  let outputStr = '';
  try {
    const cliOpts = store.get('cliOptions') || {};
    outputStr = await runCodex(mode, prompt, apiKey, cliOpts);
    if (mainWin && mainWin.webContents) mainWin.webContents.send('run-log', outputStr);
  } catch (err) {
    console.error('SDK execution failed:', err);
    if (/Invalid mode/.test(err.message)) {
      return { success: false, error: err.message };
    }
    if (/Invalid API key/.test(err.message) || err.status === 401) {
      openOnboardingWindow();
      return { success: false, error: 'Invalid API key. Please enter a valid API key.' };
    }
    return { success: false, error: err.message || 'Execution failed.' };
  }
  // Sanitize HTML output if XSS-only issues were detected
  if (xssOnly) {
    if (mainWin && mainWin.webContents) mainWin.webContents.send('run-log', '[run-codex] Escaping HTML output to prevent XSS');
    outputStr = escapeHtml(outputStr);
  }
  if (mainWin && mainWin.webContents) mainWin.webContents.send('run-log', 'Reviewing CLI output...');
  // Interactive edit mode: directly return unified diff for user to apply
  if (mode === '--edit') {
    // Save diff to history
    saveDiff(outputStr);
    return { edit: true, diff: outputStr };
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
  // Auto-save output to HTML file
  try {
    const outDir = getOutputDir();
    const filename = `output_${Date.now()}.html`;
    const filePath = path2.join(outDir, filename);
    fs2.writeFileSync(filePath, outputStr, 'utf-8');
    // Save parsed code files from output
    const saved = saveFilesFromOutput(outputStr);
    return { success: true, data: outputStr, savedPath: filePath, savedFiles: saved };
  } catch (e) {
    // Even if HTML save fails, attempt code file saves
    const saved = saveFilesFromOutput(outputStr);
    return { success: true, data: outputStr, savedFiles: saved };
  }
});
// ---------- Report Prompt Flagging ----------
/**
 * Let the LLM explain why a prompt was flagged as injection/harmful (false positive analysis).
 */
ipcMain.handle('report-prompt-flag', async (_, { prompt, scan }) => {
  // Retrieve API key
  let apiKey;
  try { apiKey = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT); } catch {}
  if (!apiKey) {
    // Ask user to configure key
    openOnboardingWindow();
    return { success: false, error: 'API key not set.' };
  }
  try {
    const openai = new OpenAI({ apiKey });
    const systemMsg = {
      role: 'system',
      content: 'あなたはプロンプト検知の誤判定を調査する専門家です。以下のプロンプトがなぜ有害と判定されたのか説明し、誤判定であれば理由と対処法を日本語で示してください。'
    };
    const userMsg = {
      role: 'user',
      content: `プロンプト: ${prompt}\n\n検知結果: ${scan.issues.join(', ')}\n\nスキャン raw:\n${scan.raw}`
    };
    const resp = await openai.chat.completions.create({
      model: config.LLM_PROMPT_MODEL,
      messages: [systemMsg, userMsg],
      temperature: 0
    });
    return { success: true, report: resp.choices[0].message.content };
  } catch (e) {
    console.error('[report-prompt-flag] failed:', e);
    return { success: false, error: e.message };
  }
});
// ---------- App Startup ----------
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  // Onboarding set key handler
  ipcMain.handle('onboarding-set-key', async (_, key) => {
    console.log('[MAIN] Received onboarding-set-key');
    try {
      await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, key.trim());
      console.log('[MAIN] API key saved.');
    } catch (err) {
      console.error('[MAIN] key save failed', err);
    }
    ipcMain.emit('onboarding-complete');
    return { success: true };
  });

  // Inject CSP header to include frame-ancestors
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; frame-ancestors 'self';";
    const headers = details.responseHeaders;
    // Ensure CSP allows inline styles for Chakra UI
    headers['Content-Security-Policy'] = [csp];
    headers['content-security-policy'] = [csp];
    callback({ responseHeaders: headers });
  });

    try {
      const ok = await ensureApiKey();
      if (!ok) {
        dialog.showErrorBox('Setup required', 'API key setup was not completed. The app will now quit.');
        return app.quit();
      }
      // Load project config file if present
      const wf = store.get('workingFolder');
      if (wf) {
        const cfgPath = path.join(wf, 'codex.config.json');
        if (fs.existsSync(cfgPath)) {
          try {
            const raw = fs.readFileSync(cfgPath, 'utf-8');
            const cfg = JSON.parse(raw);
            if (cfg.autoPatch != null) store.set('autoPatch', !!cfg.autoPatch);
            if (cfg.cliOptions) store.set('cliOptions', cfg.cliOptions);
          } catch (e) {
            console.error('Failed to load config file:', e);
          }
        }
      }
      createMainWindow();
    } catch (err) {
      console.error('Error during startup sequence:', err);
      app.quit();
    }
});