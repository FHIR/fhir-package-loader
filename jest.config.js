module.exports = {
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  },
  moduleFileExtensions: ['js', 'ts'],
  testMatch: ['**/test/**/*.test.(ts|js)'],
  testEnvironment: 'node',
  setupFilesAfterEnv: ['jest-extended/all'],
  coveragePathIgnorePatterns: ['test'],
  preset: 'ts-jest'
};
