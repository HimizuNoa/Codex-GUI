const system = "You are a senior secure-coding auditor. Analyse the supplied code for high-severity issues. Respond strictly with JSON: {\"safe\": boolean, \"issues\": [\"string\"], \"patched\": \"string\"}";

const { OpenAI } = require('openai');
const { LLM_REVIEW_MODEL } = require('../config');
const diff = require('diff');

/**
 * Review the supplied code and return security issues and suggested patch
 * @param {string} code Original code output
 * @param {string} apiKey OpenAI API key
 * @returns {Promise<{safe:boolean,issues:string[],patchedCode:string,diff:string}>}
 */
async function reviewCode(code, apiKey) {
  const openai = new OpenAI({ apiKey });
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: code }
  ];
  const completion = await openai.chat.completions.create({
    model: LLM_REVIEW_MODEL,
    temperature: 0,
    max_tokens: 1024,
    messages
  });
  let parsed;
  try {
    parsed = JSON.parse(completion.choices[0].message.content.trim());
  } catch (err) {
    return { safe: false, issues: ['Unable to parse code reviewer response'], patchedCode: code, diff: '' };
  }
  // Validate response structure
  const { safe, issues, patched } = parsed;
  if (typeof safe !== 'boolean' || !Array.isArray(issues) || !issues.every(i => typeof i === 'string') || typeof patched !== 'string') {
    return { safe: false, issues: ['Invalid reviewer response format'], patchedCode: code, diff: '' };
  }
  if (!safe) {
    const diffText = diff.createPatch('code.patch', code, patched);
    return { safe, issues, patchedCode: patched, diff: diffText };
  }
  return { safe, issues, patchedCode: code, diff: '' };
}

module.exports = { system, reviewCode };
