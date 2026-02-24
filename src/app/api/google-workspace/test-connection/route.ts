/**
 * POST /api/google-workspace/test-connection
 *
 * Verify service account credentials and domain-wide delegation.
 * Returns workspace domain and approximate user count.
 */

import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { testConnection } from '@/lib/google-workspace/client'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api:google-workspace:test-connection')

export async function POST(): Promise<NextResponse> {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    const domain = process.env.GOOGLE_WORKSPACE_DOMAIN
    if (!domain) {
      return apiSuccess({
        connected: false,
        error: 'GOOGLE_WORKSPACE_DOMAIN environment variable is not set',
      })
    }

    const info = await testConnection(domain)
    return apiSuccess({
      connected: true,
      domain: info.domain,
      user_count: info.userCount,
    })
  } catch (error) {
    logger.error('Google Workspace test-connection failed', error)

    const msg = error instanceof Error ? error.message : ''

    // Map known error patterns to user-safe guidance (no internal details exposed)
    let hint = ''
    if (msg.includes('Not Authorized') || msg.toLowerCase().includes('forbidden')) {
      hint = 'Ensure domain-wide delegation is configured in Google Workspace Admin Console with the admin.directory.user.readonly scope.'
    } else if (msg.includes('GOOGLE_WORKSPACE_')) {
      hint = 'Check that all required Google Workspace environment variables are set.'
    }

    return apiSuccess({
      connected: false,
      error: hint || 'Connection failed. Verify your Google Workspace configuration.',
    })
  }
}

export async function GET(): Promise<NextResponse> {
  return ApiErrors.notFound('Use POST method')
}
