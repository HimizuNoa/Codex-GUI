import React, { useState, useEffect } from 'react';
import DiffModal from './components/DiffModal';
import DiffHistory from './components/DiffHistory';
import { ToastProvider, ToastViewport, Toast } from '@radix-ui/react-toast';

// Use the exposed API from preload
const { invoke, onToast, onKeyStatus, listDiffs } = window.electron;

function App() {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState('--complete');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  

  // diff modal state
  const [reviewData, setReviewData] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  // toast
  const [toastMsg, setToastMsg] = useState('');
  // API key status
  const [hasKey, setHasKey] = useState(false);
  const [keyConfigured, setKeyConfigured] = useState(false);

  
  useEffect(() => {
    // Listen for toast messages and key-status updates
    onToast((msg) => setToastMsg(msg));
    onKeyStatus((v) => setKeyConfigured(v));
    // initial key status will be emitted by main after window loads
  }, []);

  const handleRun = async () => {
    setLoading(true);
    setOutput('');
    setReviewData(null);
    const res = await invoke('run-codex', { prompt, mode });
    setLoading(false);

    if (res.success) {
      setOutput(res.data);
      if(res.autoPatched){setToastMsg('⚠️ Auto‑patch was applied');}
    } else if (res.warning) {
      // security review failed – show diff modal
      setReviewData(res);
    } else {
      setToastMsg(res.error);
    }
  };

  const handleApplyPatch = () => {
    if (reviewData && reviewData.patchedCode) {
      setOutput(reviewData.patchedCode);
      setReviewData(null);
      setToastMsg('Patched code applied to output.');
    }
  };

  return (
    <ToastProvider>
      <div className="container">
        <h1>Codex GUI v10</h1>
        <button onClick={() => invoke('open-settings')}>⚙️ Settings</button>
        <button onClick={() => setShowHistory(true)}>🗂 Diff History</button>
        <span>{keyConfigured ? '🔑 Configured' : '🔒 No Key'}</span>

        {/* Key change currently opens onboarding window */}
        <div className="key-section">
          <button onClick={() => invoke('open-onboarding')}>
            {hasKey ? '🔑 Change API key' : '🔑 Set API key'}
          </button>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter prompt…"
          rows={8}
          className="prompt-input"
        />

        <div className="controls">
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="--complete">Complete</option>
            <option value="--edit">Edit</option>
            <option value="--chat">Chat</option>
          </select>
          <button onClick={handleRun} disabled={loading}>
            {loading ? 'Running…' : 'Run Codex'}
          </button>
        </div>

        {loading && <div className="spinner">⏳</div>}
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

        {toastMsg && (
          <Toast open duration={3000} onOpenChange={(o) => !o && setToastMsg('')}>
            {toastMsg}
          </Toast>
        )}
        <ToastViewport />
      </div>
    </ToastProvider>
  );
}

export default App;