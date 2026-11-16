// The ESLint block for code that must repeat. It bans clocks, timers and
// random numbers that the kit does not control.
const bannedNames = ['Date', 'performance', 'setTimeout', 'setInterval', 'requestAnimationFrame'];

export const ruleCodeFiles = [
  'kit/core/**/*.ts',
  'kit/solver/**/*.ts',
  'kit/conformance/**/*.ts',
  'apps/*/src/rules/**/*.ts',
];

export function ruleCodeBlock(files = ruleCodeFiles) {
  return {
    files,
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Math.random is not allowed in rule code. Use the kit random numbers.',
        },
      ],
      'no-restricted-globals': [
        'error',
        ...bannedNames.map((name) => ({
          name,
          message: `${name} is not allowed in rule code. A replay must give the same result each time.`,
        })),
      ],
    },
  };
}
