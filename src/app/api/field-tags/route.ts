import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/api-auth'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:field-tags')

// Use singleton Supabase client
const supabase = getAdminClient()

// GET /api/field-tags - Get all available field tags
export async function GET() {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  try {
    const { data: tags, error } = await supabase
      .from('field_tags')
      .select('id, name, color, description')
      .order('name')

    if (error) {
      log.error('Error fetching field tags', error)
      return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 })
    }

    return NextResponse.json({ tags }, {
      headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    log.error('Error in field-tags GET', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
