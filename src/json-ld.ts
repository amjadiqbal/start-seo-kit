/** Any JSON value allowed inside a JSON-LD document. */
export type JsonLdValue = string | number | boolean | null | JsonLdValue[] | { [key: string]: JsonLdValue | undefined }

/** A JSON-LD node: an object with `@type` (and usually `@context`). */
export interface JsonLdObject {
  '@context'?: string | Record<string, JsonLdValue>
  '@type'?: string | string[]
  '@id'?: string
  '@graph'?: JsonLdObject[]
  [key: string]: JsonLdValue | JsonLdObject | JsonLdObject[] | undefined
}

const CONTEXT = 'https://schema.org'

type Ref = string | JsonLdObject

export interface PersonInput {
  name: string
  url?: string
  image?: string
  jobTitle?: string
  sameAs?: string[]
  id?: string
}

export interface OrganizationInput {
  name: string
  url?: string
  logo?: string
  sameAs?: string[]
  email?: string
  telephone?: string
  id?: string
  /** `Organization` (default) or a subtype such as `Corporation` or `LocalBusiness`. */
  type?: string
}

export interface WebSiteInput {
  name: string
  url: string
  /** Enables the sitelinks search box: a URL with `{search_term_string}`, e.g. `https://acme.dev/search?q={search_term_string}`. */
  searchUrlTemplate?: string
  publisher?: Ref
  inLanguage?: string
  id?: string
}

export interface ArticleLdInput {
  /** `Article` (default), `BlogPosting`, `NewsArticle` or `TechArticle`. */
  type?: 'Article' | 'BlogPosting' | 'NewsArticle' | 'TechArticle'
  headline: string
  description?: string
  url?: string
  image?: string | string[]
  datePublished?: string | Date
  dateModified?: string | Date
  author?: Ref | Ref[]
  publisher?: Ref
  keywords?: string[]
  id?: string
}

export interface BreadcrumbItem {
  name: string
  /** Absolute URL. Leave it out on the last (current) item if you like. */
  url?: string
}

export interface FaqItem {
  question: string
  /** Plain text or simple HTML. */
  answer: string
}

/**
 * Typed builders for common schema.org types. Each returns a JSON-LD object with `@context`.
 * Product, Offer, Review and return/shipping policies live in `@amjadiqbal/start-seo-kit/commerce`.
 */
export const jsonLd = {
  person(p: PersonInput): JsonLdObject {
    return clean({ '@context': CONTEXT, '@type': 'Person', '@id': p.id, name: p.name, url: p.url, image: p.image, jobTitle: p.jobTitle, sameAs: p.sameAs })
  },

  organization(o: OrganizationInput): JsonLdObject {
    return clean({
      '@context': CONTEXT,
      '@type': o.type ?? 'Organization',
      '@id': o.id,
      name: o.name,
      url: o.url,
      logo: o.logo,
      sameAs: o.sameAs,
      email: o.email,
      telephone: o.telephone,
    })
  },

  website(w: WebSiteInput): JsonLdObject {
    return clean({
      '@context': CONTEXT,
      '@type': 'WebSite',
      '@id': w.id,
      name: w.name,
      url: w.url,
      inLanguage: w.inLanguage,
      publisher: w.publisher === undefined ? undefined : ref(w.publisher, 'Organization'),
      potentialAction: w.searchUrlTemplate
        ? {
            '@type': 'SearchAction',
            target: { '@type': 'EntryPoint', urlTemplate: w.searchUrlTemplate },
            'query-input': 'required name=search_term_string',
          }
        : undefined,
    })
  },

  article(a: ArticleLdInput): JsonLdObject {
    const authors = a.author === undefined ? undefined : (Array.isArray(a.author) ? a.author : [a.author]).map((x) => ref(x, 'Person'))
    return clean({
      '@context': CONTEXT,
      '@type': a.type ?? 'Article',
      '@id': a.id,
      headline: a.headline,
      description: a.description,
      url: a.url,
      mainEntityOfPage: a.url,
      image: a.image,
      datePublished: date(a.datePublished),
      dateModified: date(a.dateModified),
      author: authors && authors.length === 1 ? authors[0] : authors,
      publisher: a.publisher === undefined ? undefined : ref(a.publisher, 'Organization'),
      keywords: a.keywords?.join(', '),
    })
  },

  breadcrumbs(items: BreadcrumbItem[]): JsonLdObject {
    return {
      '@context': CONTEXT,
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, i) =>
        clean({ '@type': 'ListItem', position: i + 1, name: item.name, item: item.url }),
      ),
    }
  },

  faq(items: FaqItem[]): JsonLdObject {
    return {
      '@context': CONTEXT,
      '@type': 'FAQPage',
      mainEntity: items.map((q) => ({
        '@type': 'Question',
        name: q.question,
        acceptedAnswer: { '@type': 'Answer', text: q.answer },
      })),
    }
  },

  /** Combine several nodes into one `@graph` document (their own `@context` is dropped). */
  graph(...nodes: JsonLdObject[]): JsonLdObject {
    return {
      '@context': CONTEXT,
      '@graph': nodes.map(({ '@context': _ctx, ...rest }) => rest as JsonLdObject),
    }
  },
}

function ref(value: Ref, type: string): JsonLdObject {
  if (typeof value !== 'string') {
    const { '@context': _ctx, ...rest } = value
    return rest as JsonLdObject
  }
  return /^https?:\/\//.test(value) ? { '@id': value } : { '@type': type, name: value }
}

function date(value: string | Date | undefined): string | undefined {
  return value instanceof Date ? value.toISOString() : value
}

function clean<T extends Record<string, unknown>>(obj: T): JsonLdObject {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v
  return out as JsonLdObject
}
