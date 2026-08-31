import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadFileDocument, loadRemoteDocument } from './documents'

const YAML = `openapi: 3.1.0
info:
  title: Pets
  version: 1.0.0
paths: {}`

function sourceFile(name: string, content: string): File {
  return { name, text: async () => content } as File
}

describe('document loaders', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('loads a supported local YAML file with its source metadata', async () => {
    const result = await loadFileDocument(sourceFile('pets.yaml', YAML))

    expect(result.record).toMatchObject({
      name: 'pets.yaml',
      sourceKind: 'file',
      sourceValue: 'pets.yaml',
      content: YAML,
    })
    expect(result.specification).toMatchObject({ openapi: '3.1.0', info: { title: 'Pets' } })
  })

  it('rejects local files with unsupported extensions before reading them', async () => {
    await expect(loadFileDocument(sourceFile('pets.txt', YAML))).rejects.toThrow('YAML, YML, or JSON')
  })

  it('reports invalid local document content', async () => {
    await expect(loadFileDocument(sourceFile('pets.json', '{'))).rejects.toThrow()
  })

  it('loads a remote JSON document and retains the canonical URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      openapi: '3.1.0', info: { title: 'Remote Pets', version: '1.0.0' }, paths: {},
    }))))

    const result = await loadRemoteDocument('https://example.test/openapi.json')

    expect(result.record).toMatchObject({
      sourceKind: 'url',
      sourceValue: 'https://example.test/openapi.json',
      content: expect.stringContaining('Remote Pets'),
    })
    expect(result.specification).toMatchObject({ info: { title: 'Remote Pets' } })
  })

  it('includes failed remote HTTP statuses in the error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Missing', { status: 404 })))

    await expect(loadRemoteDocument('https://example.test/openapi.yaml')).rejects.toThrow('HTTP 404')
  })

  it('rejects URLs that embed credentials so they cannot enter document history', async () => {
    await expect(loadRemoteDocument('https://token@example.test/openapi.yaml')).rejects.toThrow('credentials')
  })

  it('explains browser CORS or network failures without suggesting a proxy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(loadRemoteDocument('https://example.test/openapi.yaml')).rejects.toThrow(/CORS or network/i)
  })
})
