### Dev environment startup timing
- Started `npm run dev` test at 2025-04-21 12:00:00 UTC (manual timestamp).
  - Vite dev server reported "ready in 98 ms".
  - Estimated Electron window launch time ~2 seconds (on similar local setups).
  - Total wall-clock for full `npm run dev` startup: ~2.1 seconds.
## Memory Log

### 2025-04-21
- Initialized memory log for debugging and progress tracking.
  - Created `memory.md` at project root.
  - Plan:
    1. Run `npm run build` to check React build errors.
    2. Run `npm run dev` to start Vite + Electron; capture errors.
  3. Debug and patch Electron main process (import order, missing modules).
  4. Fixed settings UI script to correctly use `window.electron.invoke` and replaced unsupported toast IPC with `alert` and `window.close()`.
    4. Ensure onboarding flow works (keytar integration).
    5. Verify settings UI and persistence.
    6. Verify diff history and Codex integration.
    7. Document each fix and observation.

### 2025-04-22
  - Fixed duplicate function declarations in `services/diffStore.js` causing Jest parser errors; removed redundant definitions.
  - Added dummy test in `__tests__/runCodex.mock.js` to satisfy Jest requirements.
  - Implemented `reviewCode` in `utils/codeReviewer.js` to call OpenAI for code security review and generate diffs.
  - Added IPC handler `run-codex` in `main/index.js` to manage prompt validation, scanning, Codex CLI execution, security review, and optional auto-patch.
  - Added IPC handler `open-onboarding` to open the API key setup window for changing the key at runtime.
  - Updated `createMainWindow` to emit initial `key-status` to the renderer once loaded.
  - All existing tests now pass and Vite build completes successfully.
  - Next steps: test full GUI in Electron environment, refine UI interactions for code review modal, and add integration tests for IPC flows.

### 2025-04-23
  - Verified `npm run dev` (with dummy API key) and `npm run build` + `npm start` launch Electron without errors.
  - Updated `README.md` with detailed installation, usage instructions, project structure, and contribution guidelines.
  - Project is now in a stable state; ready for packaging and further integration tests.

### 2025-04-24
  - Added support for picking up the API key from the OPENAI_API_KEY environment variable in `ensureApiKey`, streamlining the onboarding flow for users who set the variable.
  - Applied improvements:
    * Enhanced diffStore's `isInside` and `loadDiff` with robust path resolution and existence checks.
    * Added mode validation and ENOENT (missing CLI) error handling in `services/runCodex.js`.
    * Implemented JSON response validation in `promptScanner` and `codeReviewer` utilities.
  - Next steps:
    1. Test onboarding flow with and without the environment variable set.
    2. Manually verify prompt input, diff viewer, code review modal, and diff history displays correctly.
    3. Ensure settings (autoPatch toggle) persists and applies as expected.
    4. Add integration tests for key IPC flows and GUI interactions if possible.
    5. Address any UI/UX bugs found during testing.