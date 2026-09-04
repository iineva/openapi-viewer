import { describe, expect, it } from 'vitest'
import { schemaPreview } from './schemaPreview'

describe('schemaPreview', () => {
  it('creates contextual preview values from field names and formats', () => {
    expect(schemaPreview({
      properties: {
        active: { type: 'boolean' },
        avatarUrl: { format: 'uri', type: 'string' },
        createdAt: { format: 'date-time', type: 'string' },
        displayName: { type: 'string' },
        email: { format: 'email', type: 'string' },
        userId: { type: 'integer' },
      },
      type: 'object',
    })).toEqual({
      active: true,
      avatarUrl: 'https://example.com/avatar.png',
      createdAt: '2026-01-01T00:00:00Z',
      displayName: 'Sample User',
      email: 'user@example.com',
      userId: 1,
    })
  })

  it('uses explicit schema values before generated fallbacks', () => {
    expect(schemaPreview({
      properties: {
        limit: { default: 20, type: 'integer' },
        role: { enum: ['admin', 'member'], type: 'string' },
      },
      type: 'object',
    })).toEqual({ limit: 20, role: 'admin' })
  })
})
