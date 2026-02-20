/**
 * Environment variable validation
 *
 * Validates all process.env values at runtime before first use.
 * Fails fast with a clear error message if required vars are missing.
 *
 * Note: Lazy validation (via getEnv()) is intentional — Next.js imports
 * server modules at build time before runtime env vars are available.
 * Calling getEnv() at runtime (inside route handlers, not at module scope)
 * ensures validation happens against live env values.
 */

import { z } from 'zod'

// =============================================================================
// Schema
// =============================================================================

const EnvSchema = z.object({
  // ---- Core infrastructure (required) ----
  NEXT_PUBLIC_SUPABASE_URL: z.string().url({ message: 'NEXT_PUBLIC_SUPABASE_URL must be a valid URL' }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, { message: 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required' }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, { message: 'SUPABASE_SERVICE_ROLE_KEY is required' }),
  NEXTAUTH_SECRET: z.string().min(1, { message: 'NEXTAUTH_SECRET is required' }),
  ENCRYPTION_KEY: z.string().min(1, { message: 'ENCRYPTION_KEY is required' }),
  GOOGLE_CLIENT_ID: z.string().min(1, { message: 'GOOGLE_CLIENT_ID is required' }),
  GOOGLE_CLIENT_SECRET: z.string().min(1, { message: 'GOOGLE_CLIENT_SECRET is required' }),

  // ---- Runtime ----
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // ---- Admin / access control (optional — has runtime fallback) ----
  ADMIN_EMAILS: z.string().optional(),
  ALLOWED_EMAIL_DOMAINS: z.string().optional(),

  // ---- Staging gate (optional — gate is disabled when absent) ----
  STAGING_PASSWORD: z.string().optional(),

  // ---- Cron jobs (optional — cron routes reject requests if absent) ----
  CRON_SECRET: z.string().optional(),

  // ---- AI (optional — AI features disabled when absent) ----
  ANTHROPIC_API_KEY: z.string().optional(),

  // ---- Slack integration (optional) ----
  SLACK_BOT_TOKEN: z.string().optional(),

  // ---- Google Workspace integration (optional) ----
  GOOGLE_WORKSPACE_DOMAIN: z.string().optional(),
  GOOGLE_WORKSPACE_CLIENT_EMAIL: z.string().email().optional(),
  GOOGLE_WORKSPACE_PRIVATE_KEY: z.string().optional(),
  GOOGLE_WORKSPACE_PRIVATE_KEY_BASE: z.string().optional(),
  GOOGLE_WORKSPACE_ADMIN_EMAIL: z.string().email().optional(),

  // ---- Google Sheets shared token (optional) ----
  GOOGLE_SHEETS_SHARED_REFRESH_TOKEN: z.string().optional(),

  // ---- BigQuery integration (optional) ----
  BIGQUERY_REFERENCE_SHEET_ID: z.string().optional(),
  BIGQUERY_REFERENCE_SHEET_TAB_NAME: z.string().optional(),
  BIGQUERY_REFERENCE_SHEET_TAB_GID: z.string().optional(),

  // ---- ClickUp integration (optional) ----
  CLICKUP_API_TOKEN: z.string().optional(),

  // ---- SupTask integration (optional) ----
  SUPTASK_API_TOKEN: z.string().optional(),
  SUPTASK_API_BASE_URL: z.string().url().optional(),
  SUPTASK_API_AUTH_SCHEME: z.string().optional(),

  // ---- PostHog analytics (optional) ----
  POSTHOG_PERSONAL_API_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),

  // ---- Dialkit (optional) ----
  NEXT_PUBLIC_DIALKIT_ALLOWED_EMAILS: z.string().optional(),
})

export type Env = z.infer<typeof EnvSchema>

// =============================================================================
// Lazy-validated singleton
// =============================================================================

let _env: Env | null = null

/**
 * Returns the validated environment object.
 * Throws a descriptive error on first call if any required variable is missing.
 * Safe to call from API routes and server actions. Do NOT call at module scope
 * in server components or lib files — call inside functions instead.
 */
export function getEnv(): Env {
  if (_env) return _env

  const result = EnvSchema.safeParse(process.env)

  if (!result.success) {
    const issues = result.error.issues
      .map(i => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(
      `Environment validation failed. Fix the following before starting the server:\n${issues}`
    )
  }

  _env = result.data
  return _env
}

/**
 * Reset cached env — for use in tests only.
 */
export function _resetEnvCache(): void {
  _env = null
}
