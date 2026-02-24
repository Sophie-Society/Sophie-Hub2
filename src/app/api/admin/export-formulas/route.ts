import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { authOptions } from '@/lib/auth/config'
import { mapSheetsAuthError, resolveSheetsAccessToken } from '@/lib/google/sheets-auth'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:admin:export-formulas')

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    let accessToken: string
    try {
      const resolved = await resolveSheetsAccessToken(session.accessToken)
      accessToken = resolved.accessToken
    } catch (authError) {
      const mapped = mapSheetsAuthError(authError)
      return NextResponse.json({ error: mapped.message }, { status: mapped.status })
    }

    const spreadsheetId = request.nextUrl.searchParams.get('id')
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Missing ?id=<spreadsheetId>' }, { status: 400 })
    }

    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })
    const sheets = google.sheets({ version: 'v4', auth })

    // 1. Get all tab names
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'properties.title,sheets.properties.title',
    })

    const title = metadata.data.properties?.title ?? 'spreadsheet'
    const tabs = (metadata.data.sheets ?? []).map(s => s.properties?.title ?? '')

    log.info(`Exporting formulas from "${title}" — ${tabs.length} tabs`)

    // 2. Fetch formulas for every tab (sequentially to avoid quota bursts)
    const output: Record<string, string[]> = {}

    for (const tab of tabs) {
      if (!tab) continue
      try {
        const resp = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'${tab}'`,
          valueRenderOption: 'FORMULA',
        })

        const rows: string[][] = (resp.data.values ?? []).map(r => r.map(String))
        const formulaLines: string[] = []

        rows.forEach((row, r) => {
          row.forEach((cell, c) => {
            if (cell.startsWith('=')) {
              const col = columnToLetter(c + 1)
              formulaLines.push(`${col}${r + 1}: ${cell}`)
            }
          })
        })

        if (formulaLines.length > 0) {
          output[tab] = formulaLines
        }
      } catch (tabError) {
        log.error(`Failed to fetch formulas for tab "${tab}"`, tabError)
        output[tab] = [`ERROR: could not fetch tab`]
      }
    }

    const totalFormulas = Object.values(output).reduce((sum, lines) => sum + lines.length, 0)
    log.info(`Export complete — ${totalFormulas} formulas across ${Object.keys(output).length} tabs`)

    const filename = `${title.replace(/[^a-z0-9]/gi, '_')}-formulas.json`
    const json = JSON.stringify({ spreadsheet: title, tabs: output }, null, 2)

    return new NextResponse(json, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    log.error('Unexpected error in export-formulas', error)
    return NextResponse.json({ error: 'Failed to export formulas' }, { status: 500 })
  }
}

function columnToLetter(col: number): string {
  let letter = ''
  while (col > 0) {
    const rem = (col - 1) % 26
    letter = String.fromCharCode(65 + rem) + letter
    col = Math.floor((col - 1) / 26)
  }
  return letter
}
