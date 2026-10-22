import { describe, expect, it } from 'vitest'
import { jsonLd } from '../src'

describe('jsonLd', () => {
  it('builds an article with authors and publisher, dropping undefined fields', () => {
    const a = jsonLd.article({
      type: 'BlogPosting',
      headline: 'Hello',
      url: 'https://acme.dev/hello',
      datePublished: new Date('2026-01-02T03:04:05Z'),
      author: 'Ana',
      publisher: jsonLd.organization({ name: 'Acme', logo: 'https://acme.dev/logo.png' }),
      keywords: ['a', 'b'],
    })
    expect(a).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: 'Hello',
      url: 'https://acme.dev/hello',
      mainEntityOfPage: 'https://acme.dev/hello',
      datePublished: '2026-01-02T03:04:05.000Z',
      author: { '@type': 'Person', name: 'Ana' },
      publisher: { '@type': 'Organization', name: 'Acme', logo: 'https://acme.dev/logo.png' },
      keywords: 'a, b',
    })
  })

  it('references authors by URL and keeps several', () => {
    const a = jsonLd.article({ headline: 'H', author: ['https://acme.dev/#ana', 'Bo'] })
    expect(a.author).toEqual([{ '@id': 'https://acme.dev/#ana' }, { '@type': 'Person', name: 'Bo' }])
  })

  it('builds breadcrumbs with positions', () => {
    const b = jsonLd.breadcrumbs([{ name: 'Home', url: 'https://acme.dev/' }, { name: 'Blog' }])
    expect(b.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://acme.dev/' },
      { '@type': 'ListItem', position: 2, name: 'Blog' },
    ])
  })

  it('builds a website with a search action, an FAQ page and a person', () => {
    const w = jsonLd.website({ name: 'Acme', url: 'https://acme.dev', searchUrlTemplate: 'https://acme.dev/s?q={search_term_string}' })
    expect(w.potentialAction).toMatchObject({ '@type': 'SearchAction', 'query-input': 'required name=search_term_string' })
    const f = jsonLd.faq([{ question: 'Q?', answer: 'A.' }])
    expect(f.mainEntity).toEqual([{ '@type': 'Question', name: 'Q?', acceptedAnswer: { '@type': 'Answer', text: 'A.' } }])
    expect(jsonLd.person({ name: 'Ana', sameAs: ['https://x.com/ana'] })).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Ana',
      sameAs: ['https://x.com/ana'],
    })
  })

  it('combines nodes into a graph', () => {
    const g = jsonLd.graph(jsonLd.organization({ name: 'Acme', id: 'https://acme.dev/#org' }), jsonLd.website({ name: 'Acme', url: 'https://acme.dev', publisher: { '@id': 'https://acme.dev/#org' } }))
    expect(g['@context']).toBe('https://schema.org')
    expect(g['@graph']).toHaveLength(2)
    expect(g['@graph']?.[0]).not.toHaveProperty('@context')
    expect(g['@graph']?.[1]?.publisher).toEqual({ '@id': 'https://acme.dev/#org' })
  })
})
