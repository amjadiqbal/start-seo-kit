import { describe, expect, it } from 'vitest'
import { defineSeo } from '../src'
import {
  checkProduct,
  jsonLd,
  productJsonLd,
  productOpenGraph,
  productSeo,
  productSitemapEntries,
  returnPolicyLd,
  type ProductInput,
} from '../src/commerce'

const product: ProductInput = {
  name: 'Trail Runner 2',
  description: 'Light trail shoe.',
  image: ['https://shop.dev/img/tr2-1.jpg', 'https://shop.dev/img/tr2-2.jpg'],
  url: 'https://shop.dev/p/trail-runner-2',
  sku: 'TR2-42',
  gtin: '0123456789012',
  brand: 'Acme',
  offers: {
    price: 119.99,
    currency: 'USD',
    availability: 'InStock',
    condition: 'NewCondition',
    priceValidUntil: new Date('2026-12-31T12:00:00Z'),
    shipping: { rate: 0, currency: 'USD', country: 'US', regions: ['NY', 'CA'], handlingDays: [0, 1], transitDays: [1, 5] },
    returnPolicy: { country: 'US', category: 'finite', days: 30, fees: 'free', method: ['mail'] },
  },
  rating: { value: 4.4, reviewCount: 89 },
  reviews: [{ author: 'Ana Lopez', rating: 5, body: 'Great grip.', positiveNotes: ['Grip', 'Weight'] }],
}

describe('productJsonLd', () => {
  it('builds Product with Offer, shipping, returns, rating and reviews', () => {
    const ld = productJsonLd(product)
    expect(ld).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Trail Runner 2',
      gtin: '0123456789012',
      brand: { '@type': 'Brand', name: 'Acme' },
      aggregateRating: { '@type': 'AggregateRating', ratingValue: 4.4, reviewCount: 89 },
    })
    expect(ld.offers).toEqual({
      '@type': 'Offer',
      price: 119.99,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      priceValidUntil: '2026-12-31',
      shippingDetails: [
        {
          '@type': 'OfferShippingDetails',
          shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'USD' },
          shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'US', addressRegion: ['NY', 'CA'] },
          deliveryTime: {
            '@type': 'ShippingDeliveryTime',
            handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
            transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 5, unitCode: 'DAY' },
          },
        },
      ],
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'US',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 30,
        returnMethod: ['https://schema.org/ReturnByMail'],
        returnFees: 'https://schema.org/FreeReturn',
      },
    })
    expect(ld.review).toEqual([
      {
        '@type': 'Review',
        author: { '@type': 'Person', name: 'Ana Lopez' },
        reviewRating: { '@type': 'Rating', ratingValue: 5, bestRating: 5 },
        reviewBody: 'Great grip.',
        positiveNotes: {
          '@type': 'ItemList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Grip' },
            { '@type': 'ListItem', position: 2, name: 'Weight' },
          ],
        },
      },
    ])
  })

  it('supports AggregateOffer and several offers', () => {
    expect(productJsonLd({ name: 'X', offers: { lowPrice: 10, highPrice: 20, currency: 'EUR', offerCount: 3 } }).offers).toEqual({
      '@type': 'AggregateOffer',
      lowPrice: 10,
      highPrice: 20,
      priceCurrency: 'EUR',
      offerCount: 3,
    })
    const many = productJsonLd({ name: 'X', offers: [{ price: 1, currency: 'EUR', seller: 'A' }, { price: 2, currency: 'EUR' }] })
    expect(many.offers).toHaveLength(2)
  })

  it('writes return policies by link, with fees, or not permitted', () => {
    expect(returnPolicyLd({ url: 'https://shop.dev/returns' })).toEqual({
      '@type': 'MerchantReturnPolicy',
      merchantReturnLink: 'https://shop.dev/returns',
    })
    expect(returnPolicyLd({ country: ['DE', 'AT'], category: 'finite', days: 14, fees: { amount: 4.95, currency: 'EUR' } })).toMatchObject({
      applicableCountry: ['DE', 'AT'],
      returnFees: 'https://schema.org/ReturnShippingFees',
      returnShippingFeesAmount: { '@type': 'MonetaryAmount', value: 4.95, currency: 'EUR' },
    })
    const none = returnPolicyLd({ country: 'US', category: 'notPermitted', days: 5 })
    expect(none.returnPolicyCategory).toBe('https://schema.org/MerchantReturnNotPermitted')
    expect(none).not.toHaveProperty('merchantReturnDays')
  })
})

