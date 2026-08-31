import { parseSpecification } from './openapi'
import type { LoadResult, SourceKind, StoredDocument } from '../types/openapi'

const SUPPORTED_FILE_EXTENSION = /\.(?:yaml|yml|json)$/i

export async function loadFileDocument(file: File): Promise<LoadResult> {
  if (!SUPPORTED_FILE_EXTENSION.test(file.name)) {
    throw new Error('Choose an OpenAPI YAML, YML, or JSON file.')
  }

  let content: string
  try {
    content = await file.text()
  } catch {
    throw new Error(`Unable to read the file "${file.name}".`)
  }

  return loadDocument(file.name, 'file', file.name, content)
}

export async function loadRemoteDocument(url: string): Promise<LoadResult> {
  const canonicalUrl = validateUrl(url)
  let response: Response

  try {
    response = await fetch(canonicalUrl)
  } catch {
    throw new Error('Unable to load this URL because of a browser CORS or network failure. The remote server must allow this browser origin.')
  }

  if (!response.ok) {
    throw new Error(`Unable to load this URL: HTTP ${response.status} ${response.statusText}`.trim())
  }

  const content = await response.text()
  const name = getRemoteName(canonicalUrl)
  return loadDocument(name, 'url', canonicalUrl, content)
}

async function loadDocument(name: string, sourceKind: SourceKind, sourceValue: string, content: string): Promise<LoadResult> {
  if (!content.trim()) {
    throw new Error('The specification is empty.')
  }

  const specification = await parseSpecification(content)
  const now = new Date().toISOString()
  const record: StoredDocument = {
    id: createDocumentId(),
    name,
    sourceKind,
    sourceValue,
    content,
    createdAt: now,
    lastOpenedAt: now,
  }

  return { record, specification }
}

function validateUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('Enter a valid HTTP or HTTPS URL.')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Enter a valid HTTP or HTTPS URL.')
  }

  if (url.username || url.password) {
    throw new Error('URLs with embedded credentials cannot be saved in document history.')
  }

  return url.toString()
}

function getRemoteName(url: string): string {
  const { hostname, pathname } = new URL(url)
  return pathname.split('/').filter(Boolean).at(-1) ?? hostname
}

function createDocumentId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
