import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  Input,
  Text,
  useDisclosure
} from '@chakra-ui/react';

/**
 * PromptModal: displays a CLI prompt and collects user response.
 * Props:
 *  isOpen: boolean
 *  promptText: string
 *  onSubmit: (answer: string) => void
 *  onCancel: () => void
 */
export default function PromptModal({ isOpen, promptText, onSubmit, onCancel }) {
  const [answer, setAnswer] = useState('');
  // Reset answer when opening
  useEffect(() => {
    if (isOpen) setAnswer('');
  }, [isOpen, promptText]);
  return (
    <Modal isOpen={isOpen} onClose={onCancel} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>CLI Prompt</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text whiteSpace="pre-wrap" mb={4}>{promptText}</Text>
          <Input
            placeholder="Type response..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(answer); }}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onCancel}>Cancel</Button>
          <Button colorScheme="blue" onClick={() => onSubmit(answer)}>Submit</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}