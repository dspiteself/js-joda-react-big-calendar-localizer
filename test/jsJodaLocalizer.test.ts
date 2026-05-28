import { describe, it, expect, beforeAll } from 'vitest'
import * as jsJoda from '@js-joda/core'
// Side-effect import: registers the en-US CLDR data and augments
// @js-joda/core's DateTimeFormatter with localized-text support.
import '@js-joda/locale_en-us'
import localePkg from '@js-joda/locale'
import { jsJodaLocalizer, defaultFormats } from '../src/index'

const { Locale } = localePkg as { Locale: { US: unknown } }

// All tests pin the conversion zone to UTC so they are deterministic
// regardless of the machine running them.
const ZONE = jsJoda.ZoneId.of('UTC')

let localizer: ReturnType<typeof jsJodaLocalizer>

beforeAll(() => {
  localizer = jsJodaLocalizer(jsJoda, {
    zone: ZONE,
    locale: Locale.US,
    firstDayOfWeek: 0,
  })
})

// Helper to build a UTC date.
const utc = (
  y: number,
  m: number,
  d: number,
  h = 0,
  min = 0,
  s = 0,
  ms = 0
) => new Date(Date.UTC(y, m - 1, d, h, min, s, ms))

describe('jsJodaLocalizer construction', () => {
  it('returns a DateLocalizer-like object with the expected API', () => {
    expect(typeof localizer.format).toBe('function')
    expect(typeof localizer.startOf).toBe('function')
    expect(typeof localizer.add).toBe('function')
    expect(localizer.formats).toBeTypeOf('object')
  })

  it('merges custom formats over the defaults', () => {
    const custom = jsJodaLocalizer(jsJoda, {
      zone: ZONE,
      locale: Locale.US,
      formats: { dateFormat: 'd' },
    })
    expect((custom.formats as Record<string, unknown>).dateFormat).toBe('d')
    // Untouched defaults remain.
    expect((custom.formats as Record<string, unknown>).monthHeaderFormat).toBe(
      'MMMM yyyy'
    )
  })
})

describe('formatting', () => {
  it('formats numeric patterns', () => {
    expect(localizer.format(utc(2026, 5, 28, 9, 5), 'yyyy-MM-dd HH:mm')).toBe(
      '2026-05-28 09:05'
    )
  })

  it('formats localized text patterns (month / weekday names)', () => {
    expect(localizer.format(utc(2026, 5, 28), 'MMMM yyyy')).toBe('May 2026')
    // 2026-05-28 is a Thursday.
    expect(localizer.format(utc(2026, 5, 28), 'EEEE')).toBe('Thursday')
  })

  it('uses default formats from the localizer', () => {
    expect(defaultFormats.monthHeaderFormat).toBe('MMMM yyyy')
  })
})

describe('arithmetic', () => {
  it('adds days, months and years', () => {
    expect(localizer.add(utc(2026, 1, 31), 1, 'day')).toEqual(utc(2026, 2, 1))
    expect(localizer.add(utc(2026, 1, 31), 1, 'month')).toEqual(utc(2026, 2, 28))
    expect(localizer.add(utc(2026, 5, 28), 2, 'year')).toEqual(utc(2028, 5, 28))
  })

  it('computes startOf and endOf for various units', () => {
    expect(localizer.startOf(utc(2026, 5, 28, 13, 45, 30), 'day')).toEqual(
      utc(2026, 5, 28)
    )
    expect(localizer.startOf(utc(2026, 5, 28, 13, 45), 'month')).toEqual(
      utc(2026, 5, 1)
    )
    expect(localizer.endOf(utc(2026, 5, 15), 'month')).toEqual(
      utc(2026, 5, 31, 23, 59, 59, 999)
    )
  })

  it('startOf week respects firstDayOfWeek = Sunday', () => {
    // 2026-05-28 is Thursday; the preceding Sunday is 2026-05-24.
    expect(localizer.startOf(utc(2026, 5, 28), 'week')).toEqual(utc(2026, 5, 24))
  })

  it('startOf week respects a Monday firstDayOfWeek', () => {
    const mon = jsJodaLocalizer(jsJoda, { zone: ZONE, firstDayOfWeek: 1 })
    // The Monday preceding Thursday 2026-05-28 is 2026-05-25.
    expect(mon.startOf(utc(2026, 5, 28), 'week')).toEqual(utc(2026, 5, 25))
  })

  it('diff returns (b - a)', () => {
    expect(localizer.diff(utc(2026, 5, 1), utc(2026, 5, 11), 'day')).toBe(10)
    expect(localizer.diff(utc(2026, 5, 11), utc(2026, 5, 1), 'day')).toBe(-10)
    expect(
      localizer.diff(utc(2026, 5, 1, 0, 0), utc(2026, 5, 1, 1, 30), 'minutes')
    ).toBe(90)
  })

  it('range produces an inclusive list of days', () => {
    const days = localizer.range(utc(2026, 5, 1), utc(2026, 5, 3), 'day')
    expect(days).toEqual([utc(2026, 5, 1), utc(2026, 5, 2), utc(2026, 5, 3)])
  })

  it('ceil rounds up to the next unit boundary', () => {
    expect(localizer.ceil(utc(2026, 5, 28, 1), 'day')).toEqual(utc(2026, 5, 29))
    expect(localizer.ceil(utc(2026, 5, 28), 'day')).toEqual(utc(2026, 5, 28))
  })

  it('merge combines a date and a time', () => {
    const merged = localizer.merge(utc(2026, 5, 28), utc(2000, 1, 1, 14, 30))
    expect(merged).toEqual(utc(2026, 5, 28, 14, 30))
  })

  it('min / max pick the correct date', () => {
    expect(localizer.min(utc(2026, 5, 1), utc(2026, 5, 2))).toEqual(utc(2026, 5, 1))
    expect(localizer.max(utc(2026, 5, 1), utc(2026, 5, 2))).toEqual(utc(2026, 5, 2))
  })
})

