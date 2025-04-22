#!/usr/bin/env node
// Clone or update the codex CLI from GitHub into vendor/codex-cli
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VENDOR_DIR = path.resolve(__dirname, '..', 'vendor', 'codex');
const REPO_URL = 'https://github.com/openai/codex.git';

function cloneOrUpdate() {
  if (!fs.existsSync(VENDOR_DIR)) {
    console.log(`[postinstall] Cloning codex-cli into ${VENDOR_DIR}...`);
    execSync(`git clone ${REPO_URL} "${VENDOR_DIR}"`, { stdio: 'inherit' });
  } else {
    console.log(`[postinstall] Updating codex-cli in ${VENDOR_DIR}...`);
    execSync(`git -C "${VENDOR_DIR}" pull`, { stdio: 'inherit' });
  }
}

try {
  cloneOrUpdate();
  // Install dependencies and build codex-cli subpackage
  const CLI_DIR = path.join(VENDOR_DIR, 'codex-cli');
  if (fs.existsSync(CLI_DIR)) {
    console.log(`[postinstall] Installing codex-cli dependencies in ${CLI_DIR}...`);
    execSync('npm install', { cwd: CLI_DIR, stdio: 'inherit' });
    console.log(`[postinstall] Building codex-cli in ${CLI_DIR}...`);
    execSync('npm run build', { cwd: CLI_DIR, stdio: 'inherit' });
  } else {
    console.warn(`[postinstall] codex-cli subdirectory not found at ${CLI_DIR}`);
  }
} catch (err) {
  console.error('[postinstall] Failed to clone/update codex-cli:', err);
}