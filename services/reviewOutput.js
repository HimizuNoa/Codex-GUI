const { reviewCode } = require('../utils/codeReviewer');

/**
 * Review Codex output. Returns { safe, issues, patchedCode, diff }
 */
async function reviewOutput(stdout, apiKey) {
  return reviewCode(stdout, apiKey);
}

module.exports = reviewOutput;