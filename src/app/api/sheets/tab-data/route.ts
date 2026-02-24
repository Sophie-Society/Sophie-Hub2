import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authOptions } from '@/lib/auth/config'
import { getSheetData } from '@/lib/google/sheets'
import { mapSheetsAuthError, resolveSheetsAccessToken } from '@/lib/google/sheets-auth'
import { checkSheetsRateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:sheets:tab-data')

const TabDataQuerySchema = z.object({
  id: z.string().min(1, 'Spreadsheet ID is required'),
  tab: z.string().min(1, 'Tab name is required'),
  headerRow: z.coerce.number().int().min(0).default(0),
})

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    let accessToken: string
    try {
      const resolved = await resolveSheetsAccessToken(session.accessToken)
      accessToken = resolved.accessToken
    } catch (authError) {
      const mapped = mapSheetsAuthError(authError)
      return NextResponse.json(
        { error: mapped.message },
        { status: mapped.status }
      )
    }

    // Check rate limit
    const userId = session.user?.email || 'anonymous'
    const rateLimitResult = checkSheetsRateLimit(userId)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Please wait ${Math.ceil(rateLimitResult.resetIn / 1000)} seconds.` },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      )
    }

    const parsed = TabDataQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams)
    )
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid query parameters' },
        { status: 400 }
      )
    }

    const { id: spreadsheetId, tab: tabName, headerRow } = parsed.data

    const data = await getSheetData(accessToken, spreadsheetId, tabName, headerRow)

    return NextResponse.json(data)
  } catch (error) {
    log.error('Error getting tab data', error)
    return NextResponse.json(
      { error: 'Failed to get tab data' },
      { status: 500 }
    )
  }
}
