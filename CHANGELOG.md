# Changelog

All notable changes to `@amjadiqbal/start-seo-kit` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- `defineSeo()` / `seo()`: typed `head()` builder for TanStack Start and Router (title templates, description, canonical, Open Graph, Twitter cards, robots, hreflang alternates, article tags, JSON-LD).
- `jsonLd`: Organization, WebSite (sitelinks search box), Article/BlogPosting, BreadcrumbList, FAQPage, Person and `@graph` builders.
- `createSitemap()`: dynamic `sitemap.xml` from Start server routes, with automatic sitemap index and paginated sources for large sites; `routesFromTree()` for static routes; `sitemapXml()` and `sitemapIndexXml()`.
- `createRobotsHandler()` and `robotsTxt()`.
- `@amjadiqbal/start-seo-kit/commerce`: Product, Offer, AggregateOffer, AggregateRating, Review, shipping and return-policy JSON-LD, Open Graph `product:*` tags, `productSeo()`, `productSitemapEntries()` and `checkProduct()` against Google's product rich-result rules.
- `@amjadiqbal/start-seo-kit/og`: Open Graph image route (`createOgImageHandler()`, `renderOgImage()`, `ogCard()`) on satori and resvg-wasm, as optional peers.
