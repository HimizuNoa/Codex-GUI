const OpenAI = require('openai');
const config = require('../config');

/**
 * Execute Codex prompt via OpenAI SDK.
 * @param {string} mode One of MODE_OPTIONS ('--complete', '--chat', '--edit')
 * @param {string} prompt The prompt text
 * @param {string} apiKey OpenAI API key
 * @param {object} cliOpts Options with model, temperature, max_tokens, top_p, n, stream, stop, logprobs
 * @returns {Promise<string>} Resolves with generated content or rejects on error
 */
async function runCodex(mode, prompt, apiKey, cliOpts = {}) {
  if (!config.MODE_OPTIONS.includes(mode)) {
    throw new Error(`Invalid mode: ${mode}`);
  }
  const openai = new OpenAI({ apiKey });
  const model = cliOpts.model || config.MAIN_MODEL;
  const temperature = cliOpts.temperature ?? 0;
  const max_tokens = cliOpts.max_tokens ?? undefined;
  const top_p = cliOpts.top_p ?? undefined;
  const n = cliOpts.n ?? 1;
  const stop = Array.isArray(cliOpts.stop) && cliOpts.stop.length > 0 ? cliOpts.stop : undefined;
  const logprobs = cliOpts.logprobs ?? undefined;
  // Streaming not supported; always use batch mode

  // Build messages: include system instruction and user prompt
  const messages = [
    { role: 'system', content: config.AGENT_SYSTEM_PROMPT },
    { role: 'user', content: prompt }
  ];
  // Build parameters (batch mode only)
  const params = { model, messages, temperature, max_tokens, top_p, n, stop, logprobs };
  // Use batch (non-streaming) response
  const resp = await openai.chat.completions.create(params);
  return resp.choices.map(c => c.message.content).join('');
}

module.exports = runCodex;