// Shared localizer for the ported react-big-calendar util suites.
//
// These suites (TimeSlots / eventLevels / DayEventLayout) are the same tests
// react-big-calendar uses to validate its built-in localizers — they construct
// `Date`s in local time and exercise the localizer indirectly through the util
// functions. So the localizer here operates in the system default zone (the
// default), exactly like momentLocalizer/dayjsLocalizer do.
import * as jsJoda from '@js-joda/core'
// Side-effect import: registers en-US CLDR data and augments
// @js-joda/core's DateTimeFormatter with localized-text support.
import '@js-joda/locale_en-us'
import localePkg from '@js-joda/locale'
import { jsJodaLocalizer } from '../src/index'

const { Locale } = localePkg

export const localizer = jsJodaLocalizer(jsJoda, { locale: Locale.US })
