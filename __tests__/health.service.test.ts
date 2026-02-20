/**
 * Tests for health.service
 * Covers: getSystemHealth
 */

jest.mock('@/lib/repositories/health.repository')

import { getSystemHealth } from '@/lib/services/health.service'
import * as healthRepo from '@/lib/repositories/health.repository'

const mockedHealthRepo = jest.mocked(healthRepo)

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// getSystemHealth
// ---------------------------------------------------------------------------

describe('getSystemHealth', () => {
  it('returns healthy status when database is up', async () => {
    mockedHealthRepo.checkDatabaseHealth.mockResolvedValue({
      status: 'up',
      latencyMs: 12,
    })

    const result = await getSystemHealth()

    expect(result.status).toBe('healthy')
    expect(result.checks.database.status).toBe('up')
    expect(result.checks.database.latencyMs).toBe(12)
  })

  it('returns unhealthy status when database is down', async () => {
    mockedHealthRepo.checkDatabaseHealth.mockResolvedValue({
      status: 'down',
      latencyMs: 5000,
      error: 'connection refused',
    })

    const result = await getSystemHealth()

    expect(result.status).toBe('unhealthy')
    expect(result.checks.database.status).toBe('down')
    expect(result.checks.database.error).toBe('connection refused')
  })

  it('includes a timestamp in ISO format', async () => {
    mockedHealthRepo.checkDatabaseHealth.mockResolvedValue({
      status: 'up',
      latencyMs: 5,
    })

    const result = await getSystemHealth()

    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('includes a version string', async () => {
    mockedHealthRepo.checkDatabaseHealth.mockResolvedValue({
      status: 'up',
      latencyMs: 5,
    })

    const result = await getSystemHealth()

    expect(typeof result.version).toBe('string')
    expect(result.version.length).toBeGreaterThan(0)
  })

  it('calls checkDatabaseHealth exactly once', async () => {
    mockedHealthRepo.checkDatabaseHealth.mockResolvedValue({
      status: 'up',
      latencyMs: 10,
    })

    await getSystemHealth()

    expect(mockedHealthRepo.checkDatabaseHealth).toHaveBeenCalledTimes(1)
  })

  it('uses process.env.npm_package_version when available', async () => {
    const originalVersion = process.env.npm_package_version
    process.env.npm_package_version = '1.2.3'

    mockedHealthRepo.checkDatabaseHealth.mockResolvedValue({
      status: 'up',
      latencyMs: 5,
    })

    const result = await getSystemHealth()

    expect(result.version).toBe('1.2.3')
    process.env.npm_package_version = originalVersion
  })

  it('defaults to 0.0.0 when npm_package_version is not set', async () => {
    const originalVersion = process.env.npm_package_version
    delete process.env.npm_package_version

    mockedHealthRepo.checkDatabaseHealth.mockResolvedValue({
      status: 'up',
      latencyMs: 5,
    })

    const result = await getSystemHealth()

    expect(result.version).toBe('0.0.0')
    process.env.npm_package_version = originalVersion
  })
})
