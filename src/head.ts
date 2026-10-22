import type { JsonLdObject } from './json-ld'
import { absoluteUrl, normalizeSiteUrl, type TrailingSlash } from './url'

/**
 * One entry of a route's `head().meta` array, in the shapes TanStack Router renders.
 * The JSON-LD shape carries an optional `content?: undefined` so it stays assignable to
 * React's `<meta>` props type, which Router's React adapter uses for `meta`.
 */
export type MetaTag =
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string }
  | { 'script:ld+json': JsonLdObject; content?: undefined }

/** One entry of a route's `head().links` array. */
export type LinkTag = { rel: string; href: string; hrefLang?: string; type?: string; title?: string }

export interface HeadTags {
  meta: MetaTag[]
  links: LinkTag[]
}

export type ImageInput =
  | string
  | { url: string; width?: number; height?: number; alt?: string; type?: string }

export type RobotsInput =
  | string
  | {
      index?: boolean
      follow?: boolean
      noarchive?: boolean
      nosnippet?: boolean
      noimageindex?: boolean
      notranslate?: boolean
      maxSnippet?: number
      maxImagePreview?: 'none' | 'standard' | 'large'
      maxVideoPreview?: number
      unavailableAfter?: string | Date
    }

export type TwitterCard = 'summary' | 'summary_large_image' | 'app' | 'player'

export interface TwitterInput {
  card?: TwitterCard
  /** `@handle` of the site. */
  site?: string
  /** `@handle` of the author. */
  creator?: string
}

export interface ArticleInput {
  publishedTime?: string | Date
  modifiedTime?: string | Date
  expirationTime?: string | Date
  /** Author profile URL or name. Router keeps one tag per property, so only one author is emitted. */
  author?: string
  section?: string
}

export interface SiteConfig {
  /** Absolute origin (plus optional base path) of the site, e.g. `https://example.com`. */
  url: string
  /** Site name, used for `og:site_name`. */
  name?: string
  /** Title template; `%s` is replaced by the page title, e.g. `%s | Acme`. */
  titleTemplate?: string
  /** Title used when a route passes none (not templated). */
  defaultTitle?: string
  description?: string
  /** Default share image. Relative paths are resolved against `url`. */
  image?: ImageInput
  /** `og:locale`, e.g. `en_US`. */
  locale?: string
  twitter?: TwitterInput
  robots?: RobotsInput
  /** Match your router's `trailingSlash` option. Default `never`. */
  trailingSlash?: TrailingSlash
}

export interface SeoInput {
  title?: string
  /** Override the site template for this page, or `false` to use the title as is. */
  titleTemplate?: string | false
  description?: string
  /** Path of this page (e.g. `/posts/${params.slug}`): sets the canonical link and `og:url`. */
  path?: string
  /** Absolute or relative canonical URL, or `false` for none. Defaults to `path`. */
  canonical?: string | false
  /** Share image, or `false` to drop the site default. */
  image?: ImageInput | false
  /** `og:type`. Default `website`, or `article` when `article` is set. */
  type?: string
  article?: ArticleInput
  robots?: RobotsInput
  /** Shorthand for `robots: { index: false, follow: true }`. */
  noindex?: boolean
  /** hreflang alternates: `{ en: '/en/about', de: '/de/about', 'x-default': '/about' }`. */
  alternates?: Record<string, string>
  locale?: string
  twitter?: TwitterInput
  /** Title for `og:title`/`twitter:title`. Default: the page title without the template. */
  socialTitle?: string
  /** One or more JSON-LD objects (see the `jsonLd` helpers). */
  jsonLd?: JsonLdObject | JsonLdObject[]
  /** Extra meta tags, appended as given. */
  meta?: MetaTag[]
  /** Extra link tags, appended as given. */
  links?: LinkTag[]
}

export interface Seo {
  /** Build the `meta` and `links` for a route's `head()`. */
  (input?: SeoInput): HeadTags
  /** The site config with a normalized `url`. */
  readonly site: Readonly<SiteConfig>
  /** Absolute URL of a page path, with the site's trailing-slash rule. */
  url(path: string): string
}

/**
 * Create a typed head builder bound to your site's defaults.
 *
 * ```ts
 * export const seo = defineSeo({ url: 'https://acme.dev', name: 'Acme', titleTemplate: '%s | Acme' })
 * // in a route
 * head: ({ loaderData }) => seo({ title: loaderData.post.title, path: `/posts/${loaderData.post.slug}` })
 * ```
 */
export function defineSeo(config: SiteConfig): Seo {
  const site: SiteConfig = { ...config, url: normalizeSiteUrl(config.url) }
  const fn = ((input: SeoInput = {}) => buildHead(site, input)) as Seo
  Object.defineProperty(fn, 'site', { value: Object.freeze(site), enumerable: true })
  fn.url = (path: string) => absoluteUrl(site.url, path, site.trailingSlash ?? 'never')
  return fn
}

/** Build head tags without a site config. Relative URLs are not allowed here. */
export function seo(input: SeoInput & { siteUrl?: string }): HeadTags {
  const { siteUrl, ...rest } = input
  return buildHead({ url: siteUrl ? normalizeSiteUrl(siteUrl) : '' }, rest)
}

