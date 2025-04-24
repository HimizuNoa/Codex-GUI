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
      // Use placeholder to uniquely identify CLI model input
      expect(screen.getByPlaceholderText(/Model name/i).value).toBe(defaultCliOptions.model);
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
  
  it('allows editing all CLI options', async () => {
    const onClose = jest.fn();
    render(
      <ChakraProvider>
        <SettingsModal isOpen={true} onClose={onClose} />
      </ChakraProvider>
    );
    // Wait for settings to load
    const maxTokensInput = await screen.findByLabelText(/Max Tokens/i);
    fireEvent.change(maxTokensInput, { target: { value: '20' } });
    const topPInput = screen.getByLabelText(/Top P/i);
    fireEvent.change(topPInput, { target: { value: '0.8' } });
    const nInput = screen.getByLabelText(/N \(completions\)/i);
    fireEvent.change(nInput, { target: { value: '3' } });
    const streamSwitch = screen.getByRole('switch', { name: /Stream responses/i });
    fireEvent.click(streamSwitch);
    const stopInput = screen.getByPlaceholderText('stop1, stop2');
    fireEvent.change(stopInput, { target: { value: 'stopA, stopB' } });
    const logprobsInput = screen.getByLabelText(/Logprobs/i);
    fireEvent.change(logprobsInput, { target: { value: '5' } });
    // Save changes
    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);
    await waitFor(() => {
      expect(window.electron.invoke).toHaveBeenCalledWith('set-cli-options', expect.objectContaining({
        max_tokens: 20,
        top_p: 0.8,
        n: 3,
        stream: true,
        stop: ['stopA', 'stopB'],
        logprobs: 5
      }));
      expect(onClose).toHaveBeenCalled();
    });
  });
});
