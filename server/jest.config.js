module.exports = {
  testEnvironment: 'node',
  verbose: true,
  forceExit: true,
  detectOpenHandles: false,
  testMatch: ['**/tests/**/*.test.js'],
  // Suppress console output during tests
  setupFilesAfterEnv: ['./tests/jest.setup.js']
};
