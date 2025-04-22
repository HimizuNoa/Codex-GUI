
import React, { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Box, VStack, Button, Text } from '@chakra-ui/react';

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
    setContent(txt.data || '');
  };

  // Render raw unified diff
  const renderDiff = () => {
    if (!content) return <Text>No diff selected.</Text>;
    return (
      <Box
        as="pre"
        fontFamily="monospace"
        whiteSpace="pre-wrap"
        overflowY="auto"
        maxH="400px"
        p={2}
        bg="gray.50"
        borderRadius="md"
      >
        {content}
      </Box>
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Overlay />
      <Dialog.Content aria-labelledby="diff-history-title" aria-describedby="diff-history-description">
        <Dialog.Title id="diff-history-title">Diff History</Dialog.Title>
        <Dialog.Description id="diff-history-description">
          Browse and preview previously generated diffs.
        </Dialog.Description>
        <VStack align="stretch" spacing={4}>
          <Box maxH="200px" overflowY="auto">
            {files.map((f) => (
              <Button
                key={f.path}
                variant="link"
                onClick={() => handleSelect(f.path)}
                whiteSpace="normal"
                textAlign="left"
                width="100%"
              >
                {new Date(f.mtime).toLocaleString()} — {f.name}
              </Button>
            ))}
          </Box>
          {renderDiff()}
        </VStack>
        <Dialog.Close asChild>
          <Button mt={4}>Close</Button>
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Root>
  );
}
