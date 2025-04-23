// Central configuration constants
module.exports = {
  KEYTAR_SERVICE: 'codex-gui',
  KEYTAR_ACCOUNT: 'openai-api-key',
  PROMPT_MAX_LENGTH: 2000,
  MODE_OPTIONS: ['--complete', '--edit', '--chat'],
  // Default LLM models for prompt scanning and code review
  LLM_PROMPT_MODEL: 'gpt-4o-mini',
  LLM_REVIEW_MODEL: 'gpt-4o-mini',
  // Main LLM model for Codex CLI tasks
  MAIN_MODEL: 'o4-mini',
  // Agent system instruction for coding tasks
  AGENT_SYSTEM_PROMPT: 'You are Codex, a coding assistant. Use markdown code fences for code output. In --edit mode, respond with unified diff patches only. Provide concise explanations if requested.'
};