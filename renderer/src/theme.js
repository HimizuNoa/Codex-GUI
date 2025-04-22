// Custom Chakra UI theme configuration
import { extendTheme } from '@chakra-ui/react';

// Color mode config: use system preference initially, allow toggle
const config = {
  initialColorMode: 'system',
  useSystemColorMode: true,
};

const theme = extendTheme({ config });
export default theme;