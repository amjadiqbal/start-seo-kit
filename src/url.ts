export type TrailingSlash = 'never' | 'always'

/** `https://example.com/` -> `https://example.com`. Throws on a value that is not an absolute http(s) URL. */
export function normalizeSiteUrl(siteUrl: string): string {
  let parsed: URL
  try {
    parsed = new URL(siteUrl)
  } catch {
    throw new TypeError(`start-seo-kit: siteUrl must be an absolute URL, got "${siteUrl}"`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new TypeError(`start-seo-kit: siteUrl must use http or https, got "${siteUrl}"`)
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`
}

/** Apply the router's trailing-slash convention to a path (the root `/` is left alone). */
export function applyTrailingSlash(path: string, trailingSlash: TrailingSlash = 'never'): string {
  const [pathname = '', rest = ''] = splitPath(path)
  if (pathname === '/' || pathname === '') return `/${rest}`
  const trimmed = pathname.replace(/\/+$/, '')
  return `${trailingSlash === 'always' ? `${trimmed}/` : trimmed}${rest}`
}

/**
 * Resolve a path or URL against the site. Absolute http(s) URLs are returned unchanged.
 * Pass `trailingSlash` for page URLs only; asset URLs (images) keep their path as given.
 */
export function absoluteUrl(siteUrl: string, pathOrUrl: string, trailingSlash?: TrailingSlash): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  if (pathOrUrl.startsWith('//')) return `https:${pathOrUrl}`
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return `${normalizeSiteUrl(siteUrl)}${trailingSlash ? applyTrailingSlash(path, trailingSlash) : path}`
}

function splitPath(path: string): [string, string] {
  const i = path.search(/[?#]/)
  return i === -1 ? [path, ''] : [path.slice(0, i), path.slice(i)]
}
