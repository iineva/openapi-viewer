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

  it('resolves relative and omitted servers against the canonical remote document URL', () => {
    const relativeServerOperation = {
      ...operation,
      serverUrl: '../api/v1',
      documentUrl: 'https://docs.example.com/specifications/openapi.yaml',
    } as Operation
    const defaultServerOperation = {
      ...operation,
      serverUrl: undefined,
      documentUrl: 'https://docs.example.com/specifications/openapi.yaml',
    } as Operation
    const values = { body: '', headers: {}, path: { id: '7' }, query: {} }

    expect(buildRequest(relativeServerOperation, values).url).toBe('https://docs.example.com/api/v1/pets/7')
    expect(buildRequest(defaultServerOperation, values).url).toBe('https://docs.example.com/pets/7')
  })

  it('keeps viewer-origin resolution for local documents without a canonical URL', () => {
    expect(buildRequest({ ...operation, serverUrl: '/api' }, {
      body: '',
      headers: {},
      path: { id: '7' },
      query: {},
    }).url).toBe(`${window.location.origin}/api/pets/7`)
  })

  it('filters blank headers and supplies the selected body media type', () => {
    expect(buildRequest(operation, {
      body: 'plain request',
      bodyMediaType: 'text/plain',
      headers: { 'Content-Type': 'application/custom', 'X-Blank': '   ', 'X-Trace': 'trace-7' },
      path: { id: '7' },
      query: {},
    } as Parameters<typeof buildRequest>[1])).toMatchObject({
      body: 'plain request',
      headers: { 'Content-Type': 'application/custom', 'X-Trace': 'trace-7' },
    })

    expect(buildRequest(operation, {
      body: 'plain request',
      bodyMediaType: 'text/plain',
      headers: {},
      path: { id: '7' },
      query: {},
    } as Parameters<typeof buildRequest>[1]).headers).toEqual({ 'Content-Type': 'text/plain' })
  })
})
