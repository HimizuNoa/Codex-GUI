import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Diff, Hunk, parseDiff } from 'react-diff-viewer-continued';
import 'react-diff-viewer-continued/dist/index.css';

export default function DiffModal({ issues, original, patched, diff, onApply, onClose }) {
  const files = diff ? parseDiff(diff) : [];

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content className="modal">
        <Dialog.Title>Security Review Warning</Dialog.Title>
        <p>The LLM reviewer detected issues:</p>
        <ul>
          {issues.map((iss, i) => (
            <li key={i}>{iss}</li>
          ))}
        </ul>

        {files.map(({ hunks, oldRevision, newRevision }) => (
          <Diff key={oldRevision + newRevision} viewType="unified" diffType="modify">
            {hunks.map((hunk) => (
              <Hunk key={hunk.content} hunk={hunk} />
            ))}
          </Diff>
        ))}

        <div className="modal-actions">
          <button onClick={onApply}>Apply Patch</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}