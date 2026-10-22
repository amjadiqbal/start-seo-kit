import { describe, expect, it } from 'vitest'
import { createRobotsHandler, createSitemap, robotsTxt, routesFromTree, sitemapIndexXml, sitemapXml } from '../src'

const req = (url: string) => ({ request: new Request(url) })

describe('sitemapXml', () => {
  it('renders entries with escaping, alternates and images', () => {
    const out = sitemapXml(
      [
        { loc: '/', changefreq: 'daily', priority: 1 },
        {
          loc: '/search?q=a&b=<c>',
          lastmod: new Date('2026-10-01T00:00:00Z'),
          priority: 0.85,
          alternates: { de: '/de/x' },
          images: ['/a.png', { url: 'https://cdn.acme.dev/b.png', title: 'B & C' }],
        },
      ],
      { siteUrl: 'https://acme.dev' },
    )
    expect(out).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"')
    expect(out).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"')
    expect(out).toContain('<loc>https://acme.dev/</loc>')
    expect(out).toContain('<priority>1</priority>')
    expect(out).toContain('<loc>https://acme.dev/search?q=a&amp;b=&lt;c&gt;</loc>')
    expect(out).toContain('<lastmod>2026-10-01T00:00:00.000Z</lastmod>')
    expect(out).toContain('<priority>0.85</priority>')
    expect(out).toContain('<xhtml:link rel="alternate" hreflang="de" href="https://acme.dev/de/x"/>')
    expect(out).toContain('<image:loc>https://acme.dev/a.png</image:loc>')
    expect(out).toContain('<image:title>B &amp; C</image:title>')
  })

  it('leaves out unused namespaces and applies trailing slashes', () => {
    const out = sitemapXml([{ loc: '/docs' }], { siteUrl: 'https://acme.dev', trailingSlash: 'always' })
    expect(out).not.toContain('xmlns:xhtml')
    expect(out).toContain('<loc>https://acme.dev/docs/</loc>')
  })

  it('renders an index', () => {
    const out = sitemapIndexXml([{ loc: '/sitemaps/posts-1.xml', lastmod: '2026-10-01' }], { siteUrl: 'https://acme.dev' })
    expect(out).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(out).toContain('<loc>https://acme.dev/sitemaps/posts-1.xml</loc>')
    expect(out).toContain('<lastmod>2026-10-01</lastmod>')
  })
})

describe('createSitemap', () => {
  const posts = Array.from({ length: 5 }, (_, i) => ({ loc: `/posts/${i + 1}` }))

  it('serves one urlset while everything fits', async () => {
    const s = createSitemap({ siteUrl: 'https://acme.dev', sources: { pages: [{ loc: '/' }], posts: async () => posts } })
    const res = await s.index(req('https://acme.dev/sitemap.xml'))
    expect(res.headers.get('content-type')).toBe('application/xml; charset=utf-8')
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600')
    const body = await res.text()
    expect(body).toContain('<urlset')
    expect(body.match(/<url>/g)).toHaveLength(6)
    expect(await s.entries()).toHaveLength(6)
  })

  it('switches to an index with chunked child sitemaps when it does not fit', async () => {
    const s = createSitemap({
      siteUrl: 'https://acme.dev',
      maxUrlsPerSitemap: 2,
      sources: {
        pages: [{ loc: '/' }],
        posts: {
          count: () => posts.length,
          entries: ({ offset, limit }) => posts.slice(offset, offset + limit),
          lastmod: () => '2026-10-20',
        },
      },
    })
    const index = await (await s.index(req('https://acme.dev/sitemap.xml'))).text()
    expect(index).toContain('<sitemapindex')
    for (const name of ['pages-1', 'posts-1', 'posts-2', 'posts-3']) {
      expect(index).toContain(`<loc>https://acme.dev/sitemaps/${name}.xml</loc>`)
    }
    expect(index).not.toContain('posts-4')
    expect(index).toContain('<lastmod>2026-10-20</lastmod>')

    const page2 = await (await s.page({ ...req('https://acme.dev/sitemaps/posts-2.xml'), params: { name: 'posts-2.xml' } })).text()
    expect(page2).toContain('https://acme.dev/posts/3')
    expect(page2).toContain('https://acme.dev/posts/4')
    expect(page2).not.toContain('https://acme.dev/posts/5')

    // falls back to the URL when params are missing
    const page3 = await (await s.page(req('https://acme.dev/sitemaps/posts-3.xml'))).text()
    expect(page3).toContain('https://acme.dev/posts/5')

    expect((await s.page(req('https://acme.dev/sitemaps/posts-9.xml'))).status).toBe(404)
    expect((await s.page(req('https://acme.dev/sitemaps/nope-1.xml'))).status).toBe(404)
    expect((await s.page(req('https://acme.dev/sitemaps/posts.xml'))).status).toBe(404)
  })

  it('calls a function source once per request, and a paginated source only for its range', async () => {
    let calls = 0
    const ranges: Array<[number, number]> = []
    const s = createSitemap({
      siteUrl: 'https://acme.dev',
      maxUrlsPerSitemap: 2,
      sources: {
        posts: async () => {
          calls++
          return posts
        },
        big: {
          count: () => 1000,
          entries: ({ offset, limit }) => {
            ranges.push([offset, limit])
            return [{ loc: `/big/${offset}` }]
          },
        },
      },
    })
    await s.index(req('https://acme.dev/sitemap.xml'))
    expect(calls).toBe(1)
    expect(ranges).toEqual([])
    await s.page(req('https://acme.dev/sitemaps/big-3.xml'))
    expect(ranges).toEqual([[4, 2]])

    const small = createSitemap({ siteUrl: 'https://acme.dev', sources: { posts: async () => (calls++, posts) } })
    calls = 0
    await small.index(req('https://acme.dev/sitemap.xml'))
    expect(calls).toBe(1)
  })

  it('serves an empty urlset for page 1 of an empty source', async () => {
    const s = createSitemap({ siteUrl: 'https://acme.dev', index: true, sources: { posts: [] } })
    const res = await s.page(req('https://acme.dev/sitemaps/posts-1.xml'))
    expect(res.status).toBe(200)
    expect(await res.text()).not.toContain('<url>')
  })

  it('can force an index or refuse one', async () => {
    const forced = createSitemap({ siteUrl: 'https://acme.dev', index: true, sources: { pages: [{ loc: '/' }] } })
    expect(await (await forced.index(req('https://acme.dev/sitemap.xml'))).text()).toContain('<sitemapindex')
    const never = createSitemap({ siteUrl: 'https://acme.dev', index: false, maxUrlsPerSitemap: 1, sources: { posts } })
    await expect(never.index(req('https://acme.dev/sitemap.xml'))).rejects.toThrow(RangeError)
  })

  it('rejects bad source names', () => {
    expect(() => createSitemap({ siteUrl: 'https://acme.dev', sources: { 'a/b': [] } })).toThrow(/invalid/)
  })
})

