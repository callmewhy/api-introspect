import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts', './src/client.ts', './src/cli/index.ts'],
  outDir: './dist',
  format: ['es', 'cjs'],
  dts: true,
  unbundle: true,
  target: 'node12',
  sourcemap: false,
  outExtensions(context) {
    if (context.format === 'es') {
      return {
        js: '.mjs',
      }
    }
    if (context.format === 'cjs') {
      return {
        js: '.cjs',
      }
    }
  },
})
