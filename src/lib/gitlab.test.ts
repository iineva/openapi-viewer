import { afterEach, describe, expect, it, vi } from 'vitest'
import { scanGitLabOpenAPIFiles } from './gitlab'

describe('GitLab API client', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends the selected ref to the server-side scanner', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ path: 'api/openapi.yaml', sha: 'abc', title: 'Gateway', version: '1.0.0' }]), { status: 200 }))
    vi.stubGlobal('fetch', fetch)

    await expect(scanGitLabOpenAPIFiles(42, 'main')).resolves.toEqual([{ path: 'api/openapi.yaml', sha: 'abc', title: 'Gateway', version: '1.0.0' }])
    expect(fetch).toHaveBeenCalledWith('/api/gitlab/projects/42/scan', expect.objectContaining({
      body: JSON.stringify({ ref: 'main' }),
      method: 'POST',
    }))
  })
})
