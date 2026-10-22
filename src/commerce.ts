import type { MetaTag, SeoInput } from './head'
import type { JsonLdObject } from './json-ld'
import type { SitemapEntry } from './sitemap'

export { jsonLd } from './json-ld'

const CONTEXT = 'https://schema.org'
const SCHEMA = 'https://schema.org/'

export type Availability =
  | 'InStock'
  | 'OutOfStock'
  | 'PreOrder'
  | 'PreSale'
  | 'BackOrder'
  | 'Discontinued'
  | 'LimitedAvailability'
  | 'InStoreOnly'
  | 'OnlineOnly'
  | 'SoldOut'

export type ItemCondition = 'NewCondition' | 'UsedCondition' | 'RefurbishedCondition' | 'DamagedCondition'

/** A price without currency symbols or thousands separators: `39.99` or `'39.99'`. */
export type Price = number | string

export interface ShippingInput {
  /** Shipping cost in `currency`; `0` for free shipping. */
  rate: Price
  /** ISO 4217 code; must match the offer's currency. */
  currency: string
  /** ISO 3166-1 alpha-2 country code(s). */
  country: string | string[]
  /** ISO 3166-2 subdivision codes without the country prefix (US, AU, JP only), e.g. `['NY', 'CA']`. */
  regions?: string[]
  /** Business days between order and dispatch, `[min, max]`. */
  handlingDays?: [number, number]
  /** Business days in transit, `[min, max]`. */
  transitDays?: [number, number]
}

export type ReturnPolicyInput =
  | {
      /** ISO 3166-1 alpha-2 country code(s) the policy applies to (up to 50). */
      country: string | string[]
      /** `finite` needs `days`. */
      category: 'finite' | 'unlimited' | 'notPermitted'
      days?: number
      fees?: 'free' | 'customer' | { amount: Price; currency: string }
      method?: Array<'mail' | 'store' | 'kiosk'>
      /** Optional link to the policy page. */
      url?: string
    }
  | {
      /** Only a link to the return policy page (Google's option B). */
      url: string
    }

export interface OfferInput {
  price: Price
  /** ISO 4217, e.g. `USD`. */
  currency: string
  availability?: Availability
  condition?: ItemCondition
  url?: string
  priceValidUntil?: string | Date
  sku?: string
  seller?: string
  shipping?: ShippingInput | ShippingInput[]
  returnPolicy?: ReturnPolicyInput
}

export interface AggregateOfferInput {
  lowPrice: Price
  highPrice?: Price
  currency: string
  offerCount?: number
  availability?: Availability
}

export interface RatingInput {
  /** Average rating, e.g. 4.4. */
  value: number
  /** Number of ratings; give this or `reviewCount` (or both). */
  count?: number
  reviewCount?: number
  best?: number
  worst?: number
}

export interface ReviewInput {
  /** A real person's or team's name (Google rejects names like "50% off"). */
  author: string
  /** Rating out of `best` (default 5). */
  rating: number
  best?: number
  worst?: number
  body?: string
  name?: string
  datePublished?: string | Date
  /** Pros and cons for editorial reviews (Google needs two statements in total). */
  positiveNotes?: string[]
  negativeNotes?: string[]
}

export interface ProductInput {
  name: string
  description?: string
  /** One or more absolute image URLs (required for merchant listings). */
  image?: string | string[]
  url?: string
  sku?: string
  mpn?: string
  /** GTIN-8/12/13/14 or ISBN; emitted as `gtin`. */
  gtin?: string
  brand?: string
  category?: string
  color?: string
  size?: string
  material?: string
  /** Product-group ID shared by variants. */
  groupId?: string
  /** One offer, several (e.g. sellers), or a price range. */
  offers?: OfferInput | OfferInput[] | AggregateOfferInput
  rating?: RatingInput
  reviews?: ReviewInput[]
  id?: string
}

/** Product JSON-LD (with Offer or AggregateOffer, ratings, reviews, shipping and returns) for Google product rich results. */
export function productJsonLd(p: ProductInput): JsonLdObject {
  return clean({
    '@context': CONTEXT,
    '@type': 'Product',
    '@id': p.id,
    name: p.name,
    description: p.description,
    image: p.image,
    url: p.url,
    sku: p.sku,
    mpn: p.mpn,
    gtin: p.gtin,
    brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined,
    category: p.category,
    color: p.color,
    size: p.size,
    material: p.material,
    inProductGroupWithID: p.groupId,
    offers: p.offers === undefined ? undefined : offersLd(p.offers),
    aggregateRating: p.rating ? aggregateRatingLd(p.rating) : undefined,
    review: p.reviews?.length ? p.reviews.map(reviewLd) : undefined,
  })
}

