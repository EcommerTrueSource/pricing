module.exports = {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    testEnvironment: 'node',
    testRegex: '.integration.spec.ts$',
    transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    setupFiles: ['<rootDir>/setup.ts'],
    globalSetup: '<rootDir>/setup.ts',
    globalTeardown: '<rootDir>/teardown.ts',
    testTimeout: 30000,
};
