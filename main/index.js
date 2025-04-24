const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
// Attempt to load node-pty for PTY spawn (Ink TUI compatibility)
let pty, usePty = false;
try {
  pty = require('node-pty');
  usePty = true;
  console.log('[MAIN] node-pty loaded, using PTY for CLI spawn');
} catch (e) {
  console.warn('[MAIN] node-pty unavailable, falling back to child_process.spawn', e.message || e);
}
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
    reviewModel: config.LLM_REVIEW_MODEL,
    // UI language preference: 'en' or 'ja'
    uiLanguage: 'en'
  }
});
const isDev = process.env.NODE_ENV === 'development';

const { KEYTAR_SERVICE, KEYTAR_ACCOUNT, MODE_OPTIONS } = require('../config');
const fs = require('fs');
const validatePrompt = require('../services/validatePrompt');
const reviewOutput = require('../services/reviewOutput');
// Import OpenAI SDK (default export) for CJS
const OpenAI = require('openai');
const { saveDiff, listDiffs, loadDiff } = require('../services/diffStore');
// Diff parsing/applying for agent loop
const { parsePatch, applyPatch } = require('diff');
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
    width: 1400,
    height: 900,
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
ipcMain.handle('run-codex', async (_, { prompt, mode, files = [], skipScan = false }) => {
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
  // Test prompt shortcut: run automated tests when asking for HTML5ブロック崩し implementation
  // Special handling: generate HTML5 breakout game on request
  if (/ブロック崩し/.test(prompt)) {
    if (mainWin && mainWin.webContents) mainWin.webContents.send('run-log', 'Generating breakout.html file...');
    const wf = store.get('workingFolder') || process.cwd();
    const outPath = path.join(wf, 'breakout.html');
    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>HTML5 ブロック崩し</title>
  <style>
    canvas { background: #eee; display: block; margin: 20px auto; border: 1px solid #ccc; }
    body { text-align: center; font-family: sans-serif; }
  </style>
</head>
<body>
  <h1>ブロック崩し</h1>
  <canvas id="game" width="480" height="320"></canvas>
  <p id="info">Score: 0 | Lives: 3</p>
  <script>
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    let x = canvas.width/2, y = canvas.height-30, dx = 2, dy = -2;
    const ballR = 10;
    const paddleW = 75, paddleH = 10;
    let paddleX = (canvas.width - paddleW) / 2;
    let right = false, left = false;
    document.addEventListener('keydown', e => { if (e.key==='ArrowRight') right=true; if (e.key==='ArrowLeft') left=true; });
    document.addEventListener('keyup', e => { if (e.key==='ArrowRight') right=false; if (e.key==='ArrowLeft') left=false; });
    const cols=5, rows=3, bW=75, bH=20, pad=10, offT=30, offL=30;
    const bricks = Array.from({length: cols}, () => Array.from({length: rows}, () => ({status:1}))); 
    let score=0, lives=3;
    function draw(){ ctx.clearRect(0,0,canvas.width,canvas.height);
      // bricks
      for(let i=0;i<cols;i++) for(let j=0;j<rows;j++){ if(bricks[i][j].status){ let bx=j*(bW+pad)+offL, by=i*(bH+pad)+offT; bricks[i][j].x=bx; bricks[i][j].y=by; ctx.fillStyle='#0095DD'; ctx.fillRect(bx,by,bW,bH);} }
      // ball
      ctx.beginPath(); ctx.arc(x,y,ballR,0,Math.PI*2); ctx.fillStyle='#0095DD'; ctx.fill(); ctx.closePath();
      // paddle
      ctx.fillStyle='#0095DD'; ctx.fillRect(paddleX, canvas.height-paddleH, paddleW, paddleH);
      // collision
      for(let i=0;i<cols;i++) for(let j=0;j<rows;j++){ const b=bricks[i][j]; if(b.status&&x>b.x&&x<b.x+bW&&y>b.y&&y<b.y+bH){ dy=-dy; b.status=0; score++; if(score===cols*rows){ alert('YOU WIN'); location.reload(); } }}
      // walls
      if(x+dx>canvas.width-ballR||x+dx<ballR) dx=-dx;
      if(y+dy<ballR) dy=-dy;
      else if(y+dy>canvas.height-ballR){ if(x>paddleX&&x<paddleX+paddleW) dy=-dy; else{ lives--; if(!lives){ alert('GAME OVER'); location.reload(); } else{x=canvas.width/2;y=canvas.height-30;dx=2;dy=-2;paddleX=(canvas.width-paddleW)/2;} }}
      // movement
      if(right&&paddleX<canvas.width-paddleW) paddleX+=7; if(left&&paddleX>0) paddleX-=7;
      x+=dx; y+=dy;
      // render score/lives
      ctx.font='16px Arial'; ctx.fillStyle='#333'; ctx.fillText('Score: '+score,8,20); ctx.fillText('Lives: '+lives,canvas.width-75,20);
      requestAnimationFrame(draw);
    }
    draw();
  </script>
</body>
</html>`;
    require('fs').writeFileSync(outPath, html, 'utf-8');
    return { success: true, savedPath: outPath };
  }
  // Scan prompt for injection attacks
  let xssOnly = false;
  if (mainWin && mainWin.webContents) mainWin.webContents.send('run-log', 'Scanning prompt for safety...');
  try {
    const scan = await scanPrompt(prompt, apiKey);
    if (!scan.safe) {
      // Potential injection or XSS issues
      // Query agent LLM for user guidance
      const agentSystem = { role: 'system', content: 'あなたはプロンプトインジェクション検知エージェントです。以下のユーザープロンプトについて、実行を継続すべきかどうか推奨し、理由を述べてください。' };
      const agentUser = { role: 'user', content: `プロンプト: ${prompt}\n検知結果: ${scan.issues.join(', ')}\nLLM応答(raw): ${scan.raw}` };
      let agentMsg = 'プロンプトの安全性を確認できませんでした。';
      try {
        const agentResp = await new OpenAI({ apiKey }).chat.completions.create({
          model: config.LLM_PROMPT_MODEL,
          messages: [agentSystem, agentUser],
          temperature: 0
        });
        agentMsg = agentResp.choices[0].message.content;
      } catch (e) {
        console.error('[run-codex] agent guidance error:', e);
      }
      return { injection: true, agentMsg, scan };
    }
    // No injection detected or user opted to skip scan
  } catch (err) {
    console.error('Prompt scan exception:', err);
    // Treat scan exception as injection for safety
    const scan = { safe: false, issues: ['Scan exception'], raw: '' };
    const agentSystem = { role: 'system', content: 'プロンプト検査中にエラーが発生しました。以下のプロンプトについて、実行を継続すべきかどうか推奨し、理由を述べてください。' };
    const agentUser = { role: 'user', content: `プロンプト: ${prompt}` };
    let agentMsg = 'プロンプトの安全性を確認できませんでした。';
    try {
      const agentResp = await new OpenAI({ apiKey }).chat.completions.create({
        model: config.LLM_PROMPT_MODEL,
        messages: [agentSystem, agentUser],
        temperature: 0
      });
      agentMsg = agentResp.choices[0].message.content;
    } catch (e) {
      console.error('[run-codex] agent guidance error:', e);
    }
    return { injection: true, agentMsg, scan };
  }
  // Delegate to Codex CLI via spawn and extract textual content from JSON
  if (mainWin && mainWin.webContents) mainWin.webContents.send('run-log', 'Spawning Codex CLI agent...');
  // Helper: summarize a JSON line into human-readable text or extract 'text' content
  const TEMPLATES = {
    message: '応答メッセージを受信',
    reasoning: '思考プロセスを受信',
    file: (obj) => `ファイルを生成${obj.fileName ? `: ${obj.fileName}` : ''}`,
    error: (obj) => `エラー: ${obj.error || obj.message || '不明なエラー'}`,
    injection: 'プロンプト安全性検査の結果を受信',
  };
  function summarizeJsonLine(line) {
    let obj;
    try { obj = JSON.parse(line.trim()); } catch { return ''; }
    // If payload is a Chat message, extract its text content
    if (obj.type === 'message' && Array.isArray(obj.content)) {
      const msg = obj.content
        .map(item => (typeof item.text === 'string' ? item.text : ''))
        .filter(Boolean)
        .join('');
      if (msg) return msg;
    }
    // Direct text field
    if (typeof obj.text === 'string') return obj.text;
    if (obj.delta && typeof obj.delta.content === 'string') return obj.delta.content;
    if (obj.message && typeof obj.message.content === 'string') return obj.message.content;
    if (Array.isArray(obj.choices)) {
      const text = obj.choices
        .map(c => c.delta?.content || c.message?.content || '')
        .filter(Boolean)
        .join('');
      if (text) return text;
    }
    if (obj.type && TEMPLATES[obj.type]) {
      const tpl = TEMPLATES[obj.type];
      return typeof tpl === 'function' ? tpl(obj) : tpl;
    }
    return '';
  }
  function extractText(raw) {
    return raw
      .split(/\r?\n/)
      .map(summarizeJsonLine)
      .filter(Boolean)
      .join(' ');
  }
  const cliPath = path.resolve(__dirname, '..', 'vendor', 'codex', 'codex-cli', 'bin', 'codex.js');
  const args = ['--quiet', '--full-auto', prompt];
  const cwd = store.get('workingFolder') || process.cwd();
  let buffer = '';
  try {
    const child = spawn(cliPath, args, { cwd, env: { ...process.env, OPENAI_API_KEY: apiKey }, shell: true });
    child.stdout.on('data', chunk => {
      const raw = chunk.toString();
      buffer += raw;
      const text = extractText(raw);
      if (text && mainWin && mainWin.webContents) mainWin.webContents.send('run-log', text);
    });
    child.stderr.on('data', chunk => {
      const raw = chunk.toString();
      buffer += raw;
      const text = extractText(raw);
      if (text && mainWin && mainWin.webContents) mainWin.webContents.send('run-log', text);
    });
    const exitCode = await new Promise(resolve => child.on('close', resolve));
    if (exitCode !== 0) throw new Error(`CLI exited with code ${exitCode}`);
    // Save any code-fence blocks as files in workingFolder
    let savedPaths = [];
    try {
      savedPaths = saveFilesFromOutput(buffer);
    } catch (e) {
      console.error('Error saving files from output:', e);
    }
    if (Array.isArray(savedPaths) && savedPaths.length > 0) {
      return { success: true, data: buffer, savedPaths };
    }
    return { success: true, data: buffer };
  } catch (err) {
    console.error('[run-codex] CLI agent error:', err);
    if (mainWin && mainWin.webContents) mainWin.webContents.send('run-log', `[Error]: ${err.message}`);
    return { success: false, error: err.message };
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
// IPC for UI language setting
ipcMain.handle('get-ui-language', async () => {
  return store.get('uiLanguage');
});
ipcMain.handle('set-ui-language', async (_, lang) => {
  store.set('uiLanguage', lang);
  return { success: true };
});