function offersLd(o: NonNullable<ProductInput['offers']>): JsonLdObject | JsonLdObject[] {
  if (Array.isArray(o)) return o.map(offerLd)
  return 'lowPrice' in o ? aggregateOfferLd(o) : offerLd(o)
}

/** One `Offer`. */
export function offerLd(o: OfferInput): JsonLdObject {
  const shipping = o.shipping === undefined ? undefined : Array.isArray(o.shipping) ? o.shipping : [o.shipping]
  return clean({
    '@type': 'Offer',
    price: o.price,
    priceCurrency: o.currency,
    availability: o.availability ? SCHEMA + o.availability : undefined,
    itemCondition: o.condition ? SCHEMA + o.condition : undefined,
    url: o.url,
    priceValidUntil: dateOnly(o.priceValidUntil),
    sku: o.sku,
    seller: o.seller ? { '@type': 'Organization', name: o.seller } : undefined,
    shippingDetails: shipping?.length ? shipping.map(shippingLd) : undefined,
    hasMerchantReturnPolicy: o.returnPolicy ? returnPolicyLd(o.returnPolicy) : undefined,
  })
}

/** An `AggregateOffer` (price range across sellers or variants). */
export function aggregateOfferLd(o: AggregateOfferInput): JsonLdObject {
  return clean({
    '@type': 'AggregateOffer',
    lowPrice: o.lowPrice,
    highPrice: o.highPrice,
    priceCurrency: o.currency,
    offerCount: o.offerCount,
    availability: o.availability ? SCHEMA + o.availability : undefined,
  })
}

export function aggregateRatingLd(r: RatingInput): JsonLdObject {
  return clean({
    '@type': 'AggregateRating',
    ratingValue: r.value,
    ratingCount: r.count,
    reviewCount: r.reviewCount,
    bestRating: r.best,
    worstRating: r.worst,
  })
}

export function reviewLd(r: ReviewInput): JsonLdObject {
  const notes = (items: string[] | undefined) =>
    items?.length
      ? {
          '@type': 'ItemList',
          itemListElement: items.map((name, i) => ({ '@type': 'ListItem', position: i + 1, name })),
        }
      : undefined
  return clean({
    '@type': 'Review',
    author: { '@type': 'Person', name: r.author },
    reviewRating: clean({ '@type': 'Rating', ratingValue: r.rating, bestRating: r.best ?? 5, worstRating: r.worst }),
    name: r.name,
    reviewBody: r.body,
    datePublished: dateOnly(r.datePublished),
    positiveNotes: notes(r.positiveNotes),
    negativeNotes: notes(r.negativeNotes),
  })
}

/** `OfferShippingDetails`. */
export function shippingLd(s: ShippingInput): JsonLdObject {
  const countries = Array.isArray(s.country) ? s.country : [s.country]
  const region = (country: string) => clean({ '@type': 'DefinedRegion', addressCountry: country, addressRegion: s.regions })
  const range = (days: [number, number] | undefined) =>
    days ? { '@type': 'QuantitativeValue', minValue: days[0], maxValue: days[1], unitCode: 'DAY' } : undefined
  return clean({
    '@type': 'OfferShippingDetails',
    shippingRate: { '@type': 'MonetaryAmount', value: s.rate, currency: s.currency },
    shippingDestination: countries.length === 1 ? region(countries[0]!) : countries.map(region),
    deliveryTime:
      s.handlingDays || s.transitDays
        ? clean({ '@type': 'ShippingDeliveryTime', handlingTime: range(s.handlingDays), transitTime: range(s.transitDays) })
        : undefined,
  })
}

