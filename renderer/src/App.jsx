import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import DiffModal from './components/DiffModal';
import DiffHistory from './components/DiffHistory';
import PromptHistory from './components/PromptHistory';
import EditModal from './components/EditModal';
import HelpModal from './components/HelpModal';
import ChatPanel from './components/ChatPanel';
import SettingsModal from './components/SettingsModal';
import ContextModal from './components/ContextModal';
import MemoryModal from './components/MemoryModal';
import { parsePatch, applyPatch } from 'diff';
import {
  Grid,
  GridItem,
  Flex,
  Box,
  Text,
  Input,
  Textarea as ChakraTextarea,
  Button,
  VStack,
  Progress,
  useToast,
  Badge,
  Heading,
  useColorMode,
  SlideFade,
  CloseButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Tooltip
} from '@chakra-ui/react';
import { fuzzyMatch } from './utils/searchUtils';
import PromptModal from './components/PromptModal';
// Use the exposed API from preload
const {
  invoke,
  onKeyStatus,
  listDiffs,
  selectWorkingFolder,
  getWorkingFolder,
  onWorkingFolderChanged,
  onRunLog,
  listFiles,
  readFile,
  writeFile,
  scanShell,
  executeShell,
  onShellLog,
  onShellExit
  , onCliPrompt, respondCliPrompt
} = window.electron;