function buildHead(site: SiteConfig, input: SeoInput): HeadTags {
  const meta: MetaTag[] = []
  const links: LinkTag[] = []
  const slash = site.trailingSlash ?? 'never'
  const page = (p: string) => resolve(site.url, p, slash)
  const asset = (p: string) => resolve(site.url, p)

  const template = input.titleTemplate === false ? undefined : (input.titleTemplate ?? site.titleTemplate)
  const title =
    input.title !== undefined ? (template ? template.replace(/%s/g, input.title) : input.title) : site.defaultTitle
  if (title) meta.push({ title })

  const description = input.description ?? site.description
  if (description) meta.push({ name: 'description', content: description })

  const robots = input.noindex
    ? robotsContent({ ...(typeof input.robots === 'object' ? input.robots : {}), index: false })
    : robotsContent(input.robots ?? site.robots)
  if (robots) meta.push({ name: 'robots', content: robots })

  const canonical = input.canonical === false ? undefined : (input.canonical ?? input.path)
  const canonicalUrl = canonical !== undefined ? page(canonical) : undefined
  if (canonicalUrl) links.push({ rel: 'canonical', href: canonicalUrl })

  for (const [lang, href] of Object.entries(input.alternates ?? {})) {
    links.push({ rel: 'alternate', hrefLang: lang, href: page(href) })
  }

  // Open Graph
  const socialTitle = input.socialTitle ?? input.title ?? site.defaultTitle
  const type = input.type ?? (input.article ? 'article' : 'website')
  if (socialTitle) meta.push({ property: 'og:title', content: socialTitle })
  if (description) meta.push({ property: 'og:description', content: description })
  meta.push({ property: 'og:type', content: type })
  const ogUrl = canonicalUrl ?? (input.path !== undefined ? page(input.path) : undefined)
  if (ogUrl) meta.push({ property: 'og:url', content: ogUrl })
  if (site.name) meta.push({ property: 'og:site_name', content: site.name })
  const locale = input.locale ?? site.locale
  if (locale) meta.push({ property: 'og:locale', content: locale })

  const image = input.image === false ? undefined : (input.image ?? site.image)
  const img = image === undefined ? undefined : typeof image === 'string' ? { url: image } : image
  if (img) {
    const url = asset(img.url)
    meta.push({ property: 'og:image', content: url })
    if (url.startsWith('https://')) meta.push({ property: 'og:image:secure_url', content: url })
    if (img.type) meta.push({ property: 'og:image:type', content: img.type })
    if (img.width) meta.push({ property: 'og:image:width', content: String(img.width) })
    if (img.height) meta.push({ property: 'og:image:height', content: String(img.height) })
    if (img.alt) meta.push({ property: 'og:image:alt', content: img.alt })
  }

  if (input.article) {
    const a = input.article
    if (a.publishedTime) meta.push({ property: 'article:published_time', content: isoDate(a.publishedTime) })
    if (a.modifiedTime) meta.push({ property: 'article:modified_time', content: isoDate(a.modifiedTime) })
    if (a.expirationTime) meta.push({ property: 'article:expiration_time', content: isoDate(a.expirationTime) })
    if (a.author) meta.push({ property: 'article:author', content: a.author })
    if (a.section) meta.push({ property: 'article:section', content: a.section })
  }

  // Twitter / X
  const twitter = { ...site.twitter, ...input.twitter }
  meta.push({ name: 'twitter:card', content: twitter.card ?? (img ? 'summary_large_image' : 'summary') })
  if (twitter.site) meta.push({ name: 'twitter:site', content: twitter.site })
  if (twitter.creator) meta.push({ name: 'twitter:creator', content: twitter.creator })
  if (socialTitle) meta.push({ name: 'twitter:title', content: socialTitle })
  if (description) meta.push({ name: 'twitter:description', content: description })
  if (img) {
    meta.push({ name: 'twitter:image', content: asset(img.url) })
    if (img.alt) meta.push({ name: 'twitter:image:alt', content: img.alt })
  }

  const ld = input.jsonLd === undefined ? [] : Array.isArray(input.jsonLd) ? input.jsonLd : [input.jsonLd]
  for (const obj of ld) meta.push({ 'script:ld+json': obj })

  if (input.meta) meta.push(...input.meta)
  if (input.links) links.push(...input.links)
  return { meta, links }
}

function resolve(siteUrl: string, pathOrUrl: string, slash?: TrailingSlash): string {
  if (!siteUrl && !/^(https?:)?\/\//i.test(pathOrUrl)) {
    throw new TypeError(
      `start-seo-kit: "${pathOrUrl}" is relative; use defineSeo({ url }) or pass siteUrl to resolve it`,
    )
  }
  return absoluteUrl(siteUrl || 'https://invalid.invalid', pathOrUrl, slash)
}

/** Serialize robots directives, e.g. `{ index: false, maxImagePreview: 'large' }` -> `noindex, follow, max-image-preview:large`. */
export function robotsContent(robots: RobotsInput | undefined): string | undefined {
  if (robots === undefined) return undefined
  if (typeof robots === 'string') return robots || undefined
  const parts: string[] = []
  if (robots.index !== undefined || robots.follow !== undefined) {
    parts.push(robots.index === false ? 'noindex' : 'index', robots.follow === false ? 'nofollow' : 'follow')
  }
  if (robots.noarchive) parts.push('noarchive')
  if (robots.nosnippet) parts.push('nosnippet')
  if (robots.noimageindex) parts.push('noimageindex')
  if (robots.notranslate) parts.push('notranslate')
  if (robots.maxSnippet !== undefined) parts.push(`max-snippet:${robots.maxSnippet}`)
  if (robots.maxImagePreview) parts.push(`max-image-preview:${robots.maxImagePreview}`)
  if (robots.maxVideoPreview !== undefined) parts.push(`max-video-preview:${robots.maxVideoPreview}`)
  if (robots.unavailableAfter) parts.push(`unavailable_after:${isoDate(robots.unavailableAfter)}`)
  return parts.length ? parts.join(', ') : undefined
}

function isoDate(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value
}
