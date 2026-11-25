// ESLint flat config (2026-10-03), `npm run lint`: every file of the app's own code — src/ and,
// since 2026-10-30, the config files and scripts/ beside it. hub/ has its own ESLint (run by its
// npm test); android/, ios/, public/ and dist/ are generated or built. Vite's react-ts template
// rules, plus two type-aware promise rules: this app relies on fire-and-forget calls (OtaKit,
// retries) and a startup guard that treats any unhandled rejection as fatal,
// so an unmarked floating promise is worth a lint error. Async onClick
// handlers are an accepted React pattern, hence attributes: false.
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'hub', 'android', 'ios', 'public', 'node_modules'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: { project: './tsconfig.app.json', tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      // The plugin's full recommended set: the two classic hooks rules plus the React Compiler's
      // rules (no state set inside effects, no components created while rendering…). We don't run
      // the compiler; the rules keep the code in the shape React recommends (§15av).
      ...reactHooks.configs['recommended-latest'].rules,
      // The two providers also export their hooks; fast refresh falls back to
      // a full reload for those two files only, which is acceptable.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true, allowExportNames: ['useAppState', 'useDataCache'] }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      // One icon file: components take icons from src/lib/icons.ts, which maps the meanings
      // decided in hub/src/icons.js.
      'no-restricted-imports': ['error', { paths: [{ name: 'lucide-react', message: 'Take icons from @/lib/icons (meanings: hub/src/icons.js).' }] }],
    },
  },
  { files: ['src/lib/icons.ts', 'src/lib/iconsLoader.ts'], rules: { 'no-restricted-imports': 'off' } },
  // The configs read by Vite and Capacitor, type-checked by tsconfig.node.json: the same promise rules.
  {
    files: ['vite.config.ts', 'capacitor.config.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: globals.node,
      parserOptions: { project: './tsconfig.node.json', tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  // Tailwind's config: in no tsconfig, so without the type-aware rules.
  {
    files: ['tailwind.config.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  // Plain ES modules run by Node: the other configs and scripts/.
  {
    files: ['*.js', 'scripts/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: globals.node },
  },
)
