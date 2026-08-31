import { describe, expect, it } from 'vitest'
import { getOperations, parseSpecification, searchOperations } from './openapi'
import type { ApiDocument } from '../types/openapi'

const sampleDocument: ApiDocument = {
  openapi: '3.1.0',
  info: { title: 'Pet API', version: '1.0.0' },
  servers: [{ url: 'https://api.example.com' }],
  paths: {
    '/pets': {
      get: { summary: 'List pets', tags: ['pets'] },
      post: { operationId: 'createPet', tags: ['pets'] },
    },
  },
}

describe('OpenAPI utilities', () => {
  it('parses YAML into an API document', async () => {
    await expect(parseSpecification(`openapi: 3.1.0\ninfo:\n  title: Pet API\n  version: 1.0.0\npaths: {}`))
      .resolves.toMatchObject({ openapi: '3.1.0', info: { title: 'Pet API' } })
  })

  it('extracts supported operations with stable keys and inherited server details', () => {
    expect(getOperations(sampleDocument)).toContainEqual(expect.objectContaining({
      key: 'get-/pets',
      method: 'get',
      serverUrl: 'https://api.example.com',
    }))
  })

  it('carries the canonical remote document URL into extracted operations', () => {
    expect(getOperations(sampleDocument, 'https://docs.example.com/openapi.yaml')).toContainEqual(expect.objectContaining({
      documentUrl: 'https://docs.example.com/openapi.yaml',
      key: 'get-/pets',
    }))
  })

  it('searches operation method, route, summary, id, and tag', () => {
    const operations = getOperations(sampleDocument)

    expect(searchOperations(operations, 'createpet')).toHaveLength(1)
    expect(searchOperations(operations, 'PETS')).toHaveLength(2)
    expect(searchOperations(operations, 'GET')).toHaveLength(1)
  })

  it('searches parameter and nested schema field descriptions', () => {
    const operations = getOperations({
      ...sampleDocument,
      paths: {
        '/members': {
          post: {
            parameters: [{ description: 'Tenant routing identifier', in: 'header', name: 'X-Tenant' }],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    properties: {
                      displayName: { description: 'The public profile name', type: 'string' },
                    },
                    type: 'object',
                  },
                },
              },
            },
          },
        },
      },
    })

    expect(searchOperations(operations, 'tenant routing')).toHaveLength(1)
    expect(searchOperations(operations, 'public profile')).toHaveLength(1)
    expect(searchOperations(operations, 'displayname')).toHaveLength(1)
  })
})
