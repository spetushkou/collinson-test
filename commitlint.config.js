// Commit message rules, enforced by the `commit-msg` hook (`.husky/commit-msg`).
//
// The repo's type set uses `feature` where @commitlint/config-conventional ships
// `feat`, so `type-enum` is overridden - the shared config alone would reject every
// feature commit.
const TYPES = [
  'build',
  'chore',
  'ci',
  'docs',
  'feature',
  'fix',
  'perf',
  'refactor',
  'revert',
  'style',
  'test',
];

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', TYPES],
    // Longer than the shared config's 100 so `type(scope): subject` fits on one line.
    'header-max-length': [2, 'always', 120],
    // A scope or subject naming a symbol or file keeps its real casing
    // (`fix(HealthModule): ...`), so case rules are off.
    'scope-case': [0],
    'subject-case': [0],
  },
};
