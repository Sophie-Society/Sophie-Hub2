import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { authOptions } from '@/lib/auth/config'
import { createLogger } from '@/lib/logger'
import { ErrorCodes } from '@/lib/api/response'

const logger = createLogger('api:field-tags')

// GET /api/field-tags - Get all available field tags
export async function GET(): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const supabase = getAdminClient()

    const { data: tags, error } = await supabase
      .from('field_tags')
      .select('id, name, color, description')
      .order('name')

    if (error) {
      logger.error('Error fetching field tags', error)
      return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 })
    }

    return NextResponse.json({ tags }, {
      headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=600' },
    })
  } catch (error: unknown) {
    logger.error('Error in field-tags GET', error)
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
