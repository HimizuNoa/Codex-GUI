import React from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  List,
  ListItem,
  Text,
  VStack
} from '@chakra-ui/react';
import { format } from 'date-fns';

/**
 * PromptHistory modal displays past prompts and allows re-running them.
 * props:
 *   isOpen: boolean
 *   onClose: () => void
 *   history: Array<{ prompt: string, mode: string, timestamp: number }>
 *   onSelect: (entry) => void
 */
export default function PromptHistory({ isOpen, onClose, history, onSelect }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Prompt History</ModalHeader>
        <ModalBody>
          <List spacing={3} maxH="400px" overflowY="auto">
            {history.length === 0 && <Text>No history available.</Text>}
            {history.map((entry, idx) => (
              <ListItem key={idx}>
                <VStack align="start" spacing={1}>
                  <Text fontSize="sm" color="gray.500">
                    {format(new Date(entry.timestamp), 'yyyy-MM-dd HH:mm:ss')} • {entry.mode}
                  </Text>
                  <Text
                    bg="gray.100"
                    p={2}
                    borderRadius="sm"
                    whiteSpace="pre-wrap"
                    onClick={() => onSelect(entry)}
                    cursor="pointer"
                  >
                    {entry.prompt}
                  </Text>
                </VStack>
              </ListItem>
            ))}
          </List>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}