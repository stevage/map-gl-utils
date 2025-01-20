/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
    testEnvironment: 'node',
    transform: {
        '^.+.tsx?$': ['ts-jest', { diagnostics: false }],
    },
    roots: ['<rootDir>/src'],
    testMatch: ['**/index.test.ts'],
};
