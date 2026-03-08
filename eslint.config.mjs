import { defineConfig } from 'eslint-config-hyoban'

export default defineConfig({
  ignores: [
    '**/dist/**',
    '**/node_modules/**',
    '**/build/**',
    '**/coverage/**',
  ],
  rules: {
    'no-console': 'off',
  },
})
