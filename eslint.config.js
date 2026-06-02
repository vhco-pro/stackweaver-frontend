// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default [
  { ignores: ['dist', '**/src/pages/Ansible/JobDetail.tsx'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Type-aware linting for TypeScript files (catches build errors)
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.app.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // eslint-plugin-react-hooks v7.1 enables the React Compiler rule set in its
      // `recommended` config. These flag legitimate-but-non-ideal existing patterns
      // (setState in effects, ref access during render, mutation, etc.) across the
      // codebase. Set to 'warn' during incremental migration so they're visible
      // without blocking CI — mirrors the `no-restricted-imports` useEffect ban below.
      // Track remediation in docs/internal/analysis/react-compiler-lint-migration.md.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/static-components': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Ban direct useEffect imports — use useMountEffect() or React Query instead
      // Set to 'warn' during migration; upgrade to 'error' after Phase 3 (data-fetching migration)
      // See docs/internal/analysis/useeffect-audit-and-ban-proposal.md
      'no-restricted-imports': ['warn', {
        paths: [{
          name: 'react',
          importNames: ['useEffect'],
          message: 'Direct useEffect is banned. Use useMountEffect() from @/hooks/useMountEffect for mount effects, or React Query for data fetching. See docs/internal/analysis/useeffect-audit-and-ban-proposal.md',
        }],
      }],
    },
  },
  // Disable no-explicit-any for files that intentionally use 'any' for JSON:API attributes
  // These files work with dynamic JSON:API structures where attributes can be any type
  {
    files: ['**/api/client.ts', '**/utils/jsonapi.ts', '**/utils/ansible-jsonapi.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Disable no-explicit-any and unsafe-* rules for WorkspaceDetail.tsx which works with dynamic Terraform data structures
  // Terraform plan outputs and state data have highly dynamic structures that are difficult to type strictly
  {
    files: ['**/pages/WorkspaceDetail.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  // Disable unsafe-* rules for JSON:API utility files and API client which work with dynamic JSON:API structures
  // These files intentionally use 'any' to handle the dynamic nature of JSON:API attributes
  {
    files: ['**/api/client.ts', '**/utils/jsonapi.ts', '**/utils/ansible-jsonapi.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  // Relax type-safety rules for test files — test assertions on `any`-returning utilities (flattenResource, etc.)
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      'no-restricted-imports': 'off',
    },
  },
  // Allow require() in config files (tailwind.config.js needs it for Tailwind plugins)
  {
    files: ['**/*.config.js', '**/*.config.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off',
    },
  },
  // Allow direct useEffect in hooks, contexts, animation primitives, shadcn/ui, and
  // components that legitimately need useEffect for DOM manipulation (scroll, animation,
  // terminal rendering, mermaid diagrams, etc.)
  {
    files: [
      '**/hooks/**', '**/contexts/**', '**/animate-ui/**', '**/components/ui/**',
      '**/lib/get-strict-context.tsx', '**/types/**',
      '**/components/runs/**',          // Terminal output, collapsible sections, phase animations
      '**/components/docs/**',          // Mermaid diagrams, scroll spy, code explorer async loading
      '**/components/layout/**',        // Responsive sidebar
      '**/components/notifications/**', // Auto-dismiss timer
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
]
