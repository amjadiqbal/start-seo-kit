import { absoluteUrl, normalizeSiteUrl, type TrailingSlash } from './url'

type Awaitable<T> = T | Promise<T>

/** The context a TanStack Start server route handler receives (only the parts used here). */
export interface HandlerContext {
  request: Request
  params?: Record<string, string | undefined> | object
}
export type ServerHandler = (ctx: HandlerContext) => Promise<Response>

export type ChangeFreq = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'

export interface SitemapImage {
  url: string
  title?: string
  caption?: string
}

export interface SitemapEntry {
  /** Page path (`/posts/hello`) or absolute URL. */
  loc: string
  lastmod?: string | Date
  changefreq?: ChangeFreq
  /** 0.0 to 1.0. */
  priority?: number
  /** hreflang alternates, e.g. `{ en: '/en/about', de: '/de/about', 'x-default': '/about' }`. */
  alternates?: Record<string, string>
  images?: Array<string | SitemapImage>
}

export interface UrlOptions {
  siteUrl: string
  /** Match your router's `trailingSlash` option. Default `never`. */
  trailingSlash?: TrailingSlash
}

/** Render a `<urlset>` sitemap. */
export function sitemapXml(entries: Iterable<SitemapEntry>, options: UrlOptions): string {
  const site = normalizeSiteUrl(options.siteUrl)
  const slash = options.trailingSlash ?? 'never'
  const list = [...entries]
  const hasAlternates = list.some((e) => e.alternates && Object.keys(e.alternates).length)
  const hasImages = list.some((e) => e.images?.length)
  const ns = [
    'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    hasAlternates ? 'xmlns:xhtml="http://www.w3.org/1999/xhtml"' : '',
    hasImages ? 'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : '',
  ].filter(Boolean)
  const out = ['<?xml version="1.0" encoding="UTF-8"?>', `<urlset ${ns.join(' ')}>`]
  for (const e of list) {
    out.push('  <url>', `    <loc>${xml(absoluteUrl(site, e.loc, slash))}</loc>`)
    if (e.lastmod) out.push(`    <lastmod>${xml(isoDate(e.lastmod))}</lastmod>`)
    if (e.changefreq) out.push(`    <changefreq>${e.changefreq}</changefreq>`)
    if (e.priority !== undefined) out.push(`    <priority>${clampPriority(e.priority)}</priority>`)
    for (const [lang, href] of Object.entries(e.alternates ?? {})) {
      out.push(`    <xhtml:link rel="alternate" hreflang="${xml(lang)}" href="${xml(absoluteUrl(site, href, slash))}"/>`)
    }
    for (const image of e.images ?? []) {
      const img = typeof image === 'string' ? { url: image } : image
      out.push('    <image:image>', `      <image:loc>${xml(absoluteUrl(site, img.url))}</image:loc>`)
      if (img.title) out.push(`      <image:title>${xml(img.title)}</image:title>`)
      if (img.caption) out.push(`      <image:caption>${xml(img.caption)}</image:caption>`)
      out.push('    </image:image>')
    }
    out.push('  </url>')
  }
  out.push('</urlset>', '')
  return out.join('\n')
}

export interface SitemapIndexEntry {
  /** Path or absolute URL of a child sitemap. */
  loc: string
  lastmod?: string | Date
}

