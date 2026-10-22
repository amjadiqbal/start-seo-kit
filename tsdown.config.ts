import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/commerce.ts', 'src/og.ts'],
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  clean: true,
  deps: { neverBundle: ['satori', '@resvg/resvg-wasm', /^node:/] },
})
