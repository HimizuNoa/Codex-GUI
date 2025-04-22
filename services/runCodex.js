// OpenAI SDK for all prompt executions
const { OpenAI } = require('openai');
// Central configuration constants
const config = require('../config');

/**
 * Execute Codex CLI in a safe subprocess.
 * @param {string} mode One of the MODE_OPTIONS
 */
/**
 * Execute Codex CLI in a subprocess, piping the prompt on stdin.
 * @param {string} mode One of the MODE_OPTIONS
 * @param {string} prompt The prompt to send via stdin
 * @param {string} apiKey The OpenAI API key
 * @returns {Promise<string>} Resolves with stdout or rejects on error
 */
/**
 * Execute Codex prompt via OpenAI SDK, applying CLI-like options.
 * @param {string} mode One of MODE_OPTIONS ('--complete', '--edit', '--chat')
 * @param {string} prompt The prompt text
 * @param {string} apiKey OpenAI API key
 * @param {object} cliOpts Options object with model, temperature, max_tokens, top_p, n, stream, stop, logprobs
 * @returns {Promise<string>} Resolution with generated content or diff text
 */
async function runCodex(mode, prompt, apiKey, cliOpts = {}) {
  if (!config.MODE_OPTIONS.includes(mode)) {
    throw new Error(`Invalid mode: ${mode}`);
  }
  const openai = new OpenAI({ apiKey });
  // Build chat completion parameters
  const params = {
    model: cliOpts.model || config.MAIN_MODEL,
    temperature: cliOpts.temperature ?? 0,
    max_tokens: cliOpts.max_tokens ?? undefined,
    top_p: cliOpts.top_p ?? undefined,
    n: cliOpts.n ?? undefined,
    stream: Boolean(cliOpts.stream),
    stop: Array.isArray(cliOpts.stop) && cliOpts.stop.length ? cliOpts.stop : undefined,
    logprobs: cliOpts.logprobs ?? undefined,
    messages: [{ role: 'user', content: prompt }]
  };
  let output = '';
  if (params.stream) {
    for await (const chunk of openai.chat.completions.create(params)) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) output += delta;
    }
  } else {
    const resp = await openai.chat.completions.create(params);
    output = resp.choices.map(c => c.message.content).join('');
  }
  return output;
}

module.exports = runCodex;

module.exports = runCodex;