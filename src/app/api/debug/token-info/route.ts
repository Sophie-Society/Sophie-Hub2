import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth/config'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:debug:token-info')

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Verify token with Google's tokeninfo endpoint
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${session.accessToken}`
    )

    const tokenInfo = await response.json()

    return NextResponse.json({
      tokenInfo,
      hasError: !!session.error,
      error: session.error,
    })
  } catch (error: unknown) {
    log.error('Error checking token:', error)
    return NextResponse.json(
      { error: 'Failed to check token' },
      { status: 500 }
    )
  }
}