function App() {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState('--complete');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  // Chat messages: { type: 'user' | 'bot', text }
  const [logs, setLogs] = useState([]);
  // UI language (for localization)
  const [uiLanguage, setUiLanguage] = useState('en');
  // CLI options (to get model name)
  const [cliOptions, setCliOptions] = useState({ model: '' });
  // File browser state
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [openTabs, setOpenTabs] = useState([]);
  // Shell executor state
  const [shellCmd, setShellCmd] = useState('');
  const [shellLogs, setShellLogs] = useState([]);
  const [shellRunning, setShellRunning] = useState(false);
  const [fileContent, setFileContent] = useState('');
  // Working folder state
  const [workingFolder, setWorkingFolder] = useState('');
  

  // diff modal state
  const [reviewData, setReviewData] = useState(null);
  // Unsafe prompt review state
  const [errorData, setErrorData] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  // Prompt history state
  const [promptHistory, setPromptHistory] = useState([]);
  const [showPromptHistory, setShowPromptHistory] = useState(false);
  // Context & Memory modals
  const [showContext, setShowContext] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  // Settings modal state
  const [showSettings, setShowSettings] = useState(false);
  // Interactive CLI prompt state
  const [cliPrompt, setCliPrompt] = useState({ text: '', isOpen: false });
  // Refs for focus control
  const promptRef = useRef(null);
  const fileFilterRef = useRef(null);
  // Determine Monaco language based on file extension
  const fileLanguage = React.useMemo(() => {
    const ext = selectedFile.split('.').pop();
    switch (ext) {
      case 'js': return 'javascript';
      case 'ts': return 'typescript';
      case 'html': return 'html';
      case 'css': return 'css';
      default: return 'plaintext';
    }
  }, [selectedFile]);
  // Help modal state
  const [showHelp, setShowHelp] = useState(false);
  const [helpText, setHelpText] = useState('');
  // Injection guidance modal state
  const [showInjection, setShowInjection] = useState(false);
  const [agentMsg, setAgentMsg] = useState('');
  // File filter state
  const [fileFilter, setFileFilter] = useState('');
  // Interactive edit diff state
  const [editDiff, setEditDiff] = useState(null);

  // Chakra UI hooks: toast and color mode
  const toast = useToast();
  const { colorMode, toggleColorMode } = useColorMode();
  // API key status
  const [hasKey, setHasKey] = useState(false);
  const [keyConfigured, setKeyConfigured] = useState(false);

  
  useEffect(() => {
    // Listen for API key status updates
    onKeyStatus((v) => setKeyConfigured(v));
    // initial key status will be emitted by main after window loads
    // load initial working folder
    getWorkingFolder().then((folder) => {
      if (folder) setWorkingFolder(folder);
    });
    onWorkingFolderChanged((folder) => setWorkingFolder(folder));
    // Subscribe to run logs
    // Receive streaming logs from main process (bot messages)
    onRunLog((msg) => {
      const text = msg.trim();
      if (!text) return;
      // Suppress any pure reasoning markers
      if (/^思考プロセスを受信(?: 思考プロセスを受信)*$/.test(text)) return;
      setLogs((prev) => {
        // Avoid exact duplicates
        if (prev.length > 0 && prev[prev.length - 1].text === text) {
          return prev;
        }
        return [...prev, { type: 'bot', text }];
      });
    });
    // Load UI language preference
    invoke('get-ui-language').then((lang) => setUiLanguage(lang));
    // Load CLI options (model name)
    invoke('get-cli-options').then((opts) => setCliOptions(opts));
    // Subscribe to shell logs
    onShellLog((log) => setShellLogs((prev) => [...prev, log]));
    onShellExit((code) => {
      setShellRunning(false);
      setShellLogs((prev) => [...prev, { type: 'exit', data: `Exited: ${code}` }]);
    });
    // Load file list initially
    listFiles().then((list) => setFiles(list));
    // Subscribe to interactive CLI prompts
    onCliPrompt((promptText) => setCliPrompt({ text: promptText, isOpen: true }));
  }, []);

  // Show toast notifications on generation start and completion
  const prevLoadingRef = useRef(false);
  useEffect(() => {
    if (!prevLoadingRef.current && loading) {
      toast({ description: 'Generation started', status: 'info', duration: 2000, isClosable: true });
    }
    if (prevLoadingRef.current && !loading) {
      toast({ description: 'Generation complete', status: 'success', duration: 3000, isClosable: true });
    }
    prevLoadingRef.current = loading;
  }, [loading]);
  
  // Load prompt history when opening history modal
  useEffect(() => {
    if (showPromptHistory) {
      invoke('get-prompt-history').then((h) => setPromptHistory(h));
    }
  }, [showPromptHistory]);
  // When selectedFile changes, load content
  useEffect(() => {
    if (selectedFile) {
      readFile(selectedFile).then((c) => setFileContent(c));
    }
  }, [selectedFile]);

  // Report false-positive prompt injection analysis
  const [reportLoading, setReportLoading] = useState(false);
  const [reportResult, setReportResult] = useState('');
  const handleReport = async () => {
    setReportResult('');
    setReportLoading(true);
    const res = await invoke('report-prompt-flag', { prompt, scan: errorData.scan });
    setReportLoading(false);
    if (res.success) {
      setReportResult(res.report);
    } else {
      toast({ description: res.error || 'Report failed.', status: 'error', duration: 3000, isClosable: true });
    }
  };
  
  // Handler to run shell command
  const handleShellRun = async () => {
    setShellLogs([]);
    // Pre-scan shell command
    const scan = await scanShell(shellCmd, []);
    if (!scan.safe) {
      setShellLogs([{ type: 'stderr', data: 'Unsafe shell command: ' + scan.issues.join('; ') }]);
      return;
    }
    setShellRunning(true);
    executeShell(shellCmd, []);
  };
  // Auto-save fileContent on change
  // Auto-save fileContent on change
  useEffect(() => {
    if (selectedFile) {
      const timeout = setTimeout(() => {
        writeFile({ path: selectedFile, content: fileContent });
        setLogs((prev) => [...prev, `Auto-saved ${selectedFile}`]);
        listFiles().then((list) => setFiles(list));
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [fileContent, selectedFile]);
  // Keyboard shortcuts: Ctrl+1 => prompt, Ctrl+2 => file filter, Ctrl+S => settings, F1 => help
  const handleShowHelp = async () => {
    try {
      const text = await invoke('get-cli-help');
      setHelpText(text);
      setShowHelp(true);
    } catch (e) {
      console.error('Failed to load CLI help:', e);
    }
  };
  useEffect(() => {
    const handler = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === '1') {
        promptRef.current?.focus();
        e.preventDefault();
      }
      if (mod && e.key === '2') {
        fileFilterRef.current?.focus();
        e.preventDefault();
      }
      if (mod && e.key.toLowerCase() === 's') {
        setShowSettings(true);
        e.preventDefault();
      }
      if (e.key === 'F1') {
        e.preventDefault();
        handleShowHelp();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Run Codex with optional skipScan flag
  const runCodexHandler = async (skipScan = false) => {
    setLogs([{ type: 'user', text: prompt }]);
    setLoading(true);
    setOutput('');
    setReviewData(null);
    setErrorData(null);
    setShowInjection(false);
    setAgentMsg('');
    // Record prompt history
    invoke('add-prompt-history', { prompt, mode, timestamp: Date.now() });
    const res = await invoke('run-codex', { prompt, mode, files: selectedFile ? [selectedFile] : [], skipScan });
    setLoading(false);
    // Interactive edit mode
    if (res.edit) {
      setEditDiff(res.diff);
      return;
    }
    // Injection detection: ask user via agent
    if (res.injection) {
      // Display agent guidance in chat
      setLogs((prev) => [...prev, { type: 'bot', text: res.agentMsg }]);
      setAgentMsg(res.agentMsg);
      setErrorData(res.scan);
      setShowInjection(true);
      return;
    }
    // Security review warning
    if (res.warning) {
      setReviewData(res);
      return;
    }
    // Success path
    // Handle generated files saved to workingFolder
    if (res.savedPaths && res.savedPaths.length > 0) {
      // Add file-messages for each saved path
      setLogs((prev) => [
        ...prev,
        ...res.savedPaths.map((p) => ({ type: 'bot', text: JSON.stringify({ type: 'file', content: p }) }))
      ]);
      // Refresh file list in file browser
      listFiles().then((list) => setFiles(list));
      return;
    }
    // Legacy single-path support
    if (res.savedPath) {
      setLogs((prev) => [
        ...prev,
        { type: 'bot', text: JSON.stringify({ type: 'file', content: res.savedPath }) }
      ]);
      listFiles().then((list) => setFiles(list));
      return;
    }
    if (res.success) {
      setOutput(res.data);
      if (res.autoPatched) toast({ description: '⚠️ Auto‑patch was applied', status: 'warning', duration: 3000, isClosable: true });
      // Refresh file list
      listFiles().then((list) => setFiles(list));
      return;
    }
    // Other errors
    toast({ description: res.error || 'Error', status: 'error', duration: 3000, isClosable: true });
  };
  const handleRun = () => runCodexHandler(false);
  const handleProceedInjection = () => runCodexHandler(true);

  const handleApplyPatch = () => {
    if (reviewData && reviewData.patchedCode) {
      setOutput(reviewData.patchedCode);
      setReviewData(null);
      toast({ description: 'Patched code applied to output.', status: 'success', duration: 3000, isClosable: true });
    }
  };
  // Apply interactive edit patches to files
  const handleApplyEdit = async (diffText) => {
    const patches = parsePatch(diffText);
    for (const patch of patches) {
      const relPath = patch.newFileName;
      try {
        const orig = await readFile(relPath);
        const newContent = applyPatch(orig, patch);
        if (newContent === false) {
          toast({ description: `Failed to apply patch for ${relPath}`, status: 'error', duration: 3000, isClosable: true });
        } else {
          await writeFile({ path: relPath, content: newContent });
          toast({ description: `Applied patch to ${relPath}`, status: 'success', duration: 3000, isClosable: true });
        }
      } catch (err) {
        toast({ description: `Error applying patch to ${relPath}: ${err.message}`, status: 'error', duration: 3000, isClosable: true });
      }
    }
    setEditDiff(null);
    // refresh file list
    listFiles().then((list) => setFiles(list));
  };

  // Compute filtered files: regex (if /.../), substring match, else fuzzy match
  const filteredFiles = React.useMemo(() => {
    if (!fileFilter) return files;
    // regex: /pattern/flags
    if (fileFilter.startsWith('/') && fileFilter.lastIndexOf('/') > 0) {
      const last = fileFilter.lastIndexOf('/');
      const pattern = fileFilter.slice(1, last);
      const flags = fileFilter.slice(last + 1);
      try {
        const re = new RegExp(pattern, flags);
        return files.filter((f) => re.test(f));
      } catch {
        // fall through
      }
    }
    // substring match
    const subs = files.filter((f) => f.includes(fileFilter));
    if (subs.length) return subs;
    // fuzzy fallback
    return files.filter((f) => fuzzyMatch(fileFilter, f));
  }, [files, fileFilter]);
  return (
    <>
      <PromptModal
        isOpen={cliPrompt.isOpen}
        promptText={cliPrompt.text}
        onSubmit={(ans) => { respondCliPrompt(ans); setCliPrompt({ text: '', isOpen: false }); }}
        onCancel={() => { respondCliPrompt(''); setCliPrompt({ text: '', isOpen: false }); }}
      />
      <Grid templateColumns="1fr 2fr 1fr" height="100vh">
      {/* Left sidebar: Chat Panel */}
      <GridItem p={4} overflowY="auto" bg="gray.50" borderRightWidth="1px" borderColor="gray.200">
        {loading && <Progress size="xs" isIndeterminate colorScheme="blue" mb={2} />}
        <ChatPanel
          messages={logs}
          modelName={cliOptions.model || ''}
          uiLanguage={uiLanguage}
          // Open files in editor when clicking file messages
          onFileClick={(file) => {
            setSelectedFile(file);
            setOpenTabs((tabs) => tabs.includes(file) ? tabs : [...tabs, file]);
          }}
        />
      </GridItem>
      <GridItem p={4} overflowY="auto">
        {/* Header with title, theme toggle, settings */}
        <Flex align="center" justify="space-between" mb={4}>
          <Heading as="h1" size="lg">Codex GUI v10</Heading>
          <Flex align="center">
            <Badge colorScheme={keyConfigured ? 'green' : 'red'} mr={2}>
              {keyConfigured ? '🔑 Configured' : '🔒 No Key'}
            </Badge>
            <Button variant="ghost" aria-label="Toggle Theme" onClick={toggleColorMode} mr={2}>
              {colorMode === 'light' ? '🌙' : '☀️'}
            </Button>
            <Button variant="ghost" onClick={() => setShowSettings(true)}>⚙️ Settings</Button>
            <Button variant="ghost" onClick={() => setShowContext(true)}>🧠 Context</Button>
            <Button variant="ghost" onClick={() => setShowMemory(true)}>📚 Memory</Button>
            <Button variant="ghost" onClick={handleShowHelp}>❔ Help</Button>
          </Flex>
        </Flex>
        {/* Working folder selection */}
        <Button variant="ghost" aria-label="Select working folder" onClick={async () => {
          const folder = await selectWorkingFolder();
          if (folder) setWorkingFolder(folder);
        }}>📁 Set Working Folder</Button>
        <div className="working-folder">
          Working Folder: {workingFolder || 'Not set'}
        </div>

        {/* Key change currently opens onboarding window */}
        <div className="key-section">
          <Button variant="outline" aria-label={hasKey ? 'Change API key' : 'Set API key'} onClick={() => invoke('open-onboarding')}>
            {hasKey ? '🔑 Change API key' : '🔑 Set API key'}
          </Button>
        </div>

        <Tooltip label={`CLI: codex ${mode} <prompt>`} fontSize="sm">
        <ChakraTextarea
          ref={promptRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.ctrlKey && e.key === 'Enter') handleRun();
            if (e.key === 'Escape') setPrompt('');
          }}
          placeholder="Enter prompt… (Ctrl+Enter to send, Esc to clear, Ctrl+1 to focus)"
          rows={8}
          mb={4}
          variant="flushed"
          focusBorderColor="blue.400"
          transition="border-color 0.2s ease"
        />
        </Tooltip>

        <div className="controls">
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="--complete">Complete</option>
            <option value="--edit">Edit</option>
            <option value="--chat">Chat</option>
          </select>
          <Tooltip label={`Execute: codex ${mode} ${selectedFile ? selectedFile : '<all files>'}`} fontSize="sm">
          <Button colorScheme="blue" aria-label="Run Codex" onClick={handleRun} isLoading={loading}>
            Run Codex
          </Button>
          </Tooltip>
        </div>

        {loading && <div className="spinner">⏳</div>}
        {/* Shell panel */}
        <Box className="shell-panel" mt={4}>
          <Text as="h3" fontSize="lg" mb={2}>Shell Executor</Text>
          <Flex mb={2}>
            <Input
              aria-label="Shell command"
              flex={1}
              mr={2}
              placeholder="command"
              value={shellCmd}
              onChange={(e) => setShellCmd(e.target.value)}
            />
            <Button size="sm" onClick={handleShellRun} isLoading={shellRunning}>
              Run
            </Button>
          </Flex>
          <Box as="pre" maxH="150px" overflowY="auto" bg="gray.100" p={2} borderRadius="md">
            {shellLogs.map((l, i) => (
              <Text key={i} color={l.type === 'stderr' ? 'red.500' : 'black'} whiteSpace="pre-wrap">
                {l.data}
              </Text>
            ))}
          </Box>
        </Box>
        <pre className="output">{output}</pre>

        {reviewData && (
          <DiffModal
            issues={reviewData.issues}
            original={reviewData.data || ''}
            patched={reviewData.patchedCode}
            diff={reviewData.diff}
            onApply={handleApplyPatch}
            onClose={() => setReviewData(null)}
          />
        )}

        {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        uiLanguage={uiLanguage}
        setUiLanguage={setUiLanguage}
      />
        {/* Injection Guidance Modal */}
        <Modal isOpen={showInjection} onClose={() => setShowInjection(false)}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>プロンプト安全確認</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Text whiteSpace="pre-wrap">{agentMsg}</Text>
            </ModalBody>
            <ModalFooter>
              <Button colorScheme="blue" mr={3} onClick={() => { setShowInjection(false); handleProceedInjection(); }}>
                続行
              </Button>
              <Button variant="ghost" onClick={() => setShowInjection(false)}>
                キャンセル
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
        {/* CLI Help Modal */}
        <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} helpText={helpText} />
        {/* Interactive Edit mode modal */}
        {editDiff && (
          <EditModal
            diff={editDiff}
            onApply={handleApplyEdit}
            onClose={() => setEditDiff(null)}
          />
        )}
        {/* Diff history modal */}
        <DiffHistory open={showHistory} onClose={() => setShowHistory(false)} />
        {/* Prompt history modal */}
        <PromptHistory
          isOpen={showPromptHistory}
          onClose={() => setShowPromptHistory(false)}
          history={promptHistory}
          onSelect={(entry) => {
            setPrompt(entry.prompt);
            setMode(entry.mode);
            setShowPromptHistory(false);
          }}
        />
        {/* Context modal */}
        <ContextModal isOpen={showContext} onClose={() => setShowContext(false)} />
        {/* Memory modal */}
        <MemoryModal isOpen={showMemory} onClose={() => setShowMemory(false)} />
        {/* Unsafe prompt review UI */}
        {errorData && (
          <Box className="prompt-error" p={4} bg="red.50" borderRadius="md" mt={4}>
            <Text fontSize="lg" fontWeight="bold">{errorData.message}</Text>
            <Text mt={2} fontWeight="semibold">Scanned Prompt Messages:</Text>
            <Box as="pre" p={2} bg="gray.100" whiteSpace="pre-wrap" maxH="200px" overflowY="auto">
              {JSON.stringify(errorData.scan.messages, null, 2)}
            </Box>
            <Text mt={2} fontWeight="semibold">Scanner Response:</Text>
            <Box as="pre" p={2} bg="gray.100" whiteSpace="pre-wrap" maxH="200px" overflowY="auto">
              {errorData.scan.raw}
            </Box>
            <Button mt={2} size="sm" colorScheme="yellow" onClick={handleReport} isLoading={reportLoading}>
              Report false positive
            </Button>
            {reportResult && (
              <Box mt={2} p={2} bg="yellow.50" borderRadius="md">
                <Text fontWeight="semibold">Analysis:</Text>
                <Box as="pre" whiteSpace="pre-wrap" maxH="200px" overflowY="auto">
                  {reportResult}
                </Box>
              </Box>
            )}
          </Box>
        )}
      </GridItem>
      {/* File Browser Panel */}
      <GridItem p={4} borderLeft="1px solid" borderColor="gray.200" overflowY="auto">
        <Text as="h3" fontSize="lg" mb={2}>Files</Text>
        <Input
          ref={fileFilterRef}
          aria-label="Filter files"
          placeholder="Search files... (Ctrl+2 to focus, use /regex/ syntax)"
          mb={2}
          value={fileFilter}
          onChange={(e) => setFileFilter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setFileFilter('');
          }}
        />
          <VStack align="stretch" spacing={1} maxH="200px" overflowY="auto">
          {filteredFiles.map((f) => (
            <Button
              key={f}
              variant="link"
              justifyContent="flex-start"
              whiteSpace="normal"
              colorScheme={f === selectedFile ? 'blue' : 'gray'}
              onClick={() => {
                setSelectedFile(f);
                setOpenTabs((tabs) => tabs.includes(f) ? tabs : [...tabs, f]);
              }}
            >
              {f}
            </Button>
          ))}
        </VStack>
        {selectedFile && (
          <Box mt={4}>
            <Text fontWeight="bold" mb={2}>Editing: {selectedFile}</Text>
            {/* Open file tabs */}
            {openTabs.length > 0 && (
              <Flex mb={2}>
                {openTabs.map((tab) => (
                  <Button
                    key={tab}
                    size="sm"
                    variant={tab === selectedFile ? 'solid' : 'outline'}
                    mr={1}
                    onClick={() => setSelectedFile(tab)}
                  >
                    {tab.split('/').pop()}
                    <CloseButton
                      size="sm"
                      ml={1}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenTabs((tabs) => tabs.filter((t) => t !== tab));
                        if (selectedFile === tab) {
                          const remaining = openTabs.filter((t) => t !== tab);
                          setSelectedFile(remaining[0] || '');
                        }
                      }}
                    />
                  </Button>
                ))}
              </Flex>
            )}
            {/* Monaco Editor */}
            <Editor
              height="60vh"
              language={fileLanguage}
              theme={colorMode === 'light' ? 'light' : 'vs-dark'}
              value={fileContent}
              onChange={(value) => setFileContent(value || '')}
              options={{ automaticLayout: true, minimap: { enabled: false } }}
            />
          </Box>
        )}
      </GridItem>
    </Grid>
  </>
  );
}

export default App;