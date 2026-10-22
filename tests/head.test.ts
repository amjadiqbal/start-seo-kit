import { describe, expect, it } from 'vitest'
import { defineSeo, jsonLd, robotsContent, seo } from '../src'

const site = defineSeo({
  url: 'https://acme.dev/',
  name: 'Acme',
  titleTemplate: '%s | Acme',
  defaultTitle: 'Acme: rockets for everyone',
  description: 'Rockets.',
  image: { url: '/og.png', width: 1200, height: 630, alt: 'Acme' },
  locale: 'en_US',
  twitter: { site: '@acme' },
})

const find = (meta: unknown[], key: string) =>
  meta.find((m) => (m as Record<string, string>).name === key || (m as Record<string, string>).property === key) as
    | { content: string }
    | undefined

describe('defineSeo', () => {
  it('builds a full page head', () => {
    const { meta, links } = site({ title: 'Launch', description: 'We launched.', path: '/blog/launch' })
    expect(meta[0]).toEqual({ title: 'Launch | Acme' })
    expect(find(meta, 'description')?.content).toBe('We launched.')
    expect(find(meta, 'og:title')?.content).toBe('Launch')
    expect(find(meta, 'og:url')?.content).toBe('https://acme.dev/blog/launch')
    expect(find(meta, 'og:site_name')?.content).toBe('Acme')
    expect(find(meta, 'og:locale')?.content).toBe('en_US')
    expect(find(meta, 'og:image')?.content).toBe('https://acme.dev/og.png')
    expect(find(meta, 'og:image:secure_url')?.content).toBe('https://acme.dev/og.png')
    expect(find(meta, 'og:image:width')?.content).toBe('1200')
    expect(find(meta, 'og:image:alt')?.content).toBe('Acme')
    expect(find(meta, 'twitter:card')?.content).toBe('summary_large_image')
    expect(find(meta, 'twitter:site')?.content).toBe('@acme')
    expect(find(meta, 'twitter:image')?.content).toBe('https://acme.dev/og.png')
    expect(links).toEqual([{ rel: 'canonical', href: 'https://acme.dev/blog/launch' }])
  })

  it('uses the default title without the template and emits no canonical without a path', () => {
    const { meta, links } = site()
    expect(meta[0]).toEqual({ title: 'Acme: rockets for everyone' })
    expect(links).toEqual([])
    expect(find(meta, 'og:url')).toBeUndefined()
  })

  it('lets a page turn off the template, the image and the canonical', () => {
    const { meta, links } = site({ title: 'Raw', titleTemplate: false, image: false, path: '/x', canonical: false })
    expect(meta[0]).toEqual({ title: 'Raw' })
    expect(find(meta, 'og:image')).toBeUndefined()
    expect(find(meta, 'twitter:card')?.content).toBe('summary')
    expect(links).toEqual([])
    expect(find(meta, 'og:url')?.content).toBe('https://acme.dev/x')
  })

  it('writes hreflang alternates, robots and article tags', () => {
    const { meta, links } = site({
      title: 'Post',
      path: '/en/post',
      alternates: { en: '/en/post', de: '/de/post', 'x-default': '/en/post' },
      noindex: true,
      article: { publishedTime: new Date('2026-10-01T00:00:00Z'), author: 'https://acme.dev/team/ana', section: 'News' },
    })
    expect(links).toContainEqual({ rel: 'alternate', hrefLang: 'de', href: 'https://acme.dev/de/post' })
    expect(links).toContainEqual({ rel: 'alternate', hrefLang: 'x-default', href: 'https://acme.dev/en/post' })
    expect(find(meta, 'robots')?.content).toBe('noindex, follow')
    expect(find(meta, 'og:type')?.content).toBe('article')
    expect(find(meta, 'article:published_time')?.content).toBe('2026-10-01T00:00:00.000Z')
    expect(find(meta, 'article:section')?.content).toBe('News')
  })

  it('applies the trailing-slash rule to page URLs but not to images', () => {
    const s = defineSeo({ url: 'https://acme.dev', trailingSlash: 'always' })
    const { meta, links } = s({ path: '/docs', image: '/img/a.png' })
    expect(links[0]?.href).toBe('https://acme.dev/docs/')
    expect(find(meta, 'og:image')?.content).toBe('https://acme.dev/img/a.png')
    expect(s.url('/')).toBe('https://acme.dev/')
  })

  it('keeps a base path from the site url', () => {
    const s = defineSeo({ url: 'https://acme.dev/shop/' })
    expect(s.url('/cart')).toBe('https://acme.dev/shop/cart')
    expect(s.site.url).toBe('https://acme.dev/shop')
  })

  it('adds JSON-LD as Router script:ld+json meta, plus extra tags', () => {
    const org = jsonLd.organization({ name: 'Acme', url: 'https://acme.dev' })
    const { meta, links } = site({
      jsonLd: org,
      meta: [{ name: 'theme-color', content: '#0B1220' }],
      links: [{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
    })
    expect(meta).toContainEqual({ 'script:ld+json': org })
    expect(meta.at(-1)).toEqual({ name: 'theme-color', content: '#0B1220' })
    expect(links).toEqual([{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }])
  })

  it('rejects an invalid site url', () => {
    expect(() => defineSeo({ url: 'acme.dev' })).toThrow(/absolute URL/)
    expect(() => defineSeo({ url: 'ftp://acme.dev' })).toThrow(/http or https/)
  })
})

describe('seo (no site config)', () => {
  it('accepts absolute urls', () => {
    const { links } = seo({ title: 'A', canonical: 'https://x.dev/a' })
    expect(links[0]?.href).toBe('https://x.dev/a')
  })
  it('throws on relative urls without siteUrl', () => {
    expect(() => seo({ path: '/a' })).toThrow(/relative/)
    expect(seo({ path: '/a', siteUrl: 'https://x.dev' }).links[0]?.href).toBe('https://x.dev/a')
  })
})

describe('robotsContent', () => {
  it('serializes directives', () => {
    expect(robotsContent({ index: false, follow: false })).toBe('noindex, nofollow')
    expect(robotsContent({ maxImagePreview: 'large', maxSnippet: -1 })).toBe('max-snippet:-1, max-image-preview:large')
    expect(robotsContent('noindex')).toBe('noindex')
    expect(robotsContent({})).toBeUndefined()
  })
})
