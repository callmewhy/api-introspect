import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  outDir: './dist',
  format: ['es', 'cjs'],
  target: 'node12',
  sourcemap: false,
  dts: true,
  outExtensions(context) {
    if (context.format === 'es')
      return { js: '.mjs' }
    if (context.format === 'cjs')
      return { js: '.cjs' }
  },
})
