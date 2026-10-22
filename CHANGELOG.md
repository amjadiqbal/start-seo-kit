# Changelog

All notable changes to `@amjadiqbal/start-seo-kit` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.1] - 2026-10-23

Fixes from a README-versus-code audit of 0.1.0.

### Changed
- `createSitemap`: `/sitemap.xml` now loads each array or function source once per request (a function source was called twice when the sitemap fit in one file). Paginated sources (`count` + `entries`) are still the way to avoid loading a large table per request; the README now says what each source type costs.

### Docs
- JSON-LD: the kit passes objects to TanStack Router, which serialises and HTML-escapes them; the README no longer suggests the kit does the escaping (checked in a real app with a `</script>` string).
- Compatibility: "Tested with" versions instead of an unenforced "1.131 or later", and why there is no TanStack peer dependency.
- `checkProduct()`: the exact error and warning rules, including that a missing offer is an error only for merchant listings or when there is no rating or review.
- Product schema is described as following Google's rules, not as a promise of rich results.
- Documented: `index: false` throws `RangeError` past the limit, page 1 of an empty source is an empty urlset, the standalone `seo()` throws on relative URLs without `siteUrl`, and `og:title` is the untemplated title.

## [0.1.0] - 2026-10-23

First release.

### Added
- `defineSeo()` / `seo()`: typed `head()` builder for TanStack Start and Router (title templates, description, canonical, Open Graph, Twitter cards, robots, hreflang alternates, article tags, JSON-LD).
- `jsonLd`: Organization, WebSite (sitelinks search box), Article/BlogPosting, BreadcrumbList, FAQPage, Person and `@graph` builders.
- `createSitemap()`: dynamic `sitemap.xml` from Start server routes, with automatic sitemap index and paginated sources for large sites; `routesFromTree()` for static routes; `sitemapXml()` and `sitemapIndexXml()`.
- `createRobotsHandler()` and `robotsTxt()`.
- `@amjadiqbal/start-seo-kit/commerce`: Product, Offer, AggregateOffer, AggregateRating, Review, shipping and return-policy JSON-LD, Open Graph `product:*` tags, `productSeo()`, `productSitemapEntries()` and `checkProduct()` against Google's product rich-result rules.
- `@amjadiqbal/start-seo-kit/og`: Open Graph image route (`createOgImageHandler()`, `renderOgImage()`, `ogCard()`) on satori and resvg-wasm, as optional peers.

### Tested
- Unit tests: 44 (Vitest), including a real satori + resvg-wasm PNG.
- A real TanStack Start 1.169.3 app (React, Vite 8, Node) installing the packed tarball, in dev and in a production build (`vite build` + `vite preview`): server-rendered head tags on every route type, client-side navigation updates, sitemap index and child sitemaps, robots.txt, and OG image PNGs.

[0.1.1]: https://github.com/amjadiqbal/start-seo-kit/releases/tag/v0.1.1
[0.1.0]: https://github.com/amjadiqbal/start-seo-kit/releases/tag/v0.1.0
