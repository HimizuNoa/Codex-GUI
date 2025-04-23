import React, { useEffect, useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Switch,
  Input,
  NumberInput,
  NumberInputField,
  Checkbox,
  Select,
  VStack,
  HStack,
  useToast
} from '@chakra-ui/react';

// Settings modal component using Chakra UI
const SettingsModal = ({ isOpen, onClose }) => {
  const toast = useToast();
  // UI language state for selection
  const [uiLanguage, setUiLanguage] = useState('en');
  const [autoPatch, setAutoPatch] = useState(false);
  const [promptModel, setPromptModel] = useState('');
  const [reviewModel, setReviewModel] = useState('');
  const [cliOptions, setCliOptions] = useState({
    model: '',
    temperature: 0,
    max_tokens: null,
    top_p: null,
    n: null,
    stream: false,
    stop: [],
    logprobs: null
  });

  // Load settings when opened
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const cfg = await window.electron.invoke('get-user-settings');
        setAutoPatch(!!cfg.autoPatch);
        const opts = await window.electron.invoke('get-cli-options');
        setCliOptions({ ...opts });
        // Load LLM model settings
        const models = await window.electron.invoke('get-llm-models') || {};
        setPromptModel(models.promptModel || '');
        setReviewModel(models.reviewModel || '');
        // Load UI language
        const lang = await window.electron.getUiLanguage();
        setUiLanguage(lang);
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    })();
  }, [isOpen]);

  const handleSave = async () => {
    try {
      await window.electron.invoke('set-user-settings', { autoPatch });
      await window.electron.invoke('set-cli-options', cliOptions);
      // Save LLM model settings
      await window.electron.invoke('set-llm-models', { promptModel, reviewModel });
      // Save UI language preference
      await window.electron.setUiLanguage(uiLanguage);
      // Notify App to update language context
      setUiLanguage(uiLanguage);
      toast({ title: 'Settings saved.', status: 'success', duration: 3000, isClosable: true });
      onClose();
    } catch (e) {
      toast({ title: `Save failed: ${e.message}`, status: 'error', duration: 3000, isClosable: true });
    }
  };

  const handleImport = async () => {
    const res = await window.electron.invoke('import-config');
    if (res.success) {
      toast({ title: `Config imported from ${res.path}`, status: 'success', duration: 3000, isClosable: true });
      // reload settings
      const cfg = await window.electron.invoke('get-user-settings');
      setAutoPatch(!!cfg.autoPatch);
      const opts = await window.electron.invoke('get-cli-options');
      setCliOptions({ ...opts });
    } else {
      toast({ title: `Import failed: ${res.error || 'Cancelled'}`, status: 'error', duration: 3000, isClosable: true });
    }
  };

  const handleExport = async () => {
    const res = await window.electron.invoke('export-config');
    if (res.success) {
      toast({ title: `Config exported to ${res.path}`, status: 'success', duration: 3000, isClosable: true });
    } else {
      toast({ title: `Export failed: ${res.error || 'Cancelled'}`, status: 'error', duration: 3000, isClosable: true });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Settings</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <FormControl>
              <FormLabel>Prompt Scan Model</FormLabel>
              <Input
                value={promptModel}
                onChange={(e) => setPromptModel(e.target.value)}
                placeholder="e.g. gpt-3.5-turbo"
              />
            </FormControl>
            <FormControl>
              <FormLabel>Review Model</FormLabel>
              <Input
                value={reviewModel}
                onChange={(e) => setReviewModel(e.target.value)}
                placeholder="e.g. gpt-4"
              />
            </FormControl>
            <FormControl display="flex" alignItems="center">
              <FormLabel htmlFor="autoPatch" mb="0">Auto‑apply LLM patches (risky)</FormLabel>
              <Switch id="autoPatch" role="switch" aria-checked={autoPatch} isChecked={autoPatch} onChange={() => setAutoPatch(!autoPatch)} />
            </FormControl>
            <FormControl>
              <FormLabel>Model</FormLabel>
              <Input
                value={cliOptions.model}
                onChange={(e) => setCliOptions({ ...cliOptions, model: e.target.value })}
                placeholder="Model name"
              />
            </FormControl>
            <FormControl>
              <FormLabel>Temperature</FormLabel>
              <NumberInput
                value={cliOptions.temperature}
                onChange={(valueString) => setCliOptions({ ...cliOptions, temperature: parseFloat(valueString) || 0 })}
                step={0.1}
                min={0}
                max={2}
              >
                <NumberInputField />
              </NumberInput>
            </FormControl>
            <FormControl>
              <FormLabel>Max Tokens</FormLabel>
              <NumberInput
                value={cliOptions.max_tokens ?? ''}
                onChange={(valueString) => setCliOptions({ ...cliOptions, max_tokens: parseInt(valueString) || null })}
                min={1}
              >
                <NumberInputField />
              </NumberInput>
            </FormControl>
            <FormControl>
              <FormLabel>Top P</FormLabel>
              <NumberInput
                value={cliOptions.top_p ?? ''}
                onChange={(valueString) => setCliOptions({ ...cliOptions, top_p: parseFloat(valueString) || null })}
                step={0.1}
                min={0}
                max={1}
              >
                <NumberInputField />
              </NumberInput>
            </FormControl>
            <FormControl>
              <FormLabel>N (completions)</FormLabel>
              <NumberInput
                value={cliOptions.n ?? ''}
                onChange={(valueString) => setCliOptions({ ...cliOptions, n: parseInt(valueString) || null })}
                min={1}
              >
                <NumberInputField />
              </NumberInput>
            </FormControl>
            <FormControl display="flex" alignItems="center">
              <FormLabel htmlFor="stream" mb="0">Stream responses</FormLabel>
              <Switch id="stream" role="switch" aria-checked={cliOptions.stream} isChecked={cliOptions.stream} onChange={() => setCliOptions({ ...cliOptions, stream: !cliOptions.stream })} />
            </FormControl>
            <FormControl>
              <FormLabel>Stop Sequences (comma-separated)</FormLabel>
              <Input
                value={cliOptions.stop.join(',')}
                onChange={(e) => setCliOptions({ ...cliOptions, stop: e.target.value.split(',').map(s => s.trim()).filter(s => s) })}
                placeholder="stop1, stop2"
              />
            </FormControl>
            <FormControl>
              <FormLabel>Logprobs</FormLabel>
              <NumberInput
                value={cliOptions.logprobs ?? ''}
                onChange={(valueString) => setCliOptions({ ...cliOptions, logprobs: parseInt(valueString) || null })}
                min={0}
              >
                <NumberInputField />
              </NumberInput>
            </FormControl>
            <FormControl>
              <FormLabel>Language</FormLabel>
              <Select value={uiLanguage} onChange={(e) => setUiLanguage(e.target.value)}>
                <option value="en">English</option>
                <option value="ja">日本語</option>
              </Select>
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <HStack spacing={2}>
            <Button onClick={handleImport}>Import</Button>
            <Button onClick={handleExport}>Export</Button>
            <Button colorScheme="blue" onClick={handleSave}>Save</Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default SettingsModal;