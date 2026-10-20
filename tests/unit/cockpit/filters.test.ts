import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, isDefault, parseFilters, selectionOf, serializeFilters, summaryLine } from '@/lib/cockpit/filters'

describe('cockpit filters in the URL', () => {
  it('reads the brief’s example and writes it back', () => {
    const filters = parseFilters({ area: 'north,caraga', top: '3', metric: 'combi' })
    expect(filters).toMatchObject({ areas: ['north', 'caraga'], roles: ['psr'], top: 3, metric: 'combi', span: 'qtd' })
    expect(serializeFilters(filters)).toEqual({ area: 'north,caraga', top: '3' })
  })

  it('keeps the default view’s URL bare', () => {
    expect(serializeFilters(DEFAULT_FILTERS)).toEqual({})
    expect(isDefault(parseFilters({}))).toBe(true)
  })

  it('treats all three areas as "All"', () => {
    expect(parseFilters({ area: 'north,south,caraga' }).areas).toEqual([])
  })

  it('ignores junk rather than breaking the page', () => {
    const filters = parseFilters({ pq: 'last-year', area: 'mars,NORTH', top: '7', metric: 'vibes', span: 'm9', role: 'boss' })
    expect(filters).toEqual({ ...DEFAULT_FILTERS, areas: ['north'] })
  })

  it('maps the period span to a metrics selection', () => {
    expect(selectionOf('qtd')).toEqual({ kind: 'qtd' })
    expect(selectionOf('m2')).toEqual({ kind: 'month', month: 2 })
  })

  it('summarises the view in one readable line', () => {
    const filters = parseFilters({ area: 'north,caraga', top: '5' })
    expect(summaryLine(filters, 4, [10, 11, 12])).toBe('North + Caraga · PSR · Q4 total · Top 5 by combi')
    const month = parseFilters({ span: 'm2', dir: 'bottom', top: '3', metric: 'calls', role: 'psr,supervisor' })
    expect(summaryLine(month, 4, [10, 11, 12])).toBe('All areas · PSR + Supervisor · November · Bottom 3 by calls')
  })
})
