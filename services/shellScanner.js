const { OpenAI } = require('openai');
const config = require('../config');

/**
 * Scan a shell command for potential security issues via LLM.
 * @param {string} cmd Combined command string (including args)
 * @param {string} apiKey OpenAI API key
 * @returns {Promise<{safe:boolean, issues:string[]}>
 */
async function scanShell(cmd, apiKey) {
  const openai = new OpenAI({ apiKey });
  const system = "You are a security filter. Evaluate the following shell command for potential risks like injection, destructive file operations, or privilege escalation. Respond only with JSON: {\"safe\": boolean, \"issues\": [string]}.";
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: cmd }
  ];
  const completion = await openai.chat.completions.create({
    model: config.LLM_PROMPT_MODEL,
    temperature: 0,
    max_tokens: 256,
    messages
  });
  const raw = completion.choices[0].message.content;
  // strip code fences
  let jsonText = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let result;
  try {
    result = JSON.parse(jsonText);
  } catch (err) {
    console.warn('[scanShell] JSON parse failed:', err);
    return { safe: false, issues: ['Unable to parse scanner response'] };
  }
  if (typeof result.safe !== 'boolean' || !Array.isArray(result.issues)) {
    return { safe: false, issues: ['Invalid scanner response format'] };
  }
  return result;
}

module.exports = { scanShell };