const CODE = /\.(js|mjs|cjs|ts)$/;
const IGNORE_FILES = /(^|\/)(\.gitignore|\.prettierignore|\.oxlintrc\.json)$/;
const quote = (file) => `"${file}"`;

export default {
  // Formats what is staged, then lints the staged code. oxlint is told not to fail
  // when every staged file is in its ignore list - it exits 1 otherwise.
  '*.{js,mjs,cjs,ts,json,md,yml,yaml}': (files) => {
    const code = files.filter((f) => CODE.test(f));
    return [
      `prettier --log-level warn --write ${files.map(quote).join(' ')}`,
      ...(code.length
        ? [
            `oxlint --type-aware --no-error-on-unmatched-pattern ${code.map(quote).join(' ')}`,
          ]
        : []),
    ];
  },
  // A changed ignore list must stay in step with .gitignore.
  '{.gitignore,.prettierignore,.oxlintrc.json}': (files) =>
    files.some((f) => IGNORE_FILES.test(f))
      ? ['node scripts/sync-ignores.mjs --check']
      : [],
};
