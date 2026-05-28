import { describe, it, expect } from 'vitest'
import * as jsJoda from '@js-joda/core'
// Side-effect imports: en-US CLDR text data + the full IANA tz database.
import '@js-joda/locale_en-us'
import '@js-joda/timezone'
import localePkg from '@js-joda/locale'
import { jsJodaLocalizer } from '../src/index'

const {
  Instant,
  LocalDate,
  LocalDateTime,
  LocalTime,
  ZonedDateTime,
  OffsetDateTime,
  ZoneId,
} = jsJoda

const { Locale } = localePkg as { Locale: { US: unknown } }

// Pin conversions to UTC so instant equality is deterministic everywhere.
const utcLoc = jsJodaLocalizer(jsJoda, { zone: ZoneId.of('UTC'), locale: Locale.US })

const utc = (
  y: number,
  m: number,
  d: number,
  h = 0,
  min = 0,
  s = 0,
  ms = 0
) => new Date(Date.UTC(y, m - 1, d, h, min, s, ms))

/**
 * react-big-calendar always hands the localizer `Date`s, but a robust js-joda
 * localizer should also cope with the wider family of js-joda temporal types,
 * epoch numbers, and ISO strings that callers naturally reach for.
 */
describe('input type coercion', () => {
  // The instant 2026-05-28T14:30:00Z expressed many different ways. Each must
  // be treated as the exact same moment.
  const reference = utc(2026, 5, 28, 14, 30)
  const sameMoment: Array<[string, unknown]> = [
    ['Date', reference],
    ['epoch millis (number)', reference.getTime()],
    ['Instant', Instant.ofEpochMilli(reference.getTime())],
    ['LocalDateTime', LocalDateTime.parse('2026-05-28T14:30')],
    ['ZonedDateTime (other zone)', ZonedDateTime.parse('2026-05-28T16:30+02:00[Europe/Paris]')],
    ['OffsetDateTime', OffsetDateTime.parse('2026-05-28T14:30+00:00')],
    ['ISO string with Z', '2026-05-28T14:30:00Z'],
    ['ISO string without zone', '2026-05-28T14:30'],
  ]

  it.each(sameMoment)('treats %s as the same instant', (_label, value) => {
    expect(utcLoc.eq(value as Date, reference)).toBe(true)
    expect(utcLoc.diff(value as Date, reference, 'minutes')).toBe(0)
    expect(utcLoc.format(value as Date, 'yyyy-MM-dd HH:mm')).toBe('2026-05-28 14:30')
  })

  it('treats a date-only LocalDate / ISO date as the start of that day', () => {
    expect(utcLoc.eq(LocalDate.parse('2026-05-28') as unknown as Date, utc(2026, 5, 28))).toBe(true)
    expect(utcLoc.eq('2026-05-28' as unknown as Date, utc(2026, 5, 28))).toBe(true)
  })

  it('uses only the time component of a LocalTime', () => {
    // The date defaults to "today" (zone-dependent), so assert the time only.
    expect(utcLoc.format(LocalTime.parse('14:30') as unknown as Date, 'HH:mm')).toBe('14:30')
  })

  it('mixes types freely within a single operation', () => {
    const start = Instant.ofEpochMilli(reference.getTime())
    const end = new Date(reference.getTime() + 90 * 60_000)
    expect(utcLoc.diff(start as unknown as Date, end, 'minutes')).toBe(90)
    expect(utcLoc.gt(end, LocalDateTime.parse('2026-05-28T14:30') as unknown as Date)).toBe(true)
  })

  it('arithmetic on a js-joda input still returns a JS Date', () => {
    const result = utcLoc.add(LocalDateTime.parse('2026-05-28T14:30') as unknown as Date, 1, 'day')
    expect(result).toBeInstanceOf(Date)
    expect(result).toEqual(utc(2026, 5, 29, 14, 30))
  })
})

