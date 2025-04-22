import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Diff, Hunk, parseDiff } from 'react-diff-viewer-continued';
// Styles for diff viewer are not packaged; default styles will apply or include manually if needed
// import 'react-diff-viewer-continued/dist/index.css';

export default function DiffModal({ issues, original, patched, diff, onApply, onClose }) {
  const files = diff ? parseDiff(diff) : [];

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content
        className="modal"
        aria-labelledby="security-review-title"
        aria-describedby="security-review-description"
      >
        <Dialog.Title id="security-review-title">Security Review Warning</Dialog.Title>
        <Dialog.Description id="security-review-description">
          The LLM reviewer detected issues:
        </Dialog.Description>
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