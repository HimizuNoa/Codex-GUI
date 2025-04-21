import React, { useState, useEffect } from 'react';
import DiffModal from './components/DiffModal';
import DiffHistory from './components/DiffHistory'; from './components/DiffModal';
import { ToastProvider, ToastViewport, Toast } from '@radix-ui/react-toast';

const { ipcRenderer } = window.electron;

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

  
  useEffect(() => {
    window.electron.onToast((m)=>setToastMsg(m));
    window.electron.onKeyStatus((v)=>setKeyConfigured(v));
  }, []);

    
  }, []);

  const /* key set removed */ = async () => {
    const key = prompt('Enter OpenAI API key');
    if (!key) return;
    const res = await ipcRenderer.invoke('set-api-key', key.trim());
    if (res.success) {
      setHasKey(true);
      setToastMsg('API key saved');
    } else {
      setToastMsg(res.error);
    }
  };

  const handleRun = async () => {
    
    setLoading(true);
    setOutput('');
    setReviewData(null);
    const res = await ipcRenderer.invoke('run-codex', { prompt, mode });
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
        <h1>Codex GUI v10</h1><button onClick={()=>window.electron.invoke('open-settings')}>⚙️ Settings</button> <button onClick={()=>setShowHistory(true)}>🗂 Diff History</button><span>{keyConfigured? '🔑 Configured':'🔒 No Key'}</span>

        <div className="key-section">
          <button onClick={/* key set removed */}>
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