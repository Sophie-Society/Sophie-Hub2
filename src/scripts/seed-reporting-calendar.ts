/**
 * Seed Reporting Calendar
 *
 * Generates the rpt_calendar dimension table with dates from 2020-01-01 to 2030-12-31.
 * Run with: npx tsx src/scripts/seed-reporting-calendar.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL env vars.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function getWeekOfYear(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1)
  const diff = date.getTime() - startOfYear.getTime()
  return Math.ceil((diff / 86400000 + startOfYear.getDay() + 1) / 7)
}

interface CalendarRow {
  date: string
  date_as_integer: number
  day: number
  day_of_week: number
  day_of_week_name: string
  day_of_week_short: string
  week_of_year: number
  month: number
  month_name: string
  month_short: string
  quarter: number
  year: number
  is_weekend: boolean
  iso_week: number
}

async function seedCalendar() {
  const startDate = new Date(2020, 0, 1)
  const endDate = new Date(2030, 11, 31)
  const rows: CalendarRow[] = []

  console.log('Generating calendar dates from 2020-01-01 to 2030-12-31...')

  const current = new Date(startDate)
  while (current <= endDate) {
    const year = current.getFullYear()
    const month = current.getMonth()
    const day = current.getDate()
    const dayOfWeek = current.getDay()

    rows.push({
      date: current.toISOString().split('T')[0],
      date_as_integer: year * 10000 + (month + 1) * 100 + day,
      day,
      day_of_week: dayOfWeek,
      day_of_week_name: DAY_NAMES[dayOfWeek],
      day_of_week_short: DAY_SHORT[dayOfWeek],
      week_of_year: getWeekOfYear(current),
      month: month + 1,
      month_name: MONTH_NAMES[month],
      month_short: MONTH_SHORT[month],
      quarter: Math.ceil((month + 1) / 3),
      year,
      is_weekend: dayOfWeek === 0 || dayOfWeek === 6,
      iso_week: getISOWeek(current),
    })

    current.setDate(current.getDate() + 1)
  }

  console.log(`Generated ${rows.length} dates. Inserting into rpt_calendar...`)

  // Insert in batches of 500
  const batchSize = 500
  let inserted = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await supabase
      .from('rpt_calendar')
      .upsert(batch, { onConflict: 'date' })

    if (error) {
      console.error(`Error inserting batch at index ${i}:`, error.message)
    } else {
      inserted += batch.length
      if (inserted % 2000 === 0) {
        console.log(`  ${inserted}/${rows.length} inserted`)
      }
    }
  }

  console.log(`Done! Inserted ${inserted} calendar dates.`)
}

seedCalendar().catch((error: unknown) => {
  console.error('Seed failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
