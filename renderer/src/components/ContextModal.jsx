import React, { useEffect, useState } from 'react';
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

/**
 * Modal to display context history entries.
 */
export default function ContextModal({ isOpen, onClose }) {
  const [entries, setEntries] = useState([]);
  useEffect(() => {
    if (isOpen) {
      window.electron.context.list().then(setEntries);
    }
  }, [isOpen]);
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Context History</ModalHeader>
        <ModalBody>
          {entries.length === 0 ? (
            <Text>No context entries.</Text>
          ) : (
            <List spacing={3} maxH="400px" overflowY="auto">
              {entries.map((e, i) => (
                <ListItem key={i}>
                  <VStack align="start" spacing={1}>
                    <Text fontSize="xs" color="gray.500">{new Date(e.timestamp).toLocaleString()}</Text>
                    <Text whiteSpace="pre-wrap">{JSON.stringify(e)}</Text>
                  </VStack>
                </ListItem>
              ))}
            </List>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}