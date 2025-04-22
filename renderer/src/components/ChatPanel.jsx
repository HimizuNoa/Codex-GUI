import React from 'react';
import { VStack, Box, Text, SlideFade } from '@chakra-ui/react';

/**
 * ChatPanel displays a sequence of messages as chat bubbles.
 * messages: array of { type: 'user' | 'bot', text: string }
 */
export default function ChatPanel({ messages }) {
  return (
    <VStack align="stretch" spacing={3}>
      {messages.map((m, i) => (
        <SlideFade in offsetY="10px" key={i}>
          <Box
            alignSelf={m.type === 'user' ? 'flex-end' : 'flex-start'}
            bg={m.type === 'user' ? 'blue.500' : 'gray.200'}
            color={m.type === 'user' ? 'white' : 'black'}
            px={3}
            py={2}
            borderRadius="md"
            maxW="80%"
            whiteSpace="pre-wrap"
          >
            <Text>{m.text}</Text>
          </Box>
        </SlideFade>
      ))}
    </VStack>
  );
}