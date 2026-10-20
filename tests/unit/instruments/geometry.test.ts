import { describe, expect, it } from 'vitest'
import {
  angleFor,
  arcPath,
  END_DEG,
  needleSegment,
  numeralBox,
  numerals,
  polar,
  R,
  READOUT,
  rectsOverlap,
  segmentHitsRect,
  START_DEG,
  ticks,
} from '@/lib/instruments/geometry'

/* "Speedometer shows the percentage as a large digital readout inside the open
 * lower wedge … never underneath the needle sweep. Verify nothing overlaps at
 * all sizes." The dial is drawn in unit space and scaled by a viewBox, so
 * proving it here proves it at every size. */

describe('dial geometry', () => {
  it('maps the scale onto a 240° sweep and pins out-of-range values', () => {
    expect(angleFor(0, 0, 1.2)).toBe(START_DEG)
    expect(angleFor(1.2, 0, 1.2)).toBe(END_DEG)
    expect(angleFor(0.6, 0, 1.2)).toBeCloseTo(0, 10)
    expect(angleFor(1.34, 0, 1.2)).toBe(END_DEG)
    expect(angleFor(-0.2, 0, 1.2)).toBe(START_DEG)
  })

  it('puts 12 o’clock up and 3 o’clock right', () => {
    expect(polar(1, 0).y).toBeCloseTo(-1, 10)
    expect(polar(1, 90).x).toBeCloseTo(1, 10)
  })

  it('marks majors and minors', () => {
    const t = ticks(0, 1.2, 0.2, 0.05)
    expect(t).toHaveLength(25)
    expect(t.filter((x) => x.major)).toHaveLength(7)
  })

  it('draws arcs with the large-arc flag past 180°', () => {
    expect(arcPath(1, -120, 120)).toContain(' 0 1 1 ')
    expect(arcPath(1, -120, 0)).toContain(' 0 0 1 ')
    expect(arcPath(1, 10, 10)).toBe('')
  })
})

describe('the readout never sits under the needle', () => {
  const values = Array.from({ length: 601 }, (_, i) => (i / 600) * 1.2)

  it('for every needle position from 0% to the pinned end', () => {
    const hits = values.filter((v) => {
      const [tail, tip] = needleSegment(angleFor(v, 0, 1.2))
      return segmentHitsRect(tail, tip, READOUT, 0.04) // ~needle half-width plus air
    })
    expect(hits).toEqual([])
  })

  it('is clear of the hub and the counterweight tail pointing straight down', () => {
    expect(READOUT.y).toBeGreaterThan(R.tail + 0.1)
    expect(READOUT.y).toBeGreaterThan(R.hub)
  })

  it('stays clear of every numeral and inside the dial face', () => {
    for (const n of numerals(0, 1.2, 0.2, (v) => String(Math.round(v * 100)))) {
      expect(rectsOverlap(numeralBox(n.at, n.text), READOUT)).toBe(false)
    }
    const corners = [
      { x: READOUT.x, y: READOUT.y + READOUT.height },
      { x: READOUT.x + READOUT.width, y: READOUT.y + READOUT.height },
    ]
    for (const c of corners) expect(Math.hypot(c.x, c.y)).toBeLessThan(R.face)
  })

  it('stays clear of the value arc and the ticks', () => {
    for (const deg of Array.from({ length: 241 }, (_, i) => START_DEG + i)) {
      const arcPoint = polar(R.arc, deg)
      const tick = [polar(R.tickInner, deg), polar(R.tickOuter, deg)] as const
      expect(segmentHitsRect(arcPoint, arcPoint, READOUT, 0.02)).toBe(false)
      expect(segmentHitsRect(tick[0], tick[1], READOUT, 0.02)).toBe(false)
    }
  })

  it('detects a real overlap (the check itself works)', () => {
    const [tail, tip] = needleSegment(180) // pointing straight down, into the wedge
    expect(segmentHitsRect(tail, tip, READOUT)).toBe(true)
  })
})
