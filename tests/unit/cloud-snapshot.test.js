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

  it('applies v1.6 defaults when legacy snapshots omit company classification fields', () => {
    const legacySnapshot = structuredClone(READONLY_SNAPSHOT)
    for (const company of legacySnapshot.data.companies) {
      delete company.industryType
      delete company.recruitmentBatch
      delete company.priority
      delete company.companyNotes
    }

    const result = validateCloudSnapshot(legacySnapshot, { today: '2026-08-08' })
    expect(result.data.companies).toEqual(legacySnapshot.data.companies.map((company) => ({
      ...company,
      industryType: '',
      recruitmentBatch: '秋招正式批',
      priority: 'P1',
      companyNotes: '',
    })))
  })

  it('applies empty note defaults when legacy snapshots omit progress stage notes', () => {
    const legacySnapshot = structuredClone(READONLY_SNAPSHOT)
    for (const application of legacySnapshot.data.applications) {
      for (const stage of application.progressStages) delete stage.note
    }

    const result = validateCloudSnapshot(legacySnapshot, { today: '2026-08-08' })
    expect(result.data.applications.every((application) => (
      application.progressStages.every((stage) => stage.note === '')
    ))).toBe(true)
  })

  it('distinguishes unsupported schema versions from malformed snapshots', () => {
    expect(() => validateCloudSnapshot({ ...READONLY_SNAPSHOT, schemaVersion: 99 }))
      .toThrow(UnsupportedSchemaVersionError)
    expect(() => validateCloudSnapshot({ ...READONLY_SNAPSHOT, sourceRevision: -1 }))
      .toThrow(DomainValidationError)
    expect(() => validateCloudSnapshot({
      ...READONLY_SNAPSHOT,
      data: {
        ...READONLY_SNAPSHOT.data,
        companies: [{ ...READONLY_SNAPSHOT.data.companies[0], industryType: null }],
        applications: [],
      },
    })).toThrow(DomainValidationError)
    expect(() => validateCloudSnapshot({
      ...READONLY_SNAPSHOT,
      data: { companies: [], applications: READONLY_SNAPSHOT.data.applications },
    }, { today: '2026-08-08' })).toThrow(DomainValidationError)
  })
})
