<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="art/banner-dark.png">
    <img alt="Start SEO Kit: meta tags, sitemaps, JSON-LD and OG images for TanStack Start" src="art/banner-light.png" width="100%">
  </picture>
</p>

# Start SEO Kit: meta tags, sitemaps, robots.txt, JSON-LD and OG images for TanStack Start

Typed SEO helpers for [TanStack Start](https://tanstack.com/start) and TanStack Router: a `head()` builder with title templates, canonical URLs, Open Graph, Twitter cards, robots and hreflang; a dynamic `sitemap.xml` (with a sitemap index for large sites) and `robots.txt` served from Start server routes; typed JSON-LD structured data; e-commerce Product schema for Google product rich results; and an optional Open Graph image route.

[![npm](https://img.shields.io/npm/v/@amjadiqbal/start-seo-kit?style=flat-square)](https://www.npmjs.com/package/@amjadiqbal/start-seo-kit)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@amjadiqbal/start-seo-kit?style=flat-square)](https://bundlephobia.com/package/@amjadiqbal/start-seo-kit)
[![License](https://img.shields.io/npm/l/@amjadiqbal/start-seo-kit?style=flat-square)](LICENSE.md)

It builds on what Start already gives you (the route `head()` option and server routes) instead of replacing it: every helper returns the plain objects and `Response`s Start expects, so you can mix them with your own tags. No runtime dependencies, no network calls, no telemetry.

## Install

```bash
npm i @amjadiqbal/start-seo-kit
```

For the optional OG image route, also install `satori` and `@resvg/resvg-wasm`:

```bash
npm i satori @resvg/resvg-wasm
```

## Meta tags: `defineSeo()`

Define your site once:

```ts
// src/seo.ts
import { defineSeo } from '@amjadiqbal/start-seo-kit'

export const seo = defineSeo({
  url: 'https://acme.dev',
  name: 'Acme',
  titleTemplate: '%s | Acme',
  defaultTitle: 'Acme: rockets for everyone',
  description: 'Rockets, delivered.',
  image: { url: '/og.png', width: 1200, height: 630, alt: 'Acme' },
  locale: 'en_US',
  twitter: { site: '@acme' },
})
```

Then call it from any route's `head()`:

```tsx
// src/routes/posts/$slug.tsx
import { createFileRoute } from '@tanstack/react-router'
import { jsonLd } from '@amjadiqbal/start-seo-kit'
import { seo } from '../../seo'

export const Route = createFileRoute('/posts/$slug')({
  loader: ({ params }) => fetchPost(params.slug),
  head: ({ loaderData: post }) =>
    seo({
      title: post?.title,
      description: post?.excerpt,
      path: `/posts/${post?.slug}`, // canonical link and og:url
      image: `/og/${post?.slug}`, // the OG image route below
      article: { publishedTime: post?.publishedAt, section: 'Blog' },
      jsonLd: jsonLd.article({ type: 'BlogPosting', headline: post?.title ?? '', url: seo.url(`/posts/${post?.slug}`) }),
    }),
  component: PostPage,
})
```

That one call produces `<title>Hello | Acme</title>`, the description, `og:title`, `og:description`, `og:type`, `og:url`, `og:site_name`, `og:locale`, `og:image`, `article:*`, the `twitter:*` card tags, a `<link rel="canonical">` and a JSON-LD `<script>`. All URLs are made absolute.

Need more? `seo()` returns `{ meta, links }`, so spread it and add your own: `head: () => ({ ...seo({ title: 'About' }), scripts: [...] })`.

| Option | What it does |
|---|---|
| `title`, `titleTemplate` | Page title through the site template (`%s \| Acme`); `titleTemplate: false` uses the title as is. |
| `description` | `description`, `og:description` and `twitter:description`. |
| `path` / `canonical` | Canonical link and `og:url`. `canonical: false` drops the link. |
| `image` | Share image (string or `{ url, width, height, alt, type }`); `false` drops the site default. |
| `noindex`, `robots` | `<meta name="robots">`: `noindex: true`, or `{ index, follow, maxImagePreview, maxSnippet, ... }`, or a string. |
| `alternates` | hreflang links: `{ en: '/en/about', de: '/de/about', 'x-default': '/about' }`. |
| `type`, `article` | `og:type` (default `website`, or `article` when `article` is set) and `article:published_time` and friends. |
| `twitter` | `card`, `site`, `creator` (merged with the site's). |
| `jsonLd` | One or more JSON-LD objects. |
| `meta`, `links` | Extra tags, appended as given. |

Set `trailingSlash: 'always'` in `defineSeo` if your router uses it, so canonical URLs match.

### How Router merges tags (worth knowing)

TanStack Router merges `head()` from every matched route. For `meta`, the deepest route wins per `name`/`property`, and tags a child route doesn't set are inherited from its parents. `links` are not merged: every route's links are rendered. So:

- Call `seo()` in the root route for site-wide defaults **without** `path`, and pass `path` only in leaf routes. That way there is exactly one canonical link.
- If the root sets an image with `width`/`height` and a child sets a different image without them, the child inherits the root's dimensions. Give child images their dimensions too, or set images only in leaf routes.
- Router keeps one tag per property, so only one `og:image` and one `article:author` survive per page. The builder emits one of each.

## Structured data: `jsonLd`

Typed builders for common schema.org types. Each returns a JSON-LD object; pass it to `seo({ jsonLd })` and Router renders it as `<script type="application/ld+json">` (HTML-escaped).

```ts
import { jsonLd } from '@amjadiqbal/start-seo-kit'

jsonLd.organization({ name: 'Acme', url: 'https://acme.dev', logo: 'https://acme.dev/logo.png', sameAs: ['https://x.com/acme'] })
jsonLd.website({ name: 'Acme', url: 'https://acme.dev', searchUrlTemplate: 'https://acme.dev/search?q={search_term_string}' })
jsonLd.article({ type: 'BlogPosting', headline: 'Hello', datePublished: new Date(), author: 'Ana' })
jsonLd.breadcrumbs([{ name: 'Home', url: 'https://acme.dev/' }, { name: 'Blog', url: 'https://acme.dev/blog' }])
jsonLd.faq([{ question: 'Does it fly?', answer: 'Yes.' }])
jsonLd.person({ name: 'Ana', url: 'https://acme.dev/team/ana' })
jsonLd.graph(org, site) // several nodes in one @graph document
```

## E-commerce: `@amjadiqbal/start-seo-kit/commerce`

Product pages need more than an Article: Google's product snippets and merchant listings read `Product` JSON-LD with an `Offer` (or `AggregateOffer`), ratings, reviews, shipping and a return policy. The `commerce` entry point builds all of it from one typed object, plus the Open Graph `product:*` tags.

```tsx
// src/routes/p/$slug.tsx
import { createFileRoute } from '@tanstack/react-router'
import { productSeo, type ProductInput } from '@amjadiqbal/start-seo-kit/commerce'
import { seo } from '../../seo'

export const Route = createFileRoute('/p/$slug')({
  loader: ({ params }) => fetchProduct(params.slug),
  head: ({ loaderData: p }) => {
    if (!p) return {}
    const product: ProductInput = {
      name: p.name,
      description: p.summary,
      image: p.images, // absolute URLs
      url: seo.url(`/p/${p.slug}`),
      sku: p.sku,
      gtin: p.gtin,
      brand: p.brand,
      offers: {
        price: p.price, // 119.99, no currency symbol
        currency: 'USD',
        availability: p.stock > 0 ? 'InStock' : 'OutOfStock',
        condition: 'NewCondition',
        shipping: { rate: 0, currency: 'USD', country: 'US', handlingDays: [0, 1], transitDays: [2, 5] },
        returnPolicy: { country: 'US', category: 'finite', days: 30, fees: 'free', method: ['mail'] },
      },
      rating: { value: p.rating, reviewCount: p.reviewCount },
    }
    return seo({ title: p.name, description: p.summary, path: `/p/${p.slug}`, image: p.images[0], ...productSeo(product) })
  },
  component: ProductPage,
})
```

`productSeo()` sets `og:type` to `product`, adds `product:price:amount`, `product:price:currency`, `product:availability`, `product:condition`, `product:brand` and `product:retailer_item_id`, and the Product JSON-LD.

- `offers` takes one offer, an array (several sellers) or a price range `{ lowPrice, highPrice, currency, offerCount }` (an `AggregateOffer`; Google wants a plain `Offer` for merchant listings and price-drop badges).
- `reviews: [{ author, rating, body, positiveNotes, negativeNotes }]` adds `Review` nodes, including pros and cons for editorial reviews.
- `returnPolicy` is either `{ country, category: 'finite' | 'unlimited' | 'notPermitted', days, fees, method }` or just `{ url }`. `returnPolicyLd()` and `shippingLd()` are exported if you want them on your Organization instead.
- `productJsonLd()`, `offerLd()`, `aggregateOfferLd()`, `aggregateRatingLd()` and `reviewLd()` return the individual nodes. `jsonLd.breadcrumbs()` is re-exported for category trails.
- `productSitemapEntries(products, { path, lastmod, images })` turns your catalogue into a `createSitemap` source with `<image:image>` entries.

### Check a product against Google's rules

`checkProduct(product, { merchantListing: true })` returns `{ errors, warnings }` based on Google's product snippet, merchant listing, shipping and return-policy documentation (checked 2026-10-22): a missing name, image or offer, a price with a currency symbol, a lowercase currency, shipping in another currency, a finite return window without days, a rating without a count, and so on. It never throws, so it's safe in a unit test over your catalogue:

```ts
for (const p of await listProducts()) {
  expect(checkProduct(toProductInput(p), { merchantListing: true }).errors).toEqual([])
}
```

It checks the rules that can be checked offline. Google's Rich Results Test is still the final word.

## Dynamic sitemap: `createSitemap()`

Start's built-in sitemap only covers prerendered pages. `createSitemap` serves one at request time from a server route, with static pages read from your route tree and dynamic pages from your data:

```ts
// src/sitemap.ts
import { createSitemap, routesFromTree } from '@amjadiqbal/start-seo-kit'
import { routeTree } from './routeTree.gen'

export const sitemap = createSitemap({
  siteUrl: 'https://acme.dev',
  sources: {
    pages: routesFromTree(routeTree, { exclude: ['/login', /^\/admin/] }),
    posts: async () => (await db.posts.list()).map((p) => ({ loc: `/posts/${p.slug}`, lastmod: p.updatedAt })),
  },
})
```

```ts
// src/routes/sitemap[.]xml.ts
import { createFileRoute } from '@tanstack/react-router'
import { sitemap } from '../sitemap'

export const Route = createFileRoute('/sitemap.xml')({
  server: { handlers: { GET: sitemap.index } },
})
```

```ts
// src/routes/sitemaps/$name.ts   (child sitemaps, used once the site outgrows one file)
import { createFileRoute } from '@tanstack/react-router'
import { sitemap } from '../../sitemap'

export const Route = createFileRoute('/sitemaps/$name')({
  server: { handlers: { GET: sitemap.page } },
})
```

- While every URL fits in one file (50,000 by default, `maxUrlsPerSitemap`), `/sitemap.xml` is a plain `<urlset>`. Past that it becomes a `<sitemapindex>` pointing at `/sitemaps/pages-1.xml`, `/sitemaps/posts-1.xml`, `/sitemaps/posts-2.xml` and so on. `index: true` always serves an index.
- For very large tables, give a source `count()` and `entries({ offset, limit })` so each request loads only one chunk: `posts: { count: () => db.posts.count(), entries: ({ offset, limit }) => db.posts.page(offset, limit) }`.
- Entries take `loc`, `lastmod`, `changefreq`, `priority`, hreflang `alternates` and `images`.
- `routesFromTree` lists parameter-free page routes. It skips dynamic routes (`$id`, `$`), server-only routes, paths with a file extension and routes with `staticData: { sitemap: false }`. `staticData: { sitemap: { priority: 0.8 } }` sets per-route values. If you use `staticData` with TypeScript, declare the field once:

  ```ts
  declare module '@tanstack/react-router' {
    interface StaticDataRouteOption {
      sitemap?: false | { priority?: number; changefreq?: 'daily' | 'weekly' | 'monthly' }
    }
  }
  ```

`sitemapXml()` and `sitemapIndexXml()` are exported too, if you'd rather build the response yourself.

## robots.txt: `createRobotsHandler()`

```ts
// src/routes/robots[.]txt.ts
import { createFileRoute } from '@tanstack/react-router'
import { createRobotsHandler } from '@amjadiqbal/start-seo-kit'

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: createRobotsHandler(({ request }) => ({
        siteUrl: 'https://acme.dev',
        // keep preview deployments out of search results
        disallowAll: new URL(request.url).hostname !== 'acme.dev',
        rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api'] }],
        sitemaps: ['/sitemap.xml'],
      })),
    },
  },
})
```

Delete `public/robots.txt` if you have one, since a static file is served before the route.

## Open Graph images: `@amjadiqbal/start-seo-kit/og` (optional)

Renders a 1200×630 PNG per page with [satori](https://github.com/vercel/satori) and [resvg-wasm](https://github.com/yisibl/resvg-js). It lives in its own entry point, so the core stays dependency-free.

```ts
// src/routes/og/$slug.ts
import { readFile } from 'node:fs/promises'
import { createFileRoute } from '@tanstack/react-router'
import { createOgImageHandler, ogCard } from '@amjadiqbal/start-seo-kit/og'

const og = createOgImageHandler({
  // satori needs at least one font file (TTF, OTF or WOFF, not WOFF2); loaded once
  fonts: async () => [{ name: 'Inter', weight: 700, data: await readFile('src/assets/Inter-Bold.ttf') }],
  render: async ({ params }) => {
    const post = await fetchPost(params.slug)
    if (!post) return null // 404
    return ogCard({ title: post.title, description: post.excerpt, eyebrow: 'Acme blog', footer: 'acme.dev', fontFamily: 'Inter' })
  },
})

export const Route = createFileRoute('/og/$slug')({
  server: { handlers: { GET: og } },
})
```

- `ogCard()` is a ready-made design (dark background, emerald accent, all colours configurable). You can return your own JSX instead: any element satori accepts.
- On Node, the resvg `.wasm` is read from `node_modules` automatically. On edge runtimes (Cloudflare Workers and similar), import the wasm module yourself and pass it as `wasm`.
- `format: 'svg'` skips resvg and returns SVG (fine for testing; most social sites want PNG).
- Responses are cached for a day (`cacheControl` to change).
- `renderOgImage(element, options)` is exported for use outside a route, e.g. at build time.

## Compatibility

- TanStack Start / Router **1.131 or later** (the `server.handlers` route option). Tested with `@tanstack/react-start` 1.169.3 and `@tanstack/react-router` 1.170.45.
- Node 20 or later. ESM only.
- React. The helpers only return plain objects and `Response`s, so they should work with Solid Start as well, but that is not tested yet.

## What's tested

- Unit tests (Vitest) for every helper: tag output, URL handling, escaping, sitemap chunking and the index, route-tree walking, robots rules, the commerce schema and `checkProduct` rules, and a real PNG rendered through satori and resvg-wasm.
- Type tests: `seo()` output assigned to a Router route's `head()` with no casts.
- A real TanStack Start app installing the packed tarball: head tags in the server-rendered HTML, `/sitemap.xml`, a child sitemap, `/robots.txt` and an OG image route, checked in a browser.

Not tested: Solid Start; edge runtimes (Workers, Netlify Edge) for the OG route; and live Google indexing (the commerce output follows Google's documentation, but whether a page gets a rich result is Google's call).

## Coming from hand-written head tags or `super-sitemap`

- **Hand-written `head()`**: replace each `meta` array with one `seo({...})` call. Your existing `scripts` and `styles` stay as they are.
- **Start's prerender sitemap**: keep it for fully static sites. Use `createSitemap` when pages come from a database or the site isn't prerendered, and turn the built-in `sitemap` option off so the two don't both write `/sitemap.xml`.
- **`super-sitemap`**: its route list maps to `routesFromTree` plus one source per dynamic route (`posts: () => slugs.map(...)`). Chunking into a sitemap index is automatic.

## Support

- 🐛 **Bug or feature request**: [open an issue](https://github.com/amjadiqbal/start-seo-kit/issues)
- 🔒 **Security issue**: please report privately via GitHub's security tab

## Need this built into your app, or something custom?

I build and fix TanStack Start, Router and Query apps, including SEO, migrations and performance work.
[Get in touch](https://amjad.com.pk/contact?utm_source=github&utm_medium=readme&utm_campaign=start-seo-kit).

## More packages

Part of a family of open-source packages. See [all of them](https://github.com/amjadiqbal?tab=repositories).

## License

MIT. See [LICENSE.md](LICENSE.md).