describe('routesFromTree', () => {
  const route = (fullPath: string, options: Record<string, unknown> = { component: () => null }, children?: unknown[]) => ({
    fullPath,
    options,
    children,
  })
  const tree = {
    isRoot: true,
    fullPath: '/',
    options: { component: () => null },
    children: {
      index: route('/'),
      about: route('/about', { component: () => null, staticData: { sitemap: { priority: 0.8 } } }),
      posts: route('/posts', { component: () => null }, [route('/posts/'), route('/posts/$postId')]),
      secret: route('/admin', { component: () => null, staticData: { sitemap: false } }),
      api: route('/api/health', { server: { handlers: {} } }),
      xml: route('/sitemap.xml', { component: () => null }),
      splat: route('/files/$'),
      optional: route('/blog/{-$lang}'),
      draft: route('/drafts'),
    },
  }

  it('explains the circular-import case instead of crashing', () => {
    expect(() => routesFromTree(undefined)).toThrow(/circular import/)
  })

  it('lists static pages only, deduped, with staticData applied', () => {
    const entries = routesFromTree(tree, { exclude: ['/drafts'], defaults: { changefreq: 'weekly' } })
    expect(entries).toEqual([
      { changefreq: 'weekly', loc: '/' },
      { changefreq: 'weekly', priority: 0.8, loc: '/about' },
      { changefreq: 'weekly', loc: '/posts' },
    ])
  })
})

describe('robots', () => {
  it('allows everything by default', () => {
    expect(robotsTxt()).toBe('User-agent: *\nAllow: /\n')
  })
  it('renders rules and absolute sitemaps', () => {
    const out = robotsTxt({
      siteUrl: 'https://acme.dev',
      rules: [
        { userAgent: '*', allow: '/', disallow: ['/admin', '/api'] },
        { userAgent: ['GPTBot', 'CCBot'], disallow: '/', crawlDelay: 10 },
      ],
      sitemaps: ['/sitemap.xml'],
    })
    expect(out).toBe(
      'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\n\nUser-agent: GPTBot\nUser-agent: CCBot\nDisallow: /\nCrawl-delay: 10\n\nSitemap: https://acme.dev/sitemap.xml\n',
    )
  })
  it('blocks everything with disallowAll', () => {
    expect(robotsTxt({ disallowAll: true, rules: [{ userAgent: '*', allow: '/' }] })).toBe('User-agent: *\nDisallow: /\n')
  })
  it('throws on a relative sitemap without siteUrl', () => {
    expect(() => robotsTxt({ sitemaps: ['/sitemap.xml'] })).toThrow(/relative/)
  })
  it('serves per request', async () => {
    const handler = createRobotsHandler(({ request }) => ({ disallowAll: new URL(request.url).hostname.startsWith('preview.') }))
    const res = await handler(req('https://preview.acme.dev/robots.txt'))
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(await res.text()).toBe('User-agent: *\nDisallow: /\n')
    expect(await (await handler(req('https://acme.dev/robots.txt'))).text()).toBe('User-agent: *\nAllow: /\n')
  })
})
