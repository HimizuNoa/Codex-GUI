const { execFile } = require('child_process');
const { KEYTAR_SERVICE, KEYTAR_ACCOUNT } = require('../config');

/**
 * Execute codex CLI in a safe subprocess.
 */
function runCodex(mode, prompt, apiKey) {
  return new Promise((resolve, reject) => {
    execFile('codex', [mode], {
      input: prompt,
      env: { ...process.env, CODEX_API_KEY: apiKey }
    }, (error, stdout, stderr) => {
      if (error) {
        const err = new Error('Codex execution failed');
        err.stderr = stderr;
        return reject(err);
      }
      resolve(stdout);
    });
  });
}

module.exports = runCodex;