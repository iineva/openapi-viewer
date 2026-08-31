import { describe, expect, it } from 'vitest'
import { buildRequest } from './request'
import type { Operation } from '../types/openapi'

const operation: Operation = {
  key: 'get-/pets/{id}',
  method: 'get',
  path: '/pets/{id}',
  serverUrl: 'https://api.example.com/',
  parameters: [],
  definition: {},
}

describe('request construction', () => {
  it('substitutes path values and appends non-empty query values', () => {
    expect(buildRequest(operation, {
      path: { id: '7' },
      query: { limit: '10', ignored: '' },
      headers: {},
      body: '',
    }).url).toBe('https://api.example.com/pets/7?limit=10')
  })

  it('encodes path and query values while retaining session-only body and headers', () => {
    expect(buildRequest(operation, {
      path: { id: 'a/b' },
      query: { name: 'Ada Lovelace' },
      headers: { Authorization: 'Bearer transient' },
      body: '{"name":"Ada"}',
    })).toEqual({
      method: 'GET',
      url: 'https://api.example.com/pets/a%2Fb?name=Ada+Lovelace',
      headers: { Authorization: 'Bearer transient' },
      body: '{"name":"Ada"}',
    })
  })
})
