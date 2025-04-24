const EventEmitter = require('events');
// Mock Electron main-side IPC and BrowserWindow for integration testing
const mockIpcMain = {
  handle: jest.fn(),
  on: jest.fn(),
  handleOnce: jest.fn(),
};
const mockApp = {
  disableHardwareAcceleration: jest.fn(),
  whenReady: jest.fn(() => Promise.resolve()),
};
const mockBrowserWindow = jest.fn().mockImplementation(() => ({
  loadURL: jest.fn(),
  webContents: { on: jest.fn(), send: jest.fn() }
}));
jest.mock('electron', () => ({
  app: mockApp,
  BrowserWindow: mockBrowserWindow,
  ipcMain: mockIpcMain,
  dialog: {},
  session: {}
}));
// Mock keytar to always return a stored API key
jest.mock('keytar', () => ({
  getPassword: jest.fn(() => Promise.resolve('fake-key')),
  setPassword: jest.fn()
}));
// Mock prompt safety scanning to always be safe
const shellScannerPath = require.resolve('../services/shellScanner');
jest.mock(shellScannerPath, () => ({ scanShell: jest.fn(() => Promise.resolve({ safe: true })) }));
const promptScannerPath = require.resolve('../utils/promptScanner');
jest.mock(promptScannerPath, () => ({ scanPrompt: jest.fn(() => Promise.resolve({ safe: true, issues: [], raw: '' })) }));
// Mock prompt validation to always pass
const validatePromptPath = require.resolve('../services/validatePrompt');
jest.mock(validatePromptPath, () => jest.fn(() => ({ ok: true })));
// Mock child_process.spawn for CLI execution
jest.mock('child_process', () => ({ spawn: jest.fn() }));

// Load the main process module after mocks
const mainModule = require('../main/index.js');

describe('IPC E2E: run-codex handler', () => {
  it('should spawn codex CLI and return output data', async () => {
    const { spawn } = require('child_process');
    // Setup fake process that emits data and close
    spawn.mockImplementation(() => {
      const proc = new EventEmitter();
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      // Emit sample output and then close
      setImmediate(() => {
        proc.stdout.emit('data', Buffer.from('CLI_OUTPUT'));
        proc.emit('close', 0);
      });
      return proc;
    });
    // Extract the registered IPC handler for 'run-codex'
    const call = mockIpcMain.handle.mock.calls.find(c => c[0] === 'run-codex');
    expect(call).toBeDefined();
    const runCodexHandler = call[1];
    // Invoke the handler with test arguments
    const result = await runCodexHandler(null, { prompt: 'test prompt', mode: '--complete', files: [], skipScan: true });
    // Expect spawn to have been called with the CLI path and args
    expect(spawn).toHaveBeenCalled();
    // Handler should return success and include the fake output
    expect(result.success).toBe(true);
    expect(result.data).toContain('CLI_OUTPUT');
  });
});