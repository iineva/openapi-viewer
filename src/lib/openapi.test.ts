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

  it('preserves component references so Proto schema names remain available', async () => {
    const document = await parseSpecification(`openapi: 3.1.0
info: { title: Gateway, version: 1.0.0 }
paths:
  /messages:
    post:
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/gateway.v1.MsgBodyItem'
components:
  schemas:
    gateway.v1.MsgBodyItem:
      type: object
      properties:
        text: { type: string }
`)

    const schema = (document.paths?.['/messages']?.post?.requestBody as { content?: Record<string, { schema?: unknown }> })?.content?.['application/json']?.schema
    expect(schema).toEqual({ $ref: '#/components/schemas/gateway.v1.MsgBodyItem' })
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

  it('searches referenced Schema class names and nested field names', () => {
    const schemas = {
      'gateway.v1.MemberProfile': {
        properties: { contact: { $ref: '#/components/schemas/gateway.v1.Contact' } },
        type: 'object',
      },
      'gateway.v1.Contact': {
        properties: { preferredNickname: { description: '昵称', type: 'string' } },
        type: 'object',
      },
    }
    const operations = getOperations({
      ...sampleDocument,
      components: { schemas },
      paths: {
        '/members': {
          get: {
            responses: {
              '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/gateway.v1.MemberProfile' } } } },
            },
          },
        },
      },
    })
    expect(searchOperations(operations, 'memberprofile', schemas)).toHaveLength(1)
    expect(searchOperations(operations, 'preferrednickname', schemas)).toHaveLength(1)
  })

  it('searches Chinese operation text by full pinyin and initials', () => {
    const operations = getOperations({
      ...sampleDocument,
      paths: {
        '/members/profile': {
          get: { description: '获取用户的完整资料', summary: '查询会员信息' },
        },
      },
    })

    expect(searchOperations(operations, 'chaxunhuiyuanxinxi')).toHaveLength(1)
    expect(searchOperations(operations, 'cxhyxx')).toHaveLength(1)
    expect(searchOperations(operations, 'huoquyonghu')).toHaveLength(1)
  })
})
