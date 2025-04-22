import React from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Textarea
} from '@chakra-ui/react';

/**
 * HelpModal displays CLI help text in a modal dialog.
 * props: isOpen, onClose, helpText
 */
export default function HelpModal({ isOpen, onClose, helpText }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Codex CLI Help</ModalHeader>
        <ModalBody>
          <Textarea
            value={helpText}
            isReadOnly
            rows={20}
            fontFamily="monospace"
          />
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}