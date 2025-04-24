import React, { useState } from 'react';
import { SlideFade, Box, Text, Button } from '@chakra-ui/react';

// Localization strings for UI labels
const UI_STRINGS = {
  en: {
    user: 'User',
    bot: (model) => model,
    file: 'File',
    reasoning: 'Reasoning',
    showMore: 'Show more',
    showLess: 'Show less',
  },
  ja: {
    user: 'ユーザー',
    bot: (model) => model,
    file: 'ファイル',
    reasoning: '理由付け',
    showMore: 'もっと見る',
    showLess: '閉じる',
  }
};

/**
 * ChatBubble renders a single chat message with collapse/expand behavior.
 * Props:
 *  - type: 'user' | 'bot'
 *  - text: string
 */
export default function ChatBubble({ type, text, modelName = '', uiLanguage = 'en', onFileClick }) {
  const [expanded, setExpanded] = useState(false);

  // Determine label and display text, handling JSON structures
  let labelKey = type;
  let displayText = text;
  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj === 'object') {
      if (obj.type === 'message' && Array.isArray(obj.content)) {
        labelKey = 'user';
        const c = obj.content.find((it) => it.type === 'input_text' && it.text);
        if (c) displayText = c.text;
      } else if (UI_STRINGS[uiLanguage]?.[obj.type]) {
        labelKey = obj.type;
        if (obj.type === 'reasoning') {
          displayText = Array.isArray(obj.summary) ? obj.summary.join('\n') : displayText;
        } else if (obj.type === 'file') {
          displayText = obj.content || displayText;
        }
      }
    }
  } catch (e) {
    // not JSON, use raw text
  }
  // Determine if displayText should be truncated: more than 5 lines
  const displayLines = displayText.split('\n').length;
  const shouldTruncate = displayLines > 5;
  return (
    <SlideFade in offsetY="10px">
      <Box
        alignSelf={type === 'user' ? 'flex-end' : 'flex-start'}
        bg={type === 'user' ? 'blue.500' : 'gray.200'}
        color={type === 'user' ? 'white' : 'black'}
        px={3}
        py={2}
        borderRadius="md"
        maxW="80%"
        whiteSpace="pre-wrap"
      >
        {/* Label at top of bubble */}
        {(() => {
          const langMap = UI_STRINGS[uiLanguage] || UI_STRINGS.en;
          let labelText = '';
          switch (labelKey) {
            case 'user':
              labelText = langMap.user;
              break;
            case 'bot':
              labelText = typeof langMap.bot === 'function'
                ? langMap.bot(modelName)
                : langMap.bot;
              break;
            case 'reasoning':
              labelText = langMap.reasoning;
              break;
            default:
              labelText = langMap.file;
          }
          return (
            <Text fontSize="xs" fontWeight="bold" mb={1}>
              {labelText}:
            </Text>
          );
        })()}
        {labelKey === 'file' && onFileClick ? (
          <Text
            as="a"
            noOfLines={expanded ? undefined : 5}
            color="blue.500"
            cursor="pointer"
            onClick={() => onFileClick(displayText)}
          >
            {displayText}
          </Text>
        ) : (
          <Text noOfLines={expanded ? undefined : 5}>
            {displayText}
          </Text>
        )}
        {shouldTruncate && (
          <Button
            size="xs"
            variant="link"
            color={type === 'user' ? 'whiteAlpha.800' : 'blue.600'}
            mt={1}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded
              ? (UI_STRINGS[uiLanguage] || UI_STRINGS.en).showLess
              : (UI_STRINGS[uiLanguage] || UI_STRINGS.en).showMore}
          </Button>
        )}
      </Box>
    </SlideFade>
  );
}