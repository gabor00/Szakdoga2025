const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  /* Add any custom config here */
  testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
  transform: {
    '^.+\\.(ts|js|html)$': 'ts-jest'
  },
  resolver: '@nx/jest/plugins/resolver',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageReporters: ['html', 'lcov', 'text']
};