/** Render a `<sitemapindex>`. */
export function sitemapIndexXml(sitemaps: Iterable<SitemapIndexEntry>, options: UrlOptions): string {
  const site = normalizeSiteUrl(options.siteUrl)
  const out = ['<?xml version="1.0" encoding="UTF-8"?>', '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
  for (const s of sitemaps) {
    out.push('  <sitemap>', `    <loc>${xml(absoluteUrl(site, s.loc))}</loc>`)
    if (s.lastmod) out.push(`    <lastmod>${xml(isoDate(s.lastmod))}</lastmod>`)
    out.push('  </sitemap>')
  }
  out.push('</sitemapindex>', '')
  return out.join('\n')
}

/**
 * Where the URLs of one sitemap section come from:
 * - an array of entries,
 * - a function returning them (sync or async, e.g. a database query), or
 * - a paginated source with `count()` and `entries({ offset, limit })` for very large sets,
 *   so the index never loads every row.
 */
export type SitemapSource =
  | SitemapEntry[]
  | (() => Awaitable<SitemapEntry[]>)
  | {
      count: () => Awaitable<number>
      entries: (range: { offset: number; limit: number }) => Awaitable<SitemapEntry[]>
      lastmod?: () => Awaitable<string | Date | undefined>
    }

export interface CreateSitemapOptions extends UrlOptions {
  /** Named sections, e.g. `{ pages: routesFromTree(routeTree), posts: () => db.posts.list() }`. Names: letters, digits, `_`, `-`. */
  sources: Record<string, SitemapSource>
  /** URLs per child sitemap. Default 50,000 (the protocol limit). */
  maxUrlsPerSitemap?: number
  /**
   * `auto` (default): `/sitemap.xml` is a plain urlset while everything fits in one file, and a sitemap index otherwise.
   * `true`: always an index. `false`: always one urlset (throws past `maxUrlsPerSitemap`).
   */
  index?: 'auto' | boolean
  /** Path the child sitemaps are served under. Default `/sitemaps` (route file `src/routes/sitemaps/$name.ts`). */
  basePath?: string
  /** `Cache-Control` header. Default `public, max-age=3600`. */
  cacheControl?: string
}

export interface SitemapHandlers {
  /** `GET` handler for `/sitemap.xml`. */
  index: ServerHandler
  /** `GET` handler for `/sitemaps/$name` (child sitemaps such as `/sitemaps/posts-1.xml`). */
  page: ServerHandler
  /** Every entry from every source (useful for tests and prerendering). */
  entries(): Promise<SitemapEntry[]>
}

/** Dynamic sitemap (and sitemap index for large sites) served from TanStack Start server routes. */
export function createSitemap(options: CreateSitemapOptions): SitemapHandlers {
  const max = options.maxUrlsPerSitemap ?? 50_000
  const basePath = (options.basePath ?? '/sitemaps').replace(/\/+$/, '')
  const headers = {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': options.cacheControl ?? 'public, max-age=3600',
  }
  for (const name of Object.keys(options.sources)) {
    if (!/^[\w-]+$/.test(name)) throw new TypeError(`start-seo-kit: invalid sitemap source name "${name}"`)
  }

  const count = async (src: SitemapSource) =>
    Array.isArray(src) ? src.length : typeof src === 'function' ? (await src()).length : await src.count()
  const slice = async (src: SitemapSource, offset: number, limit: number) =>
    Array.isArray(src)
      ? src.slice(offset, offset + limit)
      : typeof src === 'function'
        ? (await src()).slice(offset, offset + limit)
        : await src.entries({ offset, limit })
  const all = async () => {
    const out: SitemapEntry[] = []
    for (const src of Object.values(options.sources)) out.push(...(await slice(src, 0, Number.MAX_SAFE_INTEGER)))
    return out
  }

  return {
    entries: all,

    async index() {
      const counts = await Promise.all(Object.entries(options.sources).map(async ([n, s]) => [n, await count(s), s] as const))
      const total = counts.reduce((sum, [, c]) => sum + c, 0)
      const useIndex = options.index === true || (options.index !== false && total > max)
      if (!useIndex) {
        if (total > max) throw new RangeError(`start-seo-kit: ${total} URLs exceed maxUrlsPerSitemap (${max}); enable index`)
        return new Response(sitemapXml(await all(), options), { headers })
      }
      const children: SitemapIndexEntry[] = []
      for (const [name, c, src] of counts) {
        const lastmod = !Array.isArray(src) && typeof src === 'object' && src.lastmod ? await src.lastmod() : undefined
        for (let i = 0; i < Math.max(1, Math.ceil(c / max)); i++) {
          children.push({ loc: `${basePath}/${name}-${i + 1}.xml`, lastmod })
        }
      }
      return new Response(sitemapIndexXml(children, options), { headers })
    },

    async page({ request, params }) {
      const fromParams = (params as Record<string, string | undefined> | undefined)?.name
      const name = fromParams ?? new URL(request.url).pathname.split('/').pop() ?? ''
      const match = /^([\w-]+)-(\d+)\.xml$/.exec(name)
      const src = match ? options.sources[match[1]!] : undefined
      const n = match ? Number(match[2]) : 0
      if (!src || n < 1) return new Response('Not Found', { status: 404 })
      const entries = await slice(src, (n - 1) * max, max)
      if (!entries.length && n > 1) return new Response('Not Found', { status: 404 })
      return new Response(sitemapXml(entries, options), { headers })
    },
  }
}

/** Route-tree node shape (TanStack Router `Route`), reduced to what `routesFromTree` reads. */
interface TreeRoute {
  id?: string
  fullPath?: string
  isRoot?: boolean
  options?: { component?: unknown; server?: unknown; staticData?: { sitemap?: false | Partial<Omit<SitemapEntry, 'loc'>> } }
  children?: Record<string, TreeRoute> | TreeRoute[]
}

export interface RoutesFromTreeOptions {
  /** Paths to leave out: exact strings, or RegExps tested against the path. */
  exclude?: Array<string | RegExp>
  /** Defaults for every entry (e.g. `{ changefreq: 'weekly' }`). */
  defaults?: Partial<Omit<SitemapEntry, 'loc'>>
}

/**
 * Collect the static (parameter-free) page paths of your TanStack Router route tree.
 * Dynamic routes (`$id`, `$`) are skipped: list them from your data in another source.
 * Skipped too: server-only routes, paths with a file extension (`/sitemap.xml`), and routes with
 * `staticData: { sitemap: false }`. Per-route `staticData.sitemap` values (priority, changefreq) are applied.
 */
export function routesFromTree(routeTree: unknown, options: RoutesFromTreeOptions = {}): SitemapEntry[] {
  if (!routeTree || typeof routeTree !== 'object') {
    throw new TypeError(
      'start-seo-kit: routesFromTree() got no route tree. If your sitemap module imports routeTree.gen and is itself ' +
        'imported by a route, that is a circular import: make the source lazy, e.g. `pages: () => routesFromTree(routeTree)`.',
    )
  }
  const seen = new Map<string, SitemapEntry>()
  const visit = (route: TreeRoute) => {
    const kids = route.children ? Object.values(route.children) : []
    const path = route.fullPath
    const opts = route.options ?? {}
    const sitemap = opts.staticData?.sitemap
    const serverOnly = opts.server !== undefined && opts.component === undefined
    if (path !== undefined && !route.isRoot && sitemap !== false && !serverOnly) {
      const normalized = path === '/' ? '/' : path.replace(/\/+$/, '') || '/'
      const isStatic = !/(^|\/)(\$|\{)/.test(normalized) && !/\.[a-z0-9]+$/i.test(normalized)
      const excluded = options.exclude?.some((x) => (typeof x === 'string' ? x === normalized : x.test(normalized)))
      if (isStatic && !excluded && !seen.has(normalized)) {
        seen.set(normalized, { ...options.defaults, ...sitemap, loc: normalized })
      }
    }
    for (const kid of kids) visit(kid)
  }
  visit(routeTree as TreeRoute)
  return [...seen.values()]
}

function clampPriority(p: number): string {
  return String(Math.round(Math.min(1, Math.max(0, p)) * 100) / 100)
}

function isoDate(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value
}

export function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
