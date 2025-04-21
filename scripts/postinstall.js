const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const sandbox = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'chrome-sandbox');

try {
  const stat = fs.statSync(sandbox);
  if ((stat.mode & 0o4755) !== 0o4755) {
    console.warn('\n[postinstall] chrome-sandbox needs 4755 – attempting to fix with sudo...');
    execSync(`sudo chown root:root "${sandbox}" && sudo chmod 4755 "${sandbox}"`, { stdio: 'inherit' });
  }
} catch (e) {
  console.warn('[postinstall] could not check chrome-sandbox:', e.message);
}

if (os.platform() === 'linux') {
  try {
    execSync('dpkg -s libsecret-1-dev', { stdio: 'ignore' });
  } catch {
    console.warn('[postinstall] libsecret-1-dev missing – trying to install via apt-get ...');
    try {
      execSync('sudo apt-get update && sudo apt-get -y install libsecret-1-dev', { stdio: 'inherit' });
    } catch (e) {
      console.warn('⚠️  Auto-install failed; keytar may fail to build:', e.message);
    }
  }
}