describe('comparisons', () => {
  it('eq / neq honor units', () => {
    expect(localizer.eq(utc(2026, 5, 28, 9), utc(2026, 5, 28, 17), 'day')).toBe(true)
    expect(localizer.neq(utc(2026, 5, 28), utc(2026, 5, 29), 'day')).toBe(true)
  })

  it('gt / lt / gte / lte', () => {
    expect(localizer.gt(utc(2026, 5, 29), utc(2026, 5, 28))).toBe(true)
    expect(localizer.lt(utc(2026, 5, 28), utc(2026, 5, 29))).toBe(true)
    expect(localizer.gte(utc(2026, 5, 28), utc(2026, 5, 28))).toBe(true)
    expect(localizer.lte(utc(2026, 5, 28), utc(2026, 5, 28))).toBe(true)
  })

  it('inRange is inclusive', () => {
    expect(
      localizer.inRange(utc(2026, 5, 15), utc(2026, 5, 1), utc(2026, 5, 31), 'day')
    ).toBe(true)
    expect(
      localizer.inRange(utc(2026, 6, 1), utc(2026, 5, 1), utc(2026, 5, 31), 'day')
    ).toBe(false)
  })
})

describe('visible days', () => {
  it('firstVisibleDay / lastVisibleDay frame the month grid', () => {
    // May 2026: 1st is a Friday. With Sunday-start weeks the grid begins
    // 2026-04-26 (Sunday). May 31 is a Sunday, so the grid ends 2026-06-06.
    expect(localizer.firstVisibleDay(utc(2026, 5, 15))).toEqual(utc(2026, 4, 26))
    const last = localizer.lastVisibleDay(utc(2026, 5, 15))
    expect(localizer.startOf(last, 'day')).toEqual(utc(2026, 6, 6))
  })

  it('visibleDays returns a whole number of weeks', () => {
    const days = localizer.visibleDays(utc(2026, 5, 15))
    expect(days.length % 7).toBe(0)
    expect(days[0]).toEqual(utc(2026, 4, 26))
  })
})

describe('event helpers', () => {
  it('sortEvents orders by start day then duration', () => {
    const evtA = { start: utc(2026, 5, 28, 9), end: utc(2026, 5, 28, 10) }
    const evtB = { start: utc(2026, 5, 28, 8), end: utc(2026, 5, 30, 10) }
    // evtB starts earlier in the day-grid sort, so it should sort first.
    expect(localizer.sortEvents({ evtA, evtB })).toBeGreaterThan(0)
  })

  it('inEventRange detects overlap', () => {
    const event = { start: utc(2026, 5, 28, 9), end: utc(2026, 5, 28, 10) }
    const range = { start: utc(2026, 5, 28, 0), end: utc(2026, 5, 28, 23, 59) }
    expect(localizer.inEventRange({ event, range })).toBe(true)

    const outOfRange = { start: utc(2026, 6, 1, 0), end: utc(2026, 6, 1, 23, 59) }
    expect(localizer.inEventRange({ event, range: outOfRange })).toBe(false)
  })

  it('isSameDate compares by day', () => {
    expect(localizer.isSameDate(utc(2026, 5, 28, 1), utc(2026, 5, 28, 23))).toBe(true)
    expect(localizer.isSameDate(utc(2026, 5, 28), utc(2026, 5, 29))).toBe(false)
  })
})
