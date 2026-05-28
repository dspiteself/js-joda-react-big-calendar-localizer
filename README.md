# js-joda-react-big-calendar-localizer

A [react-big-calendar](https://github.com/jquense/react-big-calendar) localizer
backed by [js-joda](https://js-joda.github.io/js-joda/) (`@js-joda/core`), with
optional `@js-joda/locale` support for localized month / weekday names and
`@js-joda/timezone` support for named time zones.

It implements the full `DateLocalizer` contract (the same one used by the
built-in moment / dayjs / date-fns / globalize localizers), so it is a drop-in
replacement for any of them.

- ✅ Works with the latest **react-big-calendar** (`>= 1.19`) and
  **`@js-joda/core`** (`5.x` / `6.x`).
- ✅ Ships ESM **and** CommonJS builds plus TypeScript declarations.
- ✅ Zero runtime dependencies — js-joda and react-big-calendar are peer
  dependencies that you already have.

## Installation

```bash
npm install js-joda-react-big-calendar-localizer @js-joda/core react-big-calendar
```

If you want localized month / weekday names (the default `formats` need them),
also install a locale package:

```bash
npm install @js-joda/locale_en-us   # or @js-joda/locale, @js-joda/locale_de, ...
```

For named time zones (e.g. `America/New_York`) install:

```bash
npm install @js-joda/timezone
```

## Usage

You pass the `@js-joda/core` **module** into the factory (rather than the
library importing it itself). This guarantees there is a single js-joda instance
in your app, which is what lets `@js-joda/locale` and `@js-joda/timezone` augment
the classes the localizer uses.

```tsx
import { Calendar } from 'react-big-calendar'
import 'react-big-calendar/lib/css/react-big-calendar.css'

import * as jsJoda from '@js-joda/core'

// Side-effect import: registers the en-US CLDR data and teaches
// @js-joda/core's DateTimeFormatter how to render localized text.
import '@js-joda/locale_en-us'
import { Locale } from '@js-joda/locale'

import { jsJodaLocalizer } from 'js-joda-react-big-calendar-localizer'

const localizer = jsJodaLocalizer(jsJoda, {
  locale: Locale.US,     // enables month / weekday names + AM/PM
  firstDayOfWeek: 0,     // 0 = Sunday (default), 1 = Monday, ...
})

function MyCalendar({ events }) {
  return (
    <Calendar
      localizer={localizer}
      events={events}
      startAccessor="start"
      endAccessor="end"
      style={{ height: 600 }}
    />
  )
}
```

> **Note on `@js-joda/locale`'s CJS interop:** `@js-joda/locale_en-us` is a
> side-effect package — importing it registers locale data and augments
> `@js-joda/core`. The `Locale` class itself lives in `@js-joda/locale`. In
> CommonJS use `const { Locale } = require('@js-joda/locale')`.

### Numeric-only / no locale package

If you only use numeric patterns you can skip `@js-joda/locale` entirely. Just
pass your own numeric `formats`:

```ts
const localizer = jsJodaLocalizer(jsJoda, {
  formats: {
    monthHeaderFormat: 'yyyy-MM',
    dayHeaderFormat: 'yyyy-MM-dd',
    weekdayFormat: 'eee',     // ⚠️ text — needs a locale; use numeric instead
    timeGutterFormat: 'HH:mm',
    dateFormat: 'dd',
  },
})
```

Patterns containing **text fields** (`MMMM`, `EEEE`, `a`, ...) throw at runtime
unless a `locale` is configured. Purely numeric patterns (`yyyy`, `MM`, `dd`,
`HH`, `mm`, `ss`) work without one.

## API

### `jsJodaLocalizer(jsJoda, options?)`

| Argument            | Type                                  | Description                                                            |
| ------------------- | ------------------------------------- | --------------------------------------------------------------------- |
| `jsJoda`            | `typeof import('@js-joda/core')`      | The `@js-joda/core` module (`import * as jsJoda from '@js-joda/core'`). |
| `options.zone`      | `ZoneId`                              | Conversion zone. Defaults to `ZoneId.systemDefault()`.                |
| `options.locale`    | `Locale` (from `@js-joda/locale`)     | Locale for text patterns. Required for the default `formats`.         |
| `options.firstDayOfWeek` | `number`                         | First day of week in `Date#getDay` numbering (0 = Sunday). Default `0`. |
| `options.formats`   | `Record<string, string \| fn>`        | Override / extend the default `formats` map.                          |

Returns a react-big-calendar `DateLocalizer`.

Also exported: **`defaultFormats`** (the default format map) and the
**`default`** export (an alias of `jsJodaLocalizer`).

## Format patterns

Unlike the moment / dayjs localizers, the format strings here are
[java.time / js-joda `DateTimeFormatter` patterns](https://js-joda.github.io/js-joda/class/packages/core/src/format/DateTimeFormatter.js~DateTimeFormatter.html#static-method-ofPattern),
**not** moment tokens. The most common letters:

| Pattern | Meaning            | Example   | Needs locale? |
| ------- | ------------------ | --------- | ------------- |
| `yyyy`  | year               | `2026`    | no            |
| `MM`    | month, 2-digit     | `05`      | no            |
| `MMM`   | month, short name  | `May`     | yes           |
| `MMMM`  | month, full name   | `May`     | yes           |
| `dd`    | day of month       | `28`      | no            |
| `EEE`   | weekday, short     | `Thu`     | yes           |
| `EEEE`  | weekday, full      | `Thursday`| yes           |
| `HH`    | hour (24h)         | `14`      | no            |
| `h`     | hour (12h)         | `2`       | no            |
| `mm`    | minute             | `30`      | no            |
| `a`     | AM/PM              | `PM`      | yes           |

The default `formats` are:

```ts
{
  dateFormat: 'dd',
  dayFormat: 'dd EEE',
  weekdayFormat: 'EEE',
  timeGutterFormat: 'h:mm a',
  monthHeaderFormat: 'MMMM yyyy',
  dayHeaderFormat: 'EEEE MMM dd',
  agendaDateFormat: 'EEE MMM dd',
  agendaTimeFormat: 'h:mm a',
  // range formats (selectRangeFormat, eventTimeRangeFormat,
  // dayRangeHeaderFormat, agendaHeaderFormat, ...) are functions.
}
```

## Accepted date inputs

react-big-calendar always hands the localizer `Date` objects, so you never have
to think about this. But because js-joda has a rich family of temporal types,
every localizer method will also gracefully coerce:

- a js-joda **`ZonedDateTime`**, **`OffsetDateTime`**, **`Instant`**,
  **`LocalDateTime`**, **`LocalDate`**, or **`LocalTime`**
- an **epoch-milliseconds `number`**
- an **ISO-8601 `string`** (`2026-05-28T14:30:00Z`, `2026-05-28T14:30`,
  `2026-05-28`, zoned/offset forms, ...)

Each is normalized to the configured `zone` (a `ZonedDateTime` carrying a zone
is converted *same-instant*; a `LocalDate` becomes the start of that day). A
`null` / `undefined` value resolves to "now" rather than throwing (matching the
moment / dayjs localizers), and a genuinely unsupported value throws a clear
`TypeError`. Methods always **return** plain `Date`s, as react-big-calendar
expects.

```ts
import { Instant, ZonedDateTime } from '@js-joda/core'

localizer.diff(Instant.now(), new Date(), 'minutes')      // mix types freely
localizer.format('2026-05-28T14:30:00Z', 'MMMM d, h:mm a')
localizer.eq(ZonedDateTime.parse('2026-05-28T16:30+02:00[Europe/Paris]'), someDate)
```

## Time zones

By default all `Date` ⇄ js-joda conversions go through
`ZoneId.systemDefault()`, matching how react-big-calendar's other localizers
behave (wall-clock time in the browser's zone). To pin the calendar to a
specific zone, install `@js-joda/timezone` and pass a `zone`:

```ts
import * as jsJoda from '@js-joda/core'
import '@js-joda/timezone'

const localizer = jsJodaLocalizer(jsJoda, {
  zone: jsJoda.ZoneId.of('America/New_York'),
})
```

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest
npm run build       # tsup -> dist/ (esm + cjs + d.ts)
```

### Tests

The suite has two layers:

- `test/jsJodaLocalizer.test.ts` — direct unit tests of every localizer method
  (arithmetic, comparisons, week/month visibility, event helpers, formatting).
- `test/{TimeSlots,eventLevels,DayEventLayout}.test.js` — react-big-calendar's
  **own** util test suites, ported to drive the js-joda localizer. These are the
  same tests RBC uses to validate its built-in moment / dayjs / luxon localizers
  (they import the utils from `react-big-calendar/lib/utils/*` and feed them this
  localizer), so passing them demonstrates behavioral parity.

## License

[MIT](./LICENSE)
