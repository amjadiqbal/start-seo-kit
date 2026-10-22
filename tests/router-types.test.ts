// Type-level check (run by `tsc --noEmit`): the builder output plugs straight into a TanStack Router
// route's `head()`, and the handlers into Start server routes, with no casts.
import { createRootRoute, createRoute } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'
import { createRobotsHandler, createSitemap, defineSeo, jsonLd, routesFromTree } from '../src'

const seo = defineSeo({ url: 'https://acme.dev', name: 'Acme', titleTemplate: '%s | Acme' })

const rootRoute = createRootRoute({
  head: () => seo({ jsonLd: jsonLd.website({ name: 'Acme', url: seo.url('/') }) }),
})

const postRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/posts/$slug',
  loader: ({ params }) => ({ title: `Post ${params.slug}` }),
  head: ({ loaderData, params }) => ({
    ...seo({ title: loaderData?.title, path: `/posts/${params.slug}` }),
    scripts: [{ src: '/analytics.js', defer: true }],
  }),
})

const routeTree = rootRoute.addChildren([postRoute])

describe('router integration types', () => {
  it('produces head() objects and server handlers', async () => {
    expect(postRoute.options.head).toBeTypeOf('function')
    const sitemap = createSitemap({ siteUrl: 'https://acme.dev', sources: { pages: routesFromTree(routeTree) } })
    const robots = createRobotsHandler({ siteUrl: 'https://acme.dev', sitemaps: ['/sitemap.xml'] })
    expect(sitemap.index).toBeTypeOf('function')
    expect(robots).toBeTypeOf('function')
  })
})
