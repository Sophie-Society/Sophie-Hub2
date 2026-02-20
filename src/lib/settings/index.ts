import { findSystemSetting } from '@/lib/repositories/settings.repository'
import { decrypt } from '@/lib/encryption'
import { createLogger } from '@/lib/logger'

const log = createLogger('settings')

/**
 * Get a system setting value by key.
 * Automatically decrypts if the value is encrypted.
 * Returns null if not found.
 */
export async function getSystemSetting(key: string): Promise<string | null> {
  try {
    const row = await findSystemSetting(key)

    if (!row?.value) {
      return null
    }

    // Decrypt if encrypted
    if (row.encrypted) {
      try {
        return decrypt(row.value)
      } catch (decryptError) {
        log.error(`Failed to decrypt setting ${key}`, decryptError)
        return null
      }
    }

    return row.value
  } catch (error) {
    log.error(`Error fetching setting ${key}`, error)
    return null
  }
}

/**
 * Check if a system setting exists and has a value.
 */
export async function hasSystemSetting(key: string): Promise<boolean> {
  const value = await getSystemSetting(key)
  return value !== null && value.length > 0
}

/**
 * Get the Anthropic API key from database, with fallback to env var.
 * Throws an error if not configured anywhere.
 */
export async function getAnthropicApiKey(): Promise<string> {
  // First check database
  const dbKey = await getSystemSetting('anthropic_api_key')
  if (dbKey) {
    return dbKey
  }

  // Fallback to env (for development/migration)
  const envKey = process.env.ANTHROPIC_API_KEY
  if (envKey) {
    return envKey
  }

  throw new Error(
    'Anthropic API key not configured. Add it in Admin Settings → API Keys.'
  )
}

/**
 * Get the PostHog Personal API key from database.
 * This is needed for server-side API calls (fetching session data, errors, etc.)
 * Returns null if not configured (PostHog analysis will be unavailable).
 */
export async function getPostHogApiKey(): Promise<string | null> {
  // Check database
  const dbKey = await getSystemSetting('posthog_api_key')
  if (dbKey) {
    return dbKey
  }

  // Fallback to env
  const envKey = process.env.POSTHOG_PERSONAL_API_KEY
  if (envKey) {
    return envKey
  }

  return null
}
