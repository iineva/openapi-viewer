import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { documentRepository } from './repository'
import type { StoredDocument } from '../types/openapi'

function record(id: string, lastOpenedAt: string): StoredDocument {
  return {
    id,
    name: `Document ${id}`,
    sourceKind: 'file',
    sourceValue: `document-${id}.yaml`,
    content: 'openapi: 3.1.0\ninfo: { title: Test, version: 1.0.0 }\npaths: {}',
    createdAt: '2026-08-31T00:00:00.000Z',
    lastOpenedAt,
  }
}

async function deleteTestDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('openapi-viewer')
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => resolve()
  })
}

describe('document repository', () => {
  beforeEach(deleteTestDatabase)
  afterEach(deleteTestDatabase)

  it('lists saved documents with most recently opened first', async () => {
    await documentRepository.save(record('older', '2026-08-31T01:00:00.000Z'))
    await documentRepository.save(record('newer', '2026-08-31T02:00:00.000Z'))

    expect((await documentRepository.list()).map(({ id }) => id)).toEqual(['newer', 'older'])
  })

  it('trims the oldest documents when history exceeds twenty entries', async () => {
    for (let index = 0; index < 21; index += 1) {
      await documentRepository.save(record(String(index), `2026-08-31T00:00:${String(index).padStart(2, '0')}.000Z`))
    }

    const documents = await documentRepository.list()

    expect(documents).toHaveLength(20)
    expect(documents.map(({ id }) => id)).not.toContain('0')
    expect(documents[0]?.id).toBe('20')
  })

  it('removes an individual document and clears remaining history', async () => {
    await documentRepository.save(record('first', '2026-08-31T01:00:00.000Z'))
    await documentRepository.save(record('second', '2026-08-31T02:00:00.000Z'))

    await documentRepository.remove('first')
    expect((await documentRepository.list()).map(({ id }) => id)).toEqual(['second'])

    await documentRepository.clear()
    await expect(documentRepository.list()).resolves.toEqual([])
  })
})
