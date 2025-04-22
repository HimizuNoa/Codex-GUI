import React from 'react';
// Removed jest-dom import; use direct DOM property assertions
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import SettingsModal from '../renderer/src/components/SettingsModal';

describe('SettingsModal Integration', () => {
  const defaultSettings = { autoPatch: false };
  const defaultCliOptions = {
    model: 'test-model',
    temperature: 0.5,
    max_tokens: 10,
    top_p: 0.3,
    n: 1,
    stream: false,
    stop: ['stop1'],
    logprobs: 2
  };
  beforeAll(() => {
    global.window = Object.create(window);
    window.electron = {
      invoke: jest.fn((channel, arg) => {
        switch (channel) {
          case 'get-user-settings':
            return Promise.resolve(defaultSettings);
          case 'get-cli-options':
            return Promise.resolve(defaultCliOptions);
          case 'set-user-settings':
            return Promise.resolve(true);
          case 'set-cli-options':
            return Promise.resolve(true);
          case 'import-config':
            return Promise.resolve({ success: true, path: '/tmp/config.json' });
          case 'export-config':
            return Promise.resolve({ success: true, path: '/tmp/config.json' });
          default:
            return Promise.resolve(null);
        }
      })
    };
  });

  it('loads and displays existing settings', async () => {
    const onClose = jest.fn();
    render(
      <ChakraProvider>
        <SettingsModal isOpen={true} onClose={onClose} />
      </ChakraProvider>
    );
    const autoSwitch = await screen.findByRole('switch', { name: /auto‑apply/i });
    // The switch is a div with aria-checked attribute
    expect(autoSwitch.getAttribute('aria-checked')).toBe('false');
    // Wait for CLI options to load into inputs
    await waitFor(() => {
      expect(screen.getByLabelText(/Model/i).value).toBe(defaultCliOptions.model);
      expect(screen.getByLabelText(/Temperature/i).value).toBe(defaultCliOptions.temperature.toString());
    });
  });

  it('saves settings when Save is clicked', async () => {
    const onClose = jest.fn();
    render(
      <ChakraProvider>
        <SettingsModal isOpen={true} onClose={onClose} />
      </ChakraProvider>
    );
    const autoSwitch = await screen.findByRole('switch', { name: /auto‑apply/i });
    fireEvent.click(autoSwitch);
    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);
    await waitFor(() => {
      expect(window.electron.invoke).toHaveBeenCalledWith('set-user-settings', { autoPatch: true });
      expect(window.electron.invoke).toHaveBeenCalledWith('set-cli-options', expect.objectContaining({ model: defaultCliOptions.model }));
      expect(onClose).toHaveBeenCalled();
    });
  });
});
