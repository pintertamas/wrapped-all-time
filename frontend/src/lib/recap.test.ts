import { describe, expect, it } from 'vitest'
import { sampleProfile, type TimeRange } from '../data/sampleProfile'
import { recap } from './recap'

const ranges: TimeRange[] = ['short_term', 'medium_term', 'long_term']

describe('sampleProfile', () => {
  it('has tops for every range and 50 recent plays', () => {
    for (const r of ranges) {
      expect(sampleProfile.topArtists[r].length).toBeGreaterThanOrEqual(5)
      expect(sampleProfile.topTracks[r].length).toBeGreaterThanOrEqual(5)
    }
    expect(sampleProfile.recentlyPlayed).toHaveLength(50)
  })
})

describe('recap', () => {
  it.each(ranges)('returns top 5 artists and tracks for %s', (r) => {
    const out = recap(sampleProfile, r)
    expect(out.topArtists).toHaveLength(5)
    expect(out.topTracks).toHaveLength(5)
    expect(out.topArtists[0]).toBe(sampleProfile.topArtists[r][0])
  })

  it('ranges differ', () => {
    expect(recap(sampleProfile, 'short_term').topArtists[0].id).not.toBe(
      recap(sampleProfile, 'long_term').topArtists[0].id,
    )
  })

  it('returns sorted genres', () => {
    const g = recap(sampleProfile, 'short_term').topGenres
    expect(g.length).toBeGreaterThan(0)
    for (let i = 1; i < g.length; i++) expect(g[i - 1].count).toBeGreaterThanOrEqual(g[i].count)
  })

  it('builds a 24-hour histogram summing to 50 plays', () => {
    const h = recap(sampleProfile, 'short_term').hourHistogram
    expect(h).toHaveLength(24)
    expect(h.reduce((a, b) => a + b, 0)).toBe(50)
  })

  it('exposes no minutes or play counts', () => {
    const keys = Object.keys(recap(sampleProfile, 'short_term'))
    expect(keys).not.toContain('minutes')
    expect(keys).not.toContain('playCount')
  })
})