/** `MerchantReturnPolicy`. Also usable on an Organization (`hasMerchantReturnPolicy`). */
export function returnPolicyLd(r: ReturnPolicyInput): JsonLdObject {
  if (!('country' in r)) return { '@type': 'MerchantReturnPolicy', merchantReturnLink: r.url }
  const category = {
    finite: 'MerchantReturnFiniteReturnWindow',
    unlimited: 'MerchantReturnUnlimitedWindow',
    notPermitted: 'MerchantReturnNotPermitted',
  }[r.category]
  const fees =
    r.fees === undefined
      ? {}
      : r.fees === 'free'
        ? { returnFees: `${SCHEMA}FreeReturn` }
        : r.fees === 'customer'
          ? { returnFees: `${SCHEMA}ReturnFeesCustomerResponsibility` }
          : {
              returnFees: `${SCHEMA}ReturnShippingFees`,
              returnShippingFeesAmount: { '@type': 'MonetaryAmount', value: r.fees.amount, currency: r.fees.currency },
            }
  const methods = { mail: 'ReturnByMail', store: 'ReturnInStore', kiosk: 'ReturnAtKiosk' } as const
  return clean({
    '@type': 'MerchantReturnPolicy',
    applicableCountry: r.country,
    returnPolicyCategory: SCHEMA + category,
    merchantReturnDays: r.category === 'finite' ? r.days : undefined,
    returnMethod: r.method?.length ? r.method.map((m) => SCHEMA + methods[m]) : undefined,
    merchantReturnLink: r.url,
    ...fees,
  })
}

const OG_AVAILABILITY: Record<Availability, string> = {
  InStock: 'in stock',
  OutOfStock: 'out of stock',
  PreOrder: 'preorder',
  PreSale: 'preorder',
  BackOrder: 'available for order',
  Discontinued: 'discontinued',
  LimitedAvailability: 'in stock',
  InStoreOnly: 'in stock',
  OnlineOnly: 'in stock',
  SoldOut: 'out of stock',
}
const OG_CONDITION: Record<ItemCondition, string> = {
  NewCondition: 'new',
  UsedCondition: 'used',
  RefurbishedCondition: 'refurbished',
  DamagedCondition: 'used',
}

/** Open Graph product tags: `product:price:amount`, `product:price:currency`, availability, condition, brand, item id. */
export function productOpenGraph(p: ProductInput): MetaTag[] {
  const meta: MetaTag[] = []
  const first = p.offers === undefined ? undefined : Array.isArray(p.offers) ? p.offers[0] : p.offers
  if (first) {
    const amount = 'lowPrice' in first ? first.lowPrice : first.price
    meta.push({ property: 'product:price:amount', content: String(amount) })
    meta.push({ property: 'product:price:currency', content: first.currency })
    if (first.availability) meta.push({ property: 'product:availability', content: OG_AVAILABILITY[first.availability] })
    if ('condition' in first && first.condition) meta.push({ property: 'product:condition', content: OG_CONDITION[first.condition] })
  }
  if (p.brand) meta.push({ property: 'product:brand', content: p.brand })
  if (p.sku) meta.push({ property: 'product:retailer_item_id', content: p.sku })
  if (p.groupId) meta.push({ property: 'product:item_group_id', content: p.groupId })
  return meta
}

/**
 * Everything a product page needs, as `seo()` options: `og:type` product, the product Open Graph tags
 * and the Product JSON-LD. Spread it into your call:
 *
 * ```ts
 * head: ({ loaderData: p }) => seo({ title: p.name, path: `/p/${p.slug}`, image: p.images[0], ...productSeo(p) })
 * ```
 */
export function productSeo(p: ProductInput): Pick<SeoInput, 'type' | 'meta' | 'jsonLd'> {
  return {
    type: 'product',
    meta: productOpenGraph(p),
    jsonLd: productJsonLd(p),
  }
}

export interface ProductCheck {
  /** Missing required properties: the page is not eligible for that rich result. */
  errors: string[]
  /** Missing recommended properties or values Google may reject. */
  warnings: string[]
}

/**
 * Check a product against Google's product snippet and merchant listing requirements
 * (as documented on 2026-10-22). Use it in tests or development; it does not throw.
 */