describe('graceful handling of empty / invalid input', () => {
  it('does not throw on null / undefined (defaults to "now")', () => {
    expect(() => utcLoc.startOf(null as unknown as Date, 'day')).not.toThrow()
    expect(() => utcLoc.startOf(undefined as unknown as Date, 'minutes')).not.toThrow()
    expect(utcLoc.format(null as unknown as Date, 'yyyy')).toBe('')
    expect(utcLoc.format(undefined as unknown as Date, 'yyyy')).toBe('')
  })

  it('throws a clear TypeError for genuinely unsupported values', () => {
    expect(() => utcLoc.startOf(true as unknown as Date, 'day')).toThrow(TypeError)
    expect(() => utcLoc.startOf({} as unknown as Date, 'day')).toThrow(
      /js-joda-react-big-calendar-localizer/
    )
  })

  it('throws a clear TypeError for an unparseable string', () => {
    expect(() => utcLoc.startOf('not-a-date' as unknown as Date, 'day')).toThrow(
      /could not parse date string/
    )
  })
})

describe('leap years', () => {
  it('endOf month lands on Feb 29 in a leap year, Feb 28 otherwise', () => {
    expect(utcLoc.endOf(utc(2024, 2, 10), 'month')).toEqual(utc(2024, 2, 29, 23, 59, 59, 999))
    expect(utcLoc.endOf(utc(2025, 2, 10), 'month')).toEqual(utc(2025, 2, 28, 23, 59, 59, 999))
  })

  it('clamps month/year arithmetic that overflows a short month', () => {
    // Jan 31 + 1 month -> Feb 29 (leap) and Feb 28 (non-leap).
    expect(utcLoc.add(utc(2024, 1, 31), 1, 'month')).toEqual(utc(2024, 2, 29))
    expect(utcLoc.add(utc(2025, 1, 31), 1, 'month')).toEqual(utc(2025, 2, 28))
    // Feb 29 + 1 year -> Feb 28 of the following (non-leap) year.
    expect(utcLoc.add(utc(2024, 2, 29), 1, 'year')).toEqual(utc(2025, 2, 28))
  })

  it('range walks correctly across a leap day', () => {
    const days = utcLoc.range(utc(2024, 2, 28), utc(2024, 3, 1), 'day')
    expect(days).toEqual([utc(2024, 2, 28), utc(2024, 2, 29), utc(2024, 3, 1)])
  })
})

describe('DST-aware time zones (@js-joda/timezone)', () => {
  const nyLoc = jsJodaLocalizer(jsJoda, {
    zone: ZoneId.of('America/New_York'),
    locale: Locale.US,
  })

  // Build a Date for a specific wall-clock instant in New York.
  const ny = (iso: string) =>
    new Date(ZonedDateTime.parse(`${iso}[America/New_York]`).toInstant().toEpochMilli())

  it('reports the correct offset on each side of a transition', () => {
    // EST = UTC-5 (offset 300 min west), EDT = UTC-4 (240 min west).
    expect(nyLoc.getTimezoneOffset(ny('2026-01-15T12:00-05:00'))).toBe(300)
    expect(nyLoc.getTimezoneOffset(ny('2026-07-15T12:00-04:00'))).toBe(240)
  })

  it('getDstOffset captures the spring-forward hour', () => {
    const beforeDst = ny('2026-01-15T12:00-05:00')
    const afterDst = ny('2026-07-15T12:00-04:00')
    expect(nyLoc.getDstOffset(beforeDst, afterDst)).toBe(60)
  })

  it('adding a day across spring-forward preserves the wall-clock time', () => {
    // US spring-forward is 2026-03-08. Noon the day before + 1 day = noon after.
    const next = nyLoc.add(ny('2026-03-07T12:00-05:00'), 1, 'day')
    expect(nyLoc.format(next, 'yyyy-MM-dd HH:mm')).toBe('2026-03-08 12:00')
  })

  it('startOf day is local midnight even on a transition day', () => {
    const midnight = nyLoc.startOf(ny('2026-03-08T12:00-04:00'), 'day')
    expect(nyLoc.format(midnight, 'yyyy-MM-dd HH:mm')).toBe('2026-03-08 00:00')
  })
})

describe('a wide range of years formats correctly', () => {
  it('handles distant past and far future years', () => {
    // Built via js-joda because `Date.UTC(1, ...)` maps years 0-99 to 1900+yr.
    const year1 = LocalDate.of(1, 1, 1) as unknown as Date
    const year9999 = LocalDate.of(9999, 12, 31) as unknown as Date
    expect(utcLoc.format(year1, 'yyyy-MM-dd')).toBe('0001-01-01')
    expect(utcLoc.format(year9999, 'yyyy-MM-dd')).toBe('9999-12-31')
  })
})
