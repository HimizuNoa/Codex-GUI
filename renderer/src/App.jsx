import React, { useState, useEffect, useRef } from 'react';
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
  Flex,
  Box,
  Text,
  Input,
  Textarea as ChakraTextarea,
  Button,
  VStack,
  useToast,
  Badge,
  Heading,
  useColorMode,
  SlideFade,
} from '@chakra-ui/react';
import { fuzzyMatch } from './utils/searchUtils';
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
} = window.electron;

function App() {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState('--complete');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  // Chat messages: { type: 'user' | 'bot', text }
  const [logs, setLogs] = useState([]);
  // File browser state
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
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
  // Refs for focus control
  const promptRef = useRef(null);
  const fileFilterRef = useRef(null);
  // Help modal state
  const [showHelp, setShowHelp] = useState(false);
  const [helpText, setHelpText] = useState('');
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
    onRunLog((msg) => setLogs((prev) => [...prev, { type: 'bot', text: msg }]));
    // Subscribe to shell logs
    onShellLog((log) => setShellLogs((prev) => [...prev, log]));
    onShellExit((code) => {
      setShellRunning(false);
      setShellLogs((prev) => [...prev, { type: 'exit', data: `Exited: ${code}` }]);
    });
    // Load file list initially
    listFiles().then((list) => setFiles(list));
  }, []);
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

  const handleRun = async () => {
    // Start new chat: clear previous messages and add user prompt
    setLogs([{ type: 'user', text: prompt }]);
    setLoading(true);
    setOutput('');
    setReviewData(null);
    setErrorData(null);
    // Record prompt history
    invoke('add-prompt-history', { prompt, mode, timestamp: Date.now() });
    const res = await invoke('run-codex', { prompt, mode, files: selectedFile ? [selectedFile] : [] });
    setLoading(false);
    if (res.edit) {
      // Interactive edit diff
      setEditDiff(res.diff);
      return;
    }
    setLoading(false);

    if (res.success) {
      setOutput(res.data);
      if (res.autoPatched) toast({ description: '⚠️ Auto‑patch was applied', status: 'warning', duration: 3000, isClosable: true });
      // Refresh file list after run
      listFiles().then((list) => setFiles(list));
    } else if (res.warning) {
      // security review failed – show diff modal
      setReviewData(res);
    } else {
      // Unsafe prompt or other error
      if (res.scan) {
        // Injection detected: show scan messages and raw response
        setErrorData({ message: res.error, scan: res.scan });
      } else {
        toast({ description: res.error, status: 'error', duration: 3000, isClosable: true });
      }
    }
  };

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
    <Flex className="container" flexDir="row" height="100vh">
      <Box className="main-panel" flex="2" pr={4} overflowY="auto">
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

        <div className="controls">
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="--complete">Complete</option>
            <option value="--edit">Edit</option>
            <option value="--chat">Chat</option>
          </select>
          <Button colorScheme="blue" aria-label="Run Codex" onClick={handleRun} isLoading={loading}>
            Run Codex
          </Button>
        </div>

        {loading && <div className="spinner">⏳</div>}
        {/* Logs panel */}
        {/* Chat panel with streaming output */}
        <Box className="chat-panel" h="300px" overflowY="auto" bg="gray.50" p={4} borderRadius="md">
          <ChatPanel messages={logs} />
        </Box>
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
        <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
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
      </Box>
      {/* File Browser Panel */}
      <Box className="file-browser-panel" flex="1" borderLeft="1px solid" borderColor="gray.200" pl={4} overflowY="auto">
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
              onClick={() => setSelectedFile(f)}
            >
              {f}
            </Button>
          ))}
        </VStack>
        {selectedFile && (
          <Box mt={4}>
            <Text fontWeight="bold" mb={2}>Editing: {selectedFile}</Text>
            <ChakraTextarea
              fontFamily="mono"
              height="300px"
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
            />
          </Box>
        )}
      </Box>
      </Flex>
  );
}

export default App;