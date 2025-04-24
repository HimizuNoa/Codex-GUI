# Contributing to Codex GUI

Thank you for your interest in contributing to Codex GUI! We welcome bug reports, feature requests, and pull requests.

## How to Contribute
1. Fork the repository on GitHub.
2. Create a new branch for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes.
4. Add or update tests in `__tests__/` to cover your changes.
5. Ensure all tests pass:
   ```bash
   npm test
   ```
6. Commit your changes with a clear message:
   ```bash
   git commit -m "feat: describe your feature"
   ```
7. Push your branch and open a Pull Request against the `main` branch.

## Code Style
- Follow the existing code style and patterns.
- Run `npm run build` and ensure no errors.

## Reporting Issues
If you find a bug or have a feature request, please open an issue on GitHub:
https://github.com/HimizuNoa/Codex-GUI/issues
  
## Developer Guide
This section provides guidance for developers working on the Codex GUI codebase.

### Architecture Overview
- **Main Process** (`main/index.js`): handles IPC channels, spawns the Codex CLI via `child_process.spawn`, streams logs to the renderer, performs prompt scanning and safety checks, and manages API key storage.
- **Preload** (`main/preload.js`): exposes a secure subset of IPC APIs to the renderer via `window.electron` and `window.onboardAPI`.
- **Renderer Process** (`renderer/src`): React + Chakra UI application that renders the UI, submits prompts via IPC, displays streaming logs in `ChatPanel`, and manages state (settings, history, file browser, etc.).
- **Services** (`services/`): utility modules for diff storage, prompt scanning, code review, and shell scanning. Note: the legacy `services/runCodex.js` has been removed; CLI execution lives in the main process.

### Local Development Workflow
1. Install dependencies: `npm install`
2. Run in development mode (hot-reload): `npm run dev`
3. Build for production: `npm run build`
4. Start the packaged app: `npm start`

### Testing
- **Unit Tests**: Jest tests reside in `__tests__/`. Run `npm test` to execute all tests and view coverage.
- **E2E IPC Tests**: Integration tests for main-to-renderer IPC flows (e.g., `run-codex`) are in `__tests__/runCodex.e2e.test.js`, mocking Electron and CLI spawn.

### Adding a New IPC Handler
1. In `main/index.js`, register a new channel via `ipcMain.handle('your-channel', async (event, args) => { ... })`.
2. Expose it in `preload.js` under `contextBridge.exposeInMainWorld('electron', { ... })`.
3. Invoke from the renderer using `window.electron.invoke('your-channel', payload)` and handle results.
4. (Optional) Add unit or E2E tests to `__tests__` to verify your handler logic.

### Memory Log (`memory.md`)
Use `memory.md` at the project root to record daily development progress, architecture decisions, and next steps. Please append new dated entries and keep the log sequential.

Thank you for helping improve Codex GUI! We look forward to your contributions.