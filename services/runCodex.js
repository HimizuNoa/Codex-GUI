const { execFile } = require('child_process');
const { MODE_OPTIONS } = require('../config');

/**
 * Execute codex CLI in a safe subprocess.
 */
const { MODE_OPTIONS } = require('../config');
/**
 * Execute codex CLI in a safe subprocess.
 * @param {string} mode One of the MODE_OPTIONS
 */
function runCodex(mode, prompt, apiKey) {
  // Validate mode argument
  if (!MODE_OPTIONS.includes(mode)) {
    return Promise.reject(new Error(`Invalid mode: ${mode}`));
  }
  return new Promise((resolve, reject) => {
    execFile('codex', [mode], {
      input: prompt,
      env: { ...process.env, CODEX_API_KEY: apiKey }
    }, (error, stdout, stderr) => {
      if (error) {
        let err;
        // Handle missing binary
        if (error.code === 'ENOENT') {
          err = new Error('Codex CLI not found. Please install it and ensure it is in your PATH.');
        } else {
          const msg = stderr || error.message;
          err = new Error(`Codex execution failed: ${msg}`);
        }
        err.code = error.code;
        return reject(err);
      }
      resolve(stdout);
    });
  });
}

module.exports = runCodex;