export function checkProduct(p: ProductInput, options: { merchantListing?: boolean } = {}): ProductCheck {
  const errors: string[] = []
  const warnings: string[] = []
  const offers = p.offers === undefined ? [] : Array.isArray(p.offers) ? p.offers : [p.offers]

  if (!p.name?.trim()) errors.push('name is required')
  if (!offers.length && !p.rating && !p.reviews?.length) {
    errors.push('one of offers, rating or reviews is required for product snippets')
  }
  if (options.merchantListing) {
    if (!p.image || (Array.isArray(p.image) && !p.image.length)) errors.push('image is required for merchant listings')
    if (!offers.length) errors.push('offers is required for merchant listings')
  }
  if (!p.offers && (p.rating || p.reviews?.length)) {
    warnings.push('offers is recommended: the Rich Results Test warns without it')
  }

  offers.forEach((o, i) => {
    const at = offers.length > 1 ? `offers[${i}]` : 'offers'
    if ('lowPrice' in o) {
      checkPrice(o.lowPrice, `${at}.lowPrice`, errors)
      if (o.highPrice !== undefined) checkPrice(o.highPrice, `${at}.highPrice`, errors)
      if (options.merchantListing) warnings.push(`${at}: use Offer rather than AggregateOffer for merchant listings and price-drop results`)
    } else {
      checkPrice(o.price, `${at}.price`, errors)
      if (!o.availability) warnings.push(`${at}.availability is recommended`)
      const ships = o.shipping === undefined ? [] : Array.isArray(o.shipping) ? o.shipping : [o.shipping]
      ships.forEach((s, j) => {
        if (s.currency !== o.currency) errors.push(`${at}.shipping[${j}].currency must match the offer currency (${o.currency})`)
        if (!s.handlingDays && !s.transitDays) errors.push(`${at}.shipping[${j}] needs handlingDays or transitDays (deliveryTime)`)
        checkPrice(s.rate, `${at}.shipping[${j}].rate`, errors)
      })
      if (o.returnPolicy && 'country' in o.returnPolicy && o.returnPolicy.category === 'finite' && !o.returnPolicy.days) {
        errors.push(`${at}.returnPolicy.days is required for a finite return window`)
      }
    }
    if (!/^[A-Z]{3}$/.test(o.currency)) errors.push(`${at}.currency must be a 3-letter ISO 4217 code`)
  })

  if (p.rating) {
    if (p.rating.count === undefined && p.rating.reviewCount === undefined) errors.push('rating needs count or reviewCount')
    const best = p.rating.best ?? 5
    if (p.rating.value > best || p.rating.value < (p.rating.worst ?? 1)) errors.push('rating.value is outside best/worst')
  }
  p.reviews?.forEach((r, i) => {
    if (!r.author.trim()) errors.push(`reviews[${i}].author is required`)
    const notes = (r.positiveNotes?.length ?? 0) + (r.negativeNotes?.length ?? 0)
    if (notes === 1) warnings.push(`reviews[${i}]: pros and cons need at least two statements in total`)
  })

  if (!p.brand) warnings.push('brand is recommended')
  if (!p.gtin && !p.mpn && !p.sku) warnings.push('a gtin, mpn or sku is recommended')
  if (!p.description) warnings.push('description is recommended')
  return { errors, warnings }
}

export interface ProductSitemapOptions<T> {
  /** Page path of a product. */
  path: (item: T) => string
  lastmod?: (item: T) => string | Date | undefined
  /** Image URLs for the sitemap's `<image:image>` entries. */
  images?: (item: T) => string[] | undefined
  changefreq?: SitemapEntry['changefreq']
  priority?: number
}

/** Map your products to sitemap entries (with image entries) for a `createSitemap` source. */
export function productSitemapEntries<T>(items: Iterable<T>, options: ProductSitemapOptions<T>): SitemapEntry[] {
  const out: SitemapEntry[] = []
  for (const item of items) {
    const lastmod = options.lastmod?.(item)
    const images = options.images?.(item)
    out.push(
      clean({
        loc: options.path(item),
        lastmod,
        images: images?.length ? images : undefined,
        changefreq: options.changefreq,
        priority: options.priority,
      }) as unknown as SitemapEntry,
    )
  }
  return out
}

function checkPrice(value: Price, at: string, errors: string[]) {
  const ok = typeof value === 'number' ? Number.isFinite(value) && value >= 0 : /^\d+(\.\d+)?$/.test(value)
  if (!ok) errors.push(`${at} must be a non-negative number without currency symbols or separators`)
}

function dateOnly(value: string | Date | undefined): string | undefined {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value
}

function clean(obj: Record<string, unknown>): JsonLdObject {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v
  return out as JsonLdObject
}