describe('productOpenGraph and productSeo', () => {
  it('emits product Open Graph tags', () => {
    expect(productOpenGraph(product)).toEqual([
      { property: 'product:price:amount', content: '119.99' },
      { property: 'product:price:currency', content: 'USD' },
      { property: 'product:availability', content: 'in stock' },
      { property: 'product:condition', content: 'new' },
      { property: 'product:brand', content: 'Acme' },
      { property: 'product:retailer_item_id', content: 'TR2-42' },
    ])
  })

  it('spreads into seo() with og:type product and the JSON-LD', () => {
    const seo = defineSeo({ url: 'https://shop.dev', titleTemplate: '%s | Shop' })
    const { meta } = seo({ title: product.name, description: 'Mine wins.', path: '/p/trail-runner-2', ...productSeo(product) })
    expect(meta).toContainEqual({ property: 'og:type', content: 'product' })
    expect(meta).toContainEqual({ name: 'description', content: 'Mine wins.' })
    expect(meta).toContainEqual({ property: 'product:price:amount', content: '119.99' })
    expect(meta.some((m) => 'script:ld+json' in m && (m['script:ld+json'] as { '@type': string })['@type'] === 'Product')).toBe(true)
  })

  it('re-exports the core jsonLd helpers (breadcrumbs for category pages)', () => {
    expect(jsonLd.breadcrumbs([{ name: 'Shoes', url: 'https://shop.dev/shoes' }])['@type']).toBe('BreadcrumbList')
  })
})

describe('checkProduct', () => {
  it('passes a complete product', () => {
    expect(checkProduct(product, { merchantListing: true })).toEqual({ errors: [], warnings: [] })
  })

  it('reports missing required properties', () => {
    const { errors } = checkProduct({ name: ' ' }, { merchantListing: true })
    expect(errors).toEqual([
      'name is required',
      'one of offers, rating or reviews is required for product snippets',
      'image is required for merchant listings',
      'offers is required for merchant listings',
    ])
  })

  it('flags bad prices, currencies, shipping and ratings', () => {
    const { errors, warnings } = checkProduct({
      name: 'X',
      offers: {
        price: '$1,000',
        currency: 'usd',
        shipping: { rate: 5, currency: 'EUR', country: 'US' },
        returnPolicy: { country: 'US', category: 'finite' },
      },
      rating: { value: 6 },
    })
    expect(errors).toContain('offers.price must be a non-negative number without currency symbols or separators')
    expect(errors).toContain('offers.currency must be a 3-letter ISO 4217 code')
    expect(errors).toContain('offers.shipping[0].currency must match the offer currency (usd)')
    expect(errors).toContain('offers.shipping[0] needs handlingDays or transitDays (deliveryTime)')
    expect(errors).toContain('offers.returnPolicy.days is required for a finite return window')
    expect(errors).toContain('rating needs count or reviewCount')
    expect(errors).toContain('rating.value is outside best/worst')
    expect(warnings).toContain('offers.availability is recommended')
    expect(warnings).toContain('brand is recommended')
  })

  it('warns about AggregateOffer for merchant listings and offers missing beside ratings', () => {
    expect(checkProduct({ name: 'X', image: 'a.jpg', offers: { lowPrice: 1, currency: 'USD' } }, { merchantListing: true }).warnings).toContain(
      'offers: use Offer rather than AggregateOffer for merchant listings and price-drop results',
    )
    expect(checkProduct({ name: 'X', rating: { value: 4, count: 3 } }).warnings).toContain(
      'offers is recommended: the Rich Results Test warns without it',
    )
  })
})

describe('productSitemapEntries', () => {
  it('maps products to sitemap entries with images', () => {
    const items = [
      { slug: 'a', updated: '2026-10-01', images: ['https://cdn/a.jpg'] },
      { slug: 'b', updated: undefined, images: [] },
    ]
    expect(
      productSitemapEntries(items, { path: (p) => `/p/${p.slug}`, lastmod: (p) => p.updated, images: (p) => p.images, changefreq: 'daily' }),
    ).toEqual([
      { loc: '/p/a', lastmod: '2026-10-01', images: ['https://cdn/a.jpg'], changefreq: 'daily' },
      { loc: '/p/b', changefreq: 'daily' },
    ])
  })
})
