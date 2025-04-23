import React from 'react';
import { VStack } from '@chakra-ui/react';
import ChatBubble from './ChatBubble';

/**
 * ChatPanel displays a sequence of messages as chat bubbles with collapse/expand.
 * messages: array of { type: 'user' | 'bot', text: string }
 */
/**
 * ChatPanel displays a sequence of messages as chat bubbles with collapse/expand.
 * messages: array of { type: 'user' | 'bot', text: string }
 */
/**
 * ChatPanel displays a sequence of messages as chat bubbles with collapse/expand.
 * Props:
 *  - messages: array of { type: 'user' | 'bot', text: string }
 *  - modelName: string (LLM model name for bot label)
 *  - uiLanguage: string ('en' or 'ja')
 */
export default function ChatPanel({ messages, modelName, uiLanguage }) {
  // Filter out internal JSON logs without meaningful content
  const filtered = messages.filter((m) => {
    try {
      const obj = JSON.parse(m.text);
      if (obj.type === 'message') return true;
      if (obj.type === 'reasoning') return Array.isArray(obj.summary) && obj.summary.length > 0;
      if (obj.type === 'file') return true;
      return false;
    } catch {
      return true;
    }
  });
  return (
    <VStack align="stretch" spacing={3}>
      {filtered.map((m, i) => (
        <ChatBubble
          key={i}
          type={m.type}
          text={m.text}
          modelName={modelName}
          uiLanguage={uiLanguage}
        />
      ))}
    </VStack>
  );
}