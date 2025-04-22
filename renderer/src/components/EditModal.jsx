import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Diff, Hunk, parseDiff } from 'react-diff-viewer-continued';
import { Button, VStack, Text, Box } from '@chakra-ui/react';
import { parsePatch, applyPatch } from 'diff';

/**
 * EditModal shows diffs for interactive edit mode and applies patches.
 * @param {{diff: string, onApply: (diff: string) => void, onClose: () => void}} props
 */
export default function EditModal({ diff, onApply, onClose }) {
  const filePatches = parsePatch(diff);
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Overlay />
      <Dialog.Content className="modal">
        <Dialog.Title>Edit Mode Preview</Dialog.Title>
        <Dialog.Description>
          Review the proposed changes below. You can apply them to your files.
        </Dialog.Description>
        <VStack spacing={4} align="stretch" maxH="60vh" overflowY="auto" mt={4}>
          {filePatches.map((patch, idx) => (
            <Box key={idx}>
              <Text fontWeight="bold" mb={2}>{patch.newFileName}</Text>
              <Diff viewType="unified" diffType="modify">
                {patch.hunks.map((hunk) => (
                  <Hunk key={hunk.content} hunk={hunk} />
                ))}
              </Diff>
            </Box>
          ))}
        </VStack>
        <Box mt={4} display="flex" justifyContent="flex-end">
          <Button variant="outline" mr={2} onClick={onClose}>Cancel</Button>
          <Button colorScheme="blue" onClick={() => onApply(diff)}>Apply</Button>
        </Box>
      </Dialog.Content>
    </Dialog.Root>
  );
}