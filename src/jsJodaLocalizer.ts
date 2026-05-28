import { DateLocalizer } from 'react-big-calendar'
import type {
  ChronoUnit as ChronoUnitT,
  ZonedDateTime,
  ZoneId,
} from '@js-joda/core'

/**
 * The subset of the `@js-joda/core` module that this localizer relies on.
 *
 * The module is passed in by the consumer (rather than imported directly) so
 * that there is a single js-joda instance in the application. This matters
 * because `@js-joda/locale` and `@js-joda/timezone` augment the *same* module
 * object at runtime — passing your already-extended module in is what enables
 * localized text (month / weekday names, AM/PM) and named time zones.
 *
 * `typeof import('@js-joda/core')` is used as the type so you get full
 * type-checking against whichever version you have installed.
 */
export type JsJodaModule = typeof import('@js-joda/core')

/**
 * A `@js-joda/locale` `Locale` instance, e.g. `Locale.US`. Typed loosely so the
 * (optional) locale package does not need to be installed to use this package.
 */
export type JsJodaLocale = unknown

export interface JsJodaLocalizerOptions {
  /**
   * The zone all `Date` <-> js-joda conversions happen in. Defaults to
   * `ZoneId.systemDefault()`, which matches how react-big-calendar's other
   * localizers behave (wall-clock time in the browser's zone).
   */
  zone?: ZoneId

  /**
   * A `@js-joda/locale` `Locale` used when formatting patterns that contain
   * text fields (`MMMM`, `EEEE`, `a`, ...). Required for the default `formats`
   * to render month / weekday names. Omit it if you only use numeric patterns.
   */
  locale?: JsJodaLocale

  /**
   * First day of the week, in JavaScript `Date#getDay` numbering
   * (0 = Sunday ... 6 = Saturday). Defaults to `0` (Sunday).
   */
  firstDayOfWeek?: number

  /**
   * Override / extend the default `formats` map. Values are either java.time
   * pattern strings or `(range, culture, localizer) => string` functions, just
   * like every other react-big-calendar localizer.
   */
  formats?: Record<string, unknown>
}

type Unit =
  | 'millisecond'
  | 'second'
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'year'
  | undefined

function normalizeUnit(unit?: string | null): Unit {
  if (!unit) return undefined
  switch (String(unit).toLowerCase()) {
    case 'milliseconds':
    case 'millisecond':
      return 'millisecond'
    case 'seconds':
    case 'second':
      return 'second'
    case 'minutes':
    case 'minute':
      return 'minute'
    case 'hours':
    case 'hour':
      return 'hour'
    case 'day':
    case 'days':
    case 'date':
      return 'day'
    case 'week':
    case 'weeks':
      return 'week'
    case 'month':
    case 'months':
      return 'month'
    case 'year':
    case 'years':
    case 'fullyear':
      return 'year'
    default:
      // Unknown unit — fall back to a full-precision comparison.
      return undefined
  }
}

/**
 * Build a react-big-calendar `DateLocalizer` backed by js-joda.
 *
 * @example
 * import { ZoneId } from '@js-joda/core'
 * import * as jsJoda from '@js-joda/core'
 * import { Locale } from '@js-joda/locale_en-us'
 * import { jsJodaLocalizer } from 'js-joda-react-big-calendar-localizer'
 *
 * const localizer = jsJodaLocalizer(jsJoda, { locale: Locale.US })
 */
