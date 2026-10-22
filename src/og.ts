import type { HandlerContext, ServerHandler } from './sitemap'

type Awaitable<T> = T | Promise<T>

/** A satori element: a React element (JSX) or a plain `{ type, props }` object tree. */
export type OgElement = { type: unknown; props: unknown } | string

export interface OgFont {
  name: string
  /** Font file contents (TTF, OTF or WOFF; not WOFF2). */
  data: ArrayBuffer | Uint8Array
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
  style?: 'normal' | 'italic'
}

/** What `@resvg/resvg-wasm`'s `initWasm` accepts: the `.wasm` bytes, a `Response`, a `WebAssembly.Module` or a URL. */
export type WasmSource = ArrayBuffer | Uint8Array | Response | WebAssembly.Module | URL | string

export interface RenderOgOptions {
  fonts: OgFont[]
  /** Default 1200. */
  width?: number
  /** Default 630. */
  height?: number
  /** `png` (default, needs `@resvg/resvg-wasm`) or `svg` (satori only). */
  format?: 'png' | 'svg'
  /**
   * The resvg `.wasm` for PNG output. On Node it is read from `node_modules` when left out.
   * On edge runtimes (Workers and similar) pass it yourself.
   */
  wasm?: WasmSource | (() => Awaitable<WasmSource>)
}

let resvgReady: Promise<typeof import('@resvg/resvg-wasm')> | undefined

async function loadResvg(wasm: RenderOgOptions['wasm']) {
  resvgReady ??= (async () => {
    const resvg = await import('@resvg/resvg-wasm')
    const source = typeof wasm === 'function' ? await wasm() : (wasm ?? (await nodeWasm()))
    await resvg.initWasm(source as Parameters<typeof resvg.initWasm>[0])
    return resvg
  })().catch((error: unknown) => {
    resvgReady = undefined
    throw error
  })
  return resvgReady
}

async function nodeWasm(): Promise<Uint8Array> {
  try {
    const { readFile } = await import('node:fs/promises')
    const { createRequire } = await import('node:module')
    const require = createRequire(import.meta.url)
    return await readFile(require.resolve('@resvg/resvg-wasm/index_bg.wasm'))
  } catch (error) {
    throw new Error(
      'start-seo-kit/og: could not load @resvg/resvg-wasm/index_bg.wasm. Install @resvg/resvg-wasm, ' +
        'or pass the wasm option (required on edge runtimes), or use format: "svg".',
      { cause: error },
    )
  }
}

/** Render an element to PNG bytes (or an SVG string with `format: 'svg'`). */
export async function renderOgImage(element: OgElement, options: RenderOgOptions): Promise<Uint8Array | string> {
  const width = options.width ?? 1200
  const height = options.height ?? 630
  const { default: satori } = await import('satori')
  const svg = await satori(element as Parameters<typeof satori>[0], {
    width,
    height,
    fonts: options.fonts.map((f) => ({ ...f, data: toArrayBuffer(f.data) })),
  })
  if (options.format === 'svg') return svg
  const { Resvg } = await loadResvg(options.wasm)
  const rendered = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render()
  try {
    return rendered.asPng()
  } finally {
    rendered.free()
  }
}

export interface CreateOgImageOptions extends Omit<RenderOgOptions, 'fonts'> {
  /** Fonts, or a function that loads them once (cached after the first request). */
  fonts: OgFont[] | (() => Awaitable<OgFont[]>)
  /** Build the image for a request. Return `null` for a 404. */
  render: (ctx: HandlerContext & { url: URL }) => Awaitable<OgElement | null>
  /** `Cache-Control` header. Default `public, max-age=86400, immutable`. */
  cacheControl?: string
}

/**
 * `GET` handler for an Open Graph image server route, e.g. `src/routes/og/$slug.ts`.
 * Point `seo({ image: '/og/my-post' })` at it.
 */
export function createOgImageHandler(options: CreateOgImageOptions): ServerHandler {
  let fonts: Promise<OgFont[]> | undefined
  return async (ctx) => {
    fonts ??= Promise.resolve(typeof options.fonts === 'function' ? options.fonts() : options.fonts).catch(
      (error: unknown) => {
        fonts = undefined
        throw error
      },
    )
    const element = await options.render({ ...ctx, url: new URL(ctx.request.url) })
    if (element === null) return new Response('Not Found', { status: 404 })
    const body = await renderOgImage(element, { ...options, fonts: await fonts })
    return new Response(typeof body === 'string' ? body : (body as Uint8Array<ArrayBuffer>), {
      headers: {
        'Content-Type': typeof body === 'string' ? 'image/svg+xml' : 'image/png',
        'Cache-Control': options.cacheControl ?? 'public, max-age=86400, immutable',
      },
    })
  }
}

export interface OgCardInput {
  title: string
  description?: string
  /** Small label above the title, e.g. the site name. */
  eyebrow?: string
  /** Footer text, e.g. the domain. */
  footer?: string
  /** Font family name as registered in `fonts`. */
  fontFamily?: string
  background?: string
  foreground?: string
  muted?: string
  accent?: string
}

/** A ready-made 1200x630 card (title, description, label, footer) as a plain element tree; no JSX needed. */
export function ogCard(input: OgCardInput): OgElement {
  const fg = input.foreground ?? '#F8FAFC'
  const muted = input.muted ?? '#94A3B8'
  const accent = input.accent ?? '#34D399'
  const el = (style: Record<string, unknown>, children: unknown) => ({ type: 'div', props: { style, children } })
  const titleSize = input.title.length > 60 ? 56 : input.title.length > 34 ? 68 : 80
  return el(
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '72px 80px',
      background: input.background ?? '#0B1220',
      color: fg,
      fontFamily: input.fontFamily,
    },
    [
      el({ display: 'flex', flexDirection: 'column', gap: 24 }, [
        el({ display: 'flex', width: 96, height: 8, borderRadius: 4, background: accent }, []),
        input.eyebrow ? el({ display: 'flex', fontSize: 30, color: accent, fontWeight: 600 }, input.eyebrow) : null,
        el({ display: 'flex', fontSize: titleSize, fontWeight: 700, lineHeight: 1.1 }, input.title),
        input.description ? el({ display: 'flex', fontSize: 32, color: muted, lineHeight: 1.35 }, input.description) : null,
      ].filter(Boolean)),
      input.footer ? el({ display: 'flex', fontSize: 26, color: muted }, input.footer) : el({ display: 'flex' }, []),
    ],
  )
}

function toArrayBuffer(data: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
}
