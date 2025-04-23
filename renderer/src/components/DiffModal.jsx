import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Diff, Hunk } from 'react-diff-viewer-continued';
import { parsePatch } from 'diff';
// Styles for diff viewer are not packaged; default styles will apply or include manually if needed
// import 'react-diff-viewer-continued/dist/index.css';

export default function DiffModal({ issues, original, patched, diff, onApply, onClose }) {
  const files = diff ? parsePatch(diff) : [];

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

        {files.map(({ hunks, oldFileName, newFileName }) => (
          <Diff key={oldFileName + newFileName} viewType="unified" diffType="modify">
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