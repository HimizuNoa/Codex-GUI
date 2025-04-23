module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest'
  },
  // Enable coverage collection across source files
  collectCoverage: true,
  collectCoverageFrom: [
    'renderer/src/**/*.{js,jsx}',
    'renderer/src/utils/**/*.js',
    'main/**/*.js'
  ],
  // Use default file extensions and test matching patterns
  // Ignore tests in vendor directory (e.g., codex-cli tests written in TSX)
  testPathIgnorePatterns: ['<rootDir>/vendor/'],
  // Use V8 coverage provider to avoid babel-plugin-istanbul errors
  coverageProvider: 'v8',
  // Exclude node_modules from coverage
  coveragePathIgnorePatterns: ['/node_modules/'],
};