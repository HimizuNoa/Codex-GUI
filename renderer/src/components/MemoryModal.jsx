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
 * Modal to display and query memory nodes.
 */
export default function MemoryModal({ isOpen, onClose }) {
  const [nodes, setNodes] = useState([]);
  useEffect(() => {
    if (isOpen) {
      window.electron.memory.list().then(setNodes);
    }
  }, [isOpen]);
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Memory Nodes</ModalHeader>
        <ModalBody>
          {nodes.length === 0 ? (
            <Text>No memory nodes.</Text>
          ) : (
            <List spacing={3} maxH="400px" overflowY="auto">
              {nodes.map((n) => (
                <ListItem key={n.id}>
                  <VStack align="start" spacing={1}>
                    <Text fontSize="xs" color="gray.500">{new Date(n.timestamp).toLocaleString()}</Text>
                    <Text whiteSpace="pre-wrap">{n.content}</Text>
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