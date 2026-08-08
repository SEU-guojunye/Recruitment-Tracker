import {
  DomainValidationError,
  UnsupportedSchemaVersionError,
  validateCloudSnapshot,
} from '@recruitment-tracker/core'
import { READONLY_SNAPSHOT } from '../fixtures/readonly-snapshot.js'
import { describe, expect, it } from 'vitest'

describe('validateCloudSnapshot', () => {
  it('normalizes server dates and returns an isolated valid snapshot', () => {
    const result = validateCloudSnapshot({
      ...READONLY_SNAPSHOT,
      updatedAt: new Date('2026-08-08T09:20:00.000Z'),
    }, { today: '2026-08-08' })
    expect(result.updatedAt).toBe('2026-08-08T09:20:00.000Z')
    expect(result.data).toEqual(READONLY_SNAPSHOT.data)
    expect(result.data).not.toBe(READONLY_SNAPSHOT.data)
  })

  it('distinguishes unsupported schema versions from malformed snapshots', () => {
    expect(() => validateCloudSnapshot({ ...READONLY_SNAPSHOT, schemaVersion: 99 }))
      .toThrow(UnsupportedSchemaVersionError)
    expect(() => validateCloudSnapshot({ ...READONLY_SNAPSHOT, sourceRevision: -1 }))
      .toThrow(DomainValidationError)
    expect(() => validateCloudSnapshot({
      ...READONLY_SNAPSHOT,
      data: { companies: [], applications: READONLY_SNAPSHOT.data.applications },
    }, { today: '2026-08-08' })).toThrow(DomainValidationError)
  })
})
