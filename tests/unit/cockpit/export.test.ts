import { describe, expect, it } from 'vitest'
import { leaderboardCsv, leaderboardPdf, type LeaderboardRow } from '@/lib/export/leaderboard'

const row = (over: Partial<LeaderboardRow> = {}): LeaderboardRow => ({
  rank: 1,
  name: 'Ibañez, Arlene',
  area: 'North',
  position: 'PSR',
  combi: 1_075_411,
  inhouse: 0,
  ethical: 1_075_411,
  calls: 56,
  combiPct: 0.0026885,
  pace: 'Behind',
  ...over,
})

describe('leaderboard CSV', () => {
  it('has a BOM, a header, and numbers that stay numbers', () => {
    const csv = leaderboardCsv([row()])
    expect(csv.startsWith('﻿')).toBe(true)
    const [header, line] = csv.slice(1).trim().split('\r\n')
    expect(header).toBe('Rank,Name,Area,Position,Combi (PHP),In-house (PHP),Ethical (PHP),Calls,Combi attainment %,Pace')
    expect(line).toBe('1,"Ibañez, Arlene",North,PSR,10754.11,0.00,10754.11,56,0.3,Behind')
  })

  it('quotes awkward names and leaves unranked / no-target cells empty', () => {
    const csv = leaderboardCsv([row({ rank: null, name: 'Cruz "Dan", Daniel', combiPct: null })])
    expect(csv).toContain(',"Cruz ""Dan"", Daniel",')
    expect(csv.trim().endsWith(',,Behind')).toBe(true)
    expect(csv.split('\r\n')[1].startsWith(',')).toBe(true)
  })
})

describe('leaderboard PDF', () => {
  it('produces a PDF', async () => {
    const bytes = new Uint8Array(await leaderboardPdf([row(), row({ rank: 2, name: 'Cruz, Daniel' })], 'Leaderboard', 'All areas · PSR'))
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(2000)
  })
})