export function jsJodaLocalizer(
  jsJoda: JsJodaModule,
  options: JsJodaLocalizerOptions = {}
): DateLocalizer {
  const {
    Instant,
    ZoneId,
    ChronoUnit,
    DateTimeFormatter,
  } = jsJoda

  const zone: ZoneId = options.zone ?? ZoneId.systemDefault()
  const locale = options.locale
  const firstDayOfWeek = options.firstDayOfWeek ?? 0

  /* -------------------------------------------------------------------- *
   *  Date <-> js-joda conversions (always through the configured zone)   *
   * -------------------------------------------------------------------- */

  // react-big-calendar occasionally calls localizer methods with a null /
  // undefined date (e.g. TimeSlots' cache-key builder). The moment / dayjs
  // localizers tolerate this, so we default to "now" rather than throwing.
  const toZdt = (date: Date | null | undefined): ZonedDateTime =>
    Instant.ofEpochMilli((date ?? new Date()).getTime()).atZone(zone)

  const toDate = (zdt: ZonedDateTime): Date =>
    new Date(zdt.toInstant().toEpochMilli())

  const chronoFor = (unit: Exclude<Unit, undefined>): ChronoUnitT => {
    switch (unit) {
      case 'millisecond':
        return ChronoUnit.MILLIS
      case 'second':
        return ChronoUnit.SECONDS
      case 'minute':
        return ChronoUnit.MINUTES
      case 'hour':
        return ChronoUnit.HOURS
      case 'day':
        return ChronoUnit.DAYS
      case 'week':
        return ChronoUnit.WEEKS
      case 'month':
        return ChronoUnit.MONTHS
      case 'year':
        return ChronoUnit.YEARS
    }
  }

  /* -------------------------------------------------------------------- *
   *  Arithmetic                                                          *
   * -------------------------------------------------------------------- */

  function add(date: Date, amount: number, unit?: string): Date {
    const u = normalizeUnit(unit) ?? 'millisecond'
    return toDate(toZdt(date).plus(amount, chronoFor(u)))
  }

  function startOfWeekDate(zdt: ZonedDateTime): ZonedDateTime {
    // js-joda DayOfWeek: MON=1..SUN=7. `% 7` maps to JS getDay (SUN=0..SAT=6).
    const jsDow = zdt.dayOfWeek().value() % 7
    const diff = (jsDow - firstDayOfWeek + 7) % 7
    return zdt.toLocalDate().minusDays(diff).atStartOfDay(zone)
  }

  function startOf(date: Date, unit?: string): Date {
    const u = normalizeUnit(unit)
    if (!u) return toDate(toZdt(date))
    const zdt = toZdt(date)
    switch (u) {
      case 'millisecond':
        return toDate(zdt)
      case 'second':
        return toDate(zdt.truncatedTo(ChronoUnit.SECONDS))
      case 'minute':
        return toDate(zdt.truncatedTo(ChronoUnit.MINUTES))
      case 'hour':
        return toDate(zdt.truncatedTo(ChronoUnit.HOURS))
      case 'day':
        return toDate(zdt.toLocalDate().atStartOfDay(zone))
      case 'week':
        return toDate(startOfWeekDate(zdt))
      case 'month':
        return toDate(zdt.toLocalDate().withDayOfMonth(1).atStartOfDay(zone))
      case 'year':
        return toDate(
          zdt.toLocalDate().withDayOfMonth(1).withMonth(1).atStartOfDay(zone)
        )
    }
  }

  function endOf(date: Date, unit?: string): Date {
    const u = normalizeUnit(unit)
    if (!u) return toDate(toZdt(date))
    // End of a period is one millisecond before the start of the next period.
    const start = startOf(date, u)
    return new Date(add(start, 1, u).getTime() - 1)
  }

  function range(start: Date, end: Date, unit = 'day'): Date[] {
    const u = normalizeUnit(unit) ?? 'day'
    const days: Date[] = []
    let current = new Date(start.getTime())
    while (lte(current, end)) {
      days.push(current)
      current = add(current, 1, u)
    }
    return days
  }

  function ceil(date: Date, unit?: string): Date {
    const floor = startOf(date, unit)
    return floor.getTime() === date.getTime() ? floor : add(floor, 1, unit)
  }

  function diff(a: Date, b: Date, unit = 'day'): number {
    const u = normalizeUnit(unit) ?? 'day'
    // Matches the other localizers: returns (b - a), can be negative.
    return chronoFor(u).between(toZdt(a), toZdt(b))
  }

  function minutes(date: Date): number {
    return toZdt(date).minute()
  }

  function merge(date: Date | null, time: Date | null): Date | null {
    if (!date && !time) return null
    const datePart = toZdt(date ?? time!).toLocalDate()
    const timePart = toZdt(time ?? date!).toLocalTime()
    return toDate(datePart.atTime(timePart).atZone(zone))
  }

  function min(a: Date, b: Date): Date {
    return toZdt(a).isBefore(toZdt(b)) ? new Date(a.getTime()) : new Date(b.getTime())
  }

  function max(a: Date, b: Date): Date {
    return toZdt(a).isAfter(toZdt(b)) ? new Date(a.getTime()) : new Date(b.getTime())
  }

  /* -------------------------------------------------------------------- *
   *  Comparisons                                                         *
   * -------------------------------------------------------------------- */

  function compare(a: Date, b: Date, unit?: string): number {
    const u = normalizeUnit(unit)
    const za = u ? toZdt(startOf(a, u)) : toZdt(a)
    const zb = u ? toZdt(startOf(b, u)) : toZdt(b)
    return za.compareTo(zb)
  }

  const eq = (a: Date, b: Date, unit?: string) => compare(a, b, unit) === 0
  const neq = (a: Date, b: Date, unit?: string) => !eq(a, b, unit)
  const gt = (a: Date, b: Date, unit?: string) => compare(a, b, unit) > 0
  const lt = (a: Date, b: Date, unit?: string) => compare(a, b, unit) < 0
  const gte = (a: Date, b: Date, unit?: string) => compare(a, b, unit) >= 0
  const lte = (a: Date, b: Date, unit?: string) => compare(a, b, unit) <= 0

  function inRange(day: Date, minDate: Date, maxDate: Date, unit = 'day'): boolean {
    return gte(day, minDate, unit) && lte(day, maxDate, unit)
  }

  /* -------------------------------------------------------------------- *
   *  Week / month visibility                                             *
   * -------------------------------------------------------------------- */

  function firstOfWeek(): number {
    return firstDayOfWeek
  }

  function firstVisibleDay(date: Date): Date {
    return startOf(startOf(date, 'month'), 'week')
  }

  function lastVisibleDay(date: Date): Date {
    return endOf(endOf(date, 'month'), 'week')
  }

  function visibleDays(date: Date): Date[] {
    let current = firstVisibleDay(date)
    const last = lastVisibleDay(date)
    const days: Date[] = []
    while (lte(current, last)) {
      days.push(current)
      current = add(current, 1, 'day')
    }
    return days
  }

  /* -------------------------------------------------------------------- *
   *  Time-slot / DST helpers                                             *
   * -------------------------------------------------------------------- */

  function getTimezoneOffset(date: Date): number {
    return date.getTimezoneOffset()
  }

  function getDstOffset(start: Date, end: Date): number {
    return start.getTimezoneOffset() - end.getTimezoneOffset()
  }

  function getDayStartDstOffset(start: Date): number {
    return getDstOffset(startOf(start, 'day'), start)
  }

  function getSlotDate(
    dt: Date,
    minutesFromMidnight: number,
    offset: number
  ): Date {
    return add(startOf(dt, 'day'), minutesFromMidnight + offset, 'minutes')
  }

  function getTotalMin(start: Date, end: Date): number {
    return diff(start, end, 'minutes')
  }

  function getMinutesFromMidnight(start: Date): number {
    const dayStart = startOf(start, 'day')
    return diff(dayStart, start, 'minutes') + getDayStartDstOffset(start)
  }

  function continuesPrior(start: Date, first: Date): boolean {
    return lt(start, first, 'day')
  }

  function continuesAfter(_start: Date, end: Date, last: Date): boolean {
    return gte(end, last, 'minute')
  }

  function daySpan(start: Date, end: Date): number {
    return diff(start, end, 'day')
  }

  /* -------------------------------------------------------------------- *
   *  Event helpers                                                       *
   * -------------------------------------------------------------------- */

  interface SortEventsArgs {
    evtA: { start: Date; end: Date; allDay?: boolean }
    evtB: { start: Date; end: Date; allDay?: boolean }
  }

  function sortEvents({
    evtA: { start: aStart, end: aEnd, allDay: aAllDay },
    evtB: { start: bStart, end: bEnd, allDay: bAllDay },
  }: SortEventsArgs): number {
    const startSort = +startOf(aStart, 'day') - +startOf(bStart, 'day')
    const durA = daySpan(aStart, aEnd)
    const durB = daySpan(bStart, bEnd)
    return (
      startSort || // sort by start day first
      durB - durA || // events spanning multiple days go first
      (bAllDay ? 1 : 0) - (aAllDay ? 1 : 0) || // then all-day single-day events
      +aStart - +bStart || // then by start time
      +aEnd - +bEnd // then by end time
    )
  }

  interface InEventRangeArgs {
    event: { start: Date; end: Date }
    range: { start: Date; end: Date }
  }

  function inEventRange({
    event: { start, end },
    range: { start: rangeStart, end: rangeEnd },
  }: InEventRangeArgs): boolean {
    const startOfDay = startOf(start, 'day')
    const startsBeforeEnd = lte(startOfDay, rangeEnd, 'day')
    // For zero-duration events we need to be inclusive of the range start.
    const sameMin = neq(startOfDay, end, 'minute')
    const endsAfterStart = sameMin
      ? gt(end, rangeStart, 'minute')
      : gte(end, rangeStart, 'minute')
    return startsBeforeEnd && endsAfterStart
  }

  function isSameDate(date1: Date, date2: Date): boolean {
    return eq(date1, date2, 'day')
  }

  function browserTZOffset(): number {
    // This localizer always operates in the browser/system zone, so the
    // calendar zone never exceeds the browser zone.
    return 0
  }

  /* -------------------------------------------------------------------- *
   *  Formatting                                                          *
   * -------------------------------------------------------------------- */

  function format(value: Date, formatString: string, _culture?: string): string {
    if (value == null) return ''
    let formatter = DateTimeFormatter.ofPattern(formatString)
    if (locale != null) {
      // `withLocale` is provided by @js-joda/locale at runtime.
      formatter = (formatter as unknown as {
        withLocale(l: unknown): typeof formatter
      }).withLocale(locale)
    }
    return formatter.format(toZdt(value))
  }

  return new DateLocalizer({
    formats: { ...defaultFormats, ...(options.formats ?? {}) },

    firstOfWeek,
    firstVisibleDay,
    lastVisibleDay,
    visibleDays,

    format,

    lt,
    lte,
    gt,
    gte,
    eq,
    neq,
    merge,
    inRange,
    startOf,
    endOf,
    range,
    add,
    diff,
    ceil,
    min,
    max,
    minutes,

    getSlotDate,
    getTimezoneOffset,
    getDstOffset,
    getTotalMin,
    getMinutesFromMidnight,
    continuesPrior,
    continuesAfter,
    sortEvents,
    inEventRange,
    isSameDate,
    browserTZOffset,
  } as unknown as ConstructorParameters<typeof DateLocalizer>[0])
}

