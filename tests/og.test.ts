import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { createOgImageHandler, ogCard, renderOgImage } from '../src/og'

const require = createRequire(import.meta.url)
const font = async () => [
  { name: 'Inter', weight: 700 as const, data: await readFile(require.resolve('@fontsource/inter/files/inter-latin-700-normal.woff')) },
]

describe('og image', () => {
  it('renders the default card to an SVG', async () => {
    const svg = await renderOgImage(ogCard({ title: 'Hello', description: 'World', eyebrow: 'Acme', footer: 'acme.dev', fontFamily: 'Inter' }), {
      fonts: await font(),
      format: 'svg',
    })
    expect(typeof svg).toBe('string')
    expect(svg).toMatch(/^<svg[^>]+width="1200"[^>]+height="630"/)
  })

  it('serves a PNG from a handler, loading the wasm from node_modules', async () => {
    const handler = createOgImageHandler({
      fonts: font,
      render: ({ params }) => {
        const slug = (params as { slug?: string }).slug
        return slug === 'missing' ? null : ogCard({ title: `Post ${slug}`, fontFamily: 'Inter' })
      },
    })
    const res = await handler({ request: new Request('https://acme.dev/og/hello'), params: { slug: 'hello' } })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toBe('public, max-age=86400, immutable')
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(Array.from(bytes.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    // PNG IHDR: width and height
    const view = new DataView(bytes.buffer)
    expect(view.getUint32(16)).toBe(1200)
    expect(view.getUint32(20)).toBe(630)

    const missing = await handler({ request: new Request('https://acme.dev/og/missing'), params: { slug: 'missing' } })
    expect(missing.status).toBe(404)
  })
})
