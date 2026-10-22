import type { HandlerContext, ServerHandler } from './sitemap'
import { absoluteUrl, normalizeSiteUrl } from './url'

type Awaitable<T> = T | Promise<T>

export interface RobotsRule {
  userAgent: string | string[]
  allow?: string | string[]
  disallow?: string | string[]
  crawlDelay?: number
}

export interface RobotsConfig {
  /** Default: one rule allowing everything for every user agent. */
  rules?: RobotsRule[]
  /** Sitemap paths or URLs. Paths need `siteUrl`. */
  sitemaps?: string[]
  siteUrl?: string
  /** Block every crawler (`Disallow: /`), e.g. on staging or preview deployments. Overrides `rules`. */
  disallowAll?: boolean
}

/** Render a robots.txt body. */
export function robotsTxt(config: RobotsConfig = {}): string {
  const rules: RobotsRule[] = config.disallowAll
    ? [{ userAgent: '*', disallow: '/' }]
    : (config.rules ?? [{ userAgent: '*', allow: '/' }])
  const lines: string[] = []
  for (const rule of rules) {
    if (lines.length) lines.push('')
    for (const ua of list(rule.userAgent)) lines.push(`User-agent: ${ua}`)
    for (const path of list(rule.allow)) lines.push(`Allow: ${path}`)
    for (const path of list(rule.disallow)) lines.push(`Disallow: ${path}`)
    if (rule.crawlDelay !== undefined) lines.push(`Crawl-delay: ${rule.crawlDelay}`)
  }
  const sitemaps = config.sitemaps ?? []
  if (sitemaps.length) lines.push('')
  for (const s of sitemaps) {
    if (!config.siteUrl && !/^https?:\/\//i.test(s)) {
      throw new TypeError(`start-seo-kit: sitemap "${s}" is relative; pass siteUrl`)
    }
    lines.push(`Sitemap: ${config.siteUrl ? absoluteUrl(normalizeSiteUrl(config.siteUrl), s) : s}`)
  }
  return `${lines.join('\n')}\n`
}

/**
 * `GET` handler for a `/robots.txt` server route. Pass a function to decide per request
 * (for example, `disallowAll` when the host is a preview deployment).
 */
export function createRobotsHandler(
  config: RobotsConfig | ((ctx: HandlerContext) => Awaitable<RobotsConfig>),
  init: { cacheControl?: string } = {},
): ServerHandler {
  return async (ctx) => {
    const resolved = typeof config === 'function' ? await config(ctx) : config
    return new Response(robotsTxt(resolved), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': init.cacheControl ?? 'public, max-age=3600',
      },
    })
  }
}

function list(value: string | string[] | undefined): string[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value]
}
