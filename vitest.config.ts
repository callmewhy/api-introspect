import path from 'node:path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@api-introspect/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
      '@api-introspect/trpc': path.resolve(__dirname, 'packages/trpc/src/index.ts'),
      '@api-introspect/fastify': path.resolve(__dirname, 'packages/fastify/src/index.ts'),
      '@api-introspect/openapi': path.resolve(__dirname, 'packages/openapi/src/index.ts'),
    },
  },
})