/* ---------------------------------------------------------------------- *
 *  Default formats (java.time patterns)                                  *
 *                                                                        *
 *  Unlike the moment / dayjs localizers these are java.time pattern      *
 *  strings (`dd`, `MMMM`, `EEEE`, `HH:mm`, ...). Patterns containing     *
 *  text fields (month / weekday names, `a`) require a `locale` option.   *
 * ---------------------------------------------------------------------- */

type RangeArg = { start: Date; end: Date }
type RangeFormatter = (
  range: RangeArg,
  culture: string | undefined,
  local: DateLocalizer
) => string

// java.time localized date / time patterns used by the range formatters.
const LOCALIZED_DATE = 'MMM d, yyyy'
const LOCALIZED_TIME = 'h:mm a'

const weekRangeFormat: RangeFormatter = ({ start, end }, culture, local) =>
  local.format(start, 'MMMM dd', culture) +
  ' – ' +
  local.format(end, local.eq(start, end, 'month') ? 'dd' : 'MMMM dd', culture)

const dateRangeFormat: RangeFormatter = ({ start, end }, culture, local) =>
  local.format(start, LOCALIZED_DATE, culture) +
  ' – ' +
  local.format(end, LOCALIZED_DATE, culture)

const timeRangeFormat: RangeFormatter = ({ start, end }, culture, local) =>
  local.format(start, LOCALIZED_TIME, culture) +
  ' – ' +
  local.format(end, LOCALIZED_TIME, culture)

const timeRangeStartFormat: RangeFormatter = ({ start }, culture, local) =>
  local.format(start, LOCALIZED_TIME, culture) + ' – '

const timeRangeEndFormat: RangeFormatter = ({ end }, culture, local) =>
  ' – ' + local.format(end, LOCALIZED_TIME, culture)

export const defaultFormats = {
  dateFormat: 'dd',
  dayFormat: 'dd EEE',
  weekdayFormat: 'EEE',

  selectRangeFormat: timeRangeFormat,
  eventTimeRangeFormat: timeRangeFormat,
  eventTimeRangeStartFormat: timeRangeStartFormat,
  eventTimeRangeEndFormat: timeRangeEndFormat,

  timeGutterFormat: LOCALIZED_TIME,

  monthHeaderFormat: 'MMMM yyyy',
  dayHeaderFormat: 'EEEE MMM dd',
  dayRangeHeaderFormat: weekRangeFormat,
  agendaHeaderFormat: dateRangeFormat,

  agendaDateFormat: 'EEE MMM dd',
  agendaTimeFormat: LOCALIZED_TIME,
  agendaTimeRangeFormat: timeRangeFormat,
}

export default jsJodaLocalizer
