# Codex GUI
[![CI](https://github.com/HimizuNoa/Codex-GUI/actions/workflows/ci.yml/badge.svg)](https://github.com/HimizuNoa/Codex-GUI/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/codex-gui.svg)](https://www.npmjs.com/package/codex-gui)

Codex GUI is a desktop application built with Electron and React (using Vite) that provides a graphical interface to the Codex command-line tool and the OpenAI API. It enables you to write prompts, view code diffs, perform security reviews, and manage diff history—all within a modern, cross-platform desktop app.

## Features
- Onboarding: Securely store and manage your OpenAI API key using the system credential store (`keytar`).
- Prompt Input: Spawn the local Codex CLI process to execute prompts (spawn-based flow).
- Diff Viewer: Visualize file changes and suggested code updates.
- Code Review: Automatically review generated code for security issues via OpenAI.
- Diff History: Save, browse, and export previous diffs.
- Settings & Config: Manage API key and CLI flags; import/export `codex.config.json`.
- Cross-Platform: Works on macOS, Windows, and Linux.
- Configuration File Support: Import and export project settings via `codex.config.json` (autoPatch, CLI flags).

## Keyboard Shortcuts
- Ctrl+Enter: Run prompt
- Esc: Clear prompt input
- Ctrl+, : Open Settings
- Ctrl+D: Open Diff History
- Ctrl+R: Open Prompt History
- Ctrl+H / F1: Open CLI Help

## Accessibility
- All interactive elements include ARIA labels for screen reader support.
- Modals use Chakra UI / Radix Dialog with built-in focus trapping and keyboard navigation.
- High-contrast compatible themes and focus indicators enabled.

## Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- An OpenAI API key

## Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/HimizuNoa/Codex-GUI.git
   cd codex-gui
   ```
2. Install dependencies:
   ```bash
   npm install
   # Or use yarn:
   yarn install
   ```
3. (Optional) Set your API key as an environment variable:
   ```bash
   export OPENAI_API_KEY=your_api_key_here
   ```
   If not set, the app will prompt you to enter and save it on first launch.

## Development
Start the app in development mode (hot-reloading for both UI and main process):
```bash
npm run dev
```
- This launches the Vite development server at http://localhost:5173
- Electron will open a desktop window pointing to the dev server

## Building & Running
1. Build the renderer assets:
   ```bash
   npm run build
   ```
2. Launch the production app:
   ```bash
   npm start
   ```

> **Note:** `npm start` runs `npm run build` before launching Electron.

## Packaging
To create platform-specific installers or executables, use Electron Builder:
```bash
npx electron-builder
```
Configuration is defined under the `build` section in `package.json`.

## Testing
Run the Jest test suite and generate coverage reports:
```bash
npm test
```
Tests are located in the `__tests__` directory.

## Project Structure
- `main/`: Electron main process entrypoint and IPC handlers
- `preload.js`: Exposes safe, whitelisted IPC APIs to the renderer
- `renderer/`: React (Vite) frontend application
- `services/`: Business logic (diff storage, prompt scanning, code review, shell execution)
- `utils/`: Helper utilities (e.g., code security review)
- `scripts/`: Project scripts (e.g., postinstall hooks)
 - `__tests__/`: Jest unit tests

## Architecture
The application is structured around an Electron main process that handles CLI invocation and a React renderer for the UI.
- **Main Process** (`main/index.js`):
  - Listens on IPC channel `run-codex` and spawns the local Codex CLI (`vendor/codex-cli/bin/codex.js`) with configured flags.
  - Streams `stdout` and `stderr` back to the renderer via `run-log` events.
  - Performs prompt safety scanning, special-case HTML5 breakout generation, and handles keytar-based API key storage.
- **Renderer Process** (`renderer/src`):
  - UI built with React and Chakra UI, including `ChatPanel`, file browser, and settings modals.
  - Consumes `run-log` streams, displays progress indicators, and sends IPC invocations for prompts, shell commands, and settings.
- **Services** (`services/`):
  - Contains business logic for diff storage, prompt scanning, code review, and shell command scanning.
  - CLI execution logic has been refactored into the main process; `services/runCodex.js` was removed.

## Security
- API keys are stored securely via `keytar` in the operating system credential vault.
- Renderer processes do not have direct Node integration; all communication goes through the preload script.

## Troubleshooting
- Linux users may see a benign warning: `[ERROR:atom_cache.cc] Add _NET_WM_STATE_MODAL to kAtomsToCache`. This can be safely ignored.
- If modules are missing, re-run `npm install`.
- To view debug logs for Electron, set:
  ```bash
  DEBUG=electron:* npm run dev
  ```

## Contributing
For detailed contribution guidelines, please see [CONTRIBUTING.md](CONTRIBUTING.md).

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
