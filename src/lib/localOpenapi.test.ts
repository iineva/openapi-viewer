import { afterEach, describe, expect, it, vi } from 'vitest'
import { localOpenAPIFileContent, localOpenAPIFiles } from './localOpenapi'

describe('local OpenAPI API client', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('loads files through the development-only API', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ path: 'gateway.yaml', title: 'Gateway', version: '1.0.0' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: 'openapi: 3.1.0' }), { status: 200 }))
    vi.stubGlobal('fetch', fetch)

    await expect(localOpenAPIFiles()).resolves.toEqual([{ path: 'gateway.yaml', title: 'Gateway', version: '1.0.0' }])
    await localOpenAPIFileContent('gateway.yaml')

    expect(fetch).toHaveBeenLastCalledWith('/api/dev/openapi-file?path=gateway.yaml')
  })
})
