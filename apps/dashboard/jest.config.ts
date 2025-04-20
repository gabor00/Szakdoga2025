import type { Config } from 'jest';

const config: Config = {
  displayName: 'dashboard',
  preset: '../../jest.preset.ts',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/apps/dashboard',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts']
};

export default config;
