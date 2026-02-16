import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { encrypt, decrypt, maskValue } from '@/lib/encryption'
import { apiSuccess, apiError, ApiErrors, ErrorCodes } from '@/lib/api/response'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import * as adminRepo from '@/lib/repositories/admin.repository'

const log = createLogger('api:admin:settings:key')

interface RouteContext {
  params: Promise<{ key: string }>
}

/**
 * PUT /api/admin/settings/[key]
 * Update or create a system setting (admin only)
 */
export async function PUT(request: Request, context: RouteContext): Promise<NextResponse> {
  const authResult = await requireRole(ROLES.ADMIN)
  if (!authResult.authenticated) return authResult.response

  const rateLimit = checkRateLimit(authResult.user.id, 'admin:settings:write', RATE_LIMITS.STRICT)
  if (!rateLimit.allowed) {
    return ApiErrors.rateLimited('Too many settings updates. Please wait before trying again.')
  }

  const { key } = await context.params

  if (!key || !/^[a-z_]+$/.test(key)) {
    return apiError(ErrorCodes.VALIDATION_ERROR, 'Invalid setting key format', 400)
  }

  try {
    const body = await request.json()
    const { value } = body

    if (!value || typeof value !== 'string') {
      return apiError(ErrorCodes.VALIDATION_ERROR, 'Value is required', 400)
    }

    let encryptedValue: string
    try {
      encryptedValue = encrypt(value)
    } catch (encryptError: unknown) {
      log.error('Encryption failed', encryptError)
      return apiError(ErrorCodes.INTERNAL_ERROR, 'Encryption failed. Ensure ENCRYPTION_KEY is configured.', 500)
    }

    await adminRepo.upsertSetting(key, encryptedValue, true, authResult.user.email || 'admin')

    return apiSuccess({
      key,
      masked_value: maskValue(value),
      updated_at: new Date().toISOString(),
    })
  } catch (error: unknown) {
    log.error('Settings update error', error)
    return ApiErrors.internal()
  }
}

/**
 * DELETE /api/admin/settings/[key]
 * Remove a system setting (admin only)
 */
export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  const authResult = await requireRole(ROLES.ADMIN)
  if (!authResult.authenticated) return authResult.response

  const rateLimit = checkRateLimit(authResult.user.id, 'admin:settings:write', RATE_LIMITS.STRICT)
  if (!rateLimit.allowed) {
    return ApiErrors.rateLimited('Too many settings updates. Please wait before trying again.')
  }

  const { key } = await context.params

  if (!key) {
    return apiError(ErrorCodes.VALIDATION_ERROR, 'Key is required', 400)
  }

  try {
    await adminRepo.deleteSetting(key)
    return apiSuccess({ deleted: true })
  } catch (error: unknown) {
    log.error('Settings delete error', error)
    return ApiErrors.internal()
  }
}

/**
 * GET /api/admin/settings/[key]
 * Get decrypted value for a specific setting (admin only)
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const authResult = await requireRole(ROLES.ADMIN)
  if (!authResult.authenticated) return authResult.response

  const { key } = await context.params

  if (!key) {
    return apiError(ErrorCodes.VALIDATION_ERROR, 'Key is required', 400)
  }

  try {
    const setting = await adminRepo.findSettingByKey(key)

    if (!setting) {
      return ApiErrors.notFound('Setting')
    }

    let decryptedValue = setting.value
    if (setting.encrypted && setting.value) {
      try {
        decryptedValue = decrypt(setting.value)
      } catch (decryptError: unknown) {
        log.error('Decryption failed', decryptError)
        return apiError(ErrorCodes.INTERNAL_ERROR, 'Failed to decrypt setting', 500)
      }
    }

    return apiSuccess({
      key: setting.key,
      value: decryptedValue,
      description: setting.description,
      updated_at: setting.updated_at,
    })
  } catch (error: unknown) {
    log.error('Settings fetch error', error)
    return ApiErrors.internal()
  }
}
