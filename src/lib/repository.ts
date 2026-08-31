import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { StoredDocument } from '../types/openapi'

const DATABASE_NAME = 'openapi-viewer'
const HISTORY_LIMIT = 20

interface DocumentDatabase extends DBSchema {
  documents: {
    key: string
    value: StoredDocument
  }
}

export const documentRepository = {
  async list(): Promise<StoredDocument[]> {
    return withDatabase(async (database) => {
      const documents = await database.getAll('documents')
      return documents.sort((first, second) => second.lastOpenedAt.localeCompare(first.lastOpenedAt))
    })
  },

  async save(record: StoredDocument): Promise<void> {
    await withDatabase(async (database) => {
      await database.put('documents', record)
      const documents = await database.getAll('documents')
      const excess = documents
        .sort((first, second) => second.lastOpenedAt.localeCompare(first.lastOpenedAt))
        .slice(HISTORY_LIMIT)

      await Promise.all(excess.map(({ id }) => database.delete('documents', id)))
    })
  },

  async remove(id: string): Promise<void> {
    await withDatabase((database) => database.delete('documents', id))
  },

  async clear(): Promise<void> {
    await withDatabase((database) => database.clear('documents'))
  },
}

async function withDatabase<T>(operation: (database: IDBPDatabase<DocumentDatabase>) => Promise<T>): Promise<T> {
  const database = await openDB<DocumentDatabase>(DATABASE_NAME, 1, {
    upgrade(db) {
      db.createObjectStore('documents', { keyPath: 'id' })
    },
  })

  try {
    return await operation(database)
  } finally {
    database.close()
  }
}
