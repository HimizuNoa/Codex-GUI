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
};