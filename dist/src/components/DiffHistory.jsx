
import React, { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Diff, Hunk, parseDiff } from 'react-diff-viewer-continued';

export default function DiffHistory({ open, onClose }) {
  const [files, setFiles] = useState([]);
  const [content, setContent] = useState('');

  useEffect(() => {
    if (open) {
      window.electron.listDiffs().then(setFiles);
    }
  }, [open]);

  const handleSelect = async (p) => {
    const txt = await window.electron.getDiff(p);
    setContent(txt);
  };

  const renderDiff = () => {
    if (!content) return null;
    const parsed = parseDiff(content);
    return parsed.map(file => (
      <Diff key={file.newRevision} viewType="unified" diffType="modify">
        {file.hunks.map(h => <Hunk key={h.content} hunk={h} />)}
      </Diff>
    ));
  };

  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Content className="modal">
        <Dialog.Title>Diff History</Dialog.Title>
        <div style={{display:'flex',gap:'1rem'}}>
          <ul style={{width:'200px',maxHeight:'400px',overflow:'auto'}}>
            {files.map(f=>(
              <li key={f.path}>
                <button onClick={()=>handleSelect(f.path)}>{new Date(f.mtime).toLocaleString()} — {f.name}</button>
              </li>
            ))}
          </ul>
          <div style={{flex:1,maxHeight:'400px',overflow:'auto'}}>
            {renderDiff()}
          </div>
        </div>
        <Dialog.Close>Close</Dialog.Close>
      </Dialog.Content>
    </Dialog.Root>
  );
}
