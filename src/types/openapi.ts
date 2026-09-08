export type HttpMethod = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace'

export interface ApiDocument {
  openapi?: string
  swagger?: string
  info?: { title?: string; version?: string; [key: string]: unknown }
  servers?: Array<{ url: string; [key: string]: unknown }>
  host?: string
  basePath?: string
  schemes?: string[]
  paths?: Record<string, PathItem>
  [key: string]: unknown
}

export type OperationDefinition = Record<string, unknown> & {
  summary?: string
  description?: string
  operationId?: string
  tags?: string[]
  parameters?: Parameter[]
  servers?: Array<{ url: string; [key: string]: unknown }>
}

export type Parameter = Record<string, unknown> & {
  name: string
  in: 'path' | 'query' | 'header' | 'cookie'
  required?: boolean
}

export type PathItem = Record<string, unknown> & Partial<Record<HttpMethod, OperationDefinition>> & {
  parameters?: Parameter[]
  servers?: Array<{ url: string; [key: string]: unknown }>
}

export interface Operation {
  key: string
  method: HttpMethod
  path: string
  definition: OperationDefinition
  parameters: Parameter[]
  documentUrl?: string
  serverUrl?: string
}

export interface RequestValues {
  path: Record<string, string>
  query: Record<string, string>
  headers: Record<string, string>
  body: string
  bodyMediaType?: string
}

export interface PreparedRequest {
  method: string
  url: string
  headers: Record<string, string>
  body: string
}

export type SourceKind = 'file' | 'url' | 'local' | 'gitlab'

export interface StoredDocument {
  id: string
  name: string
  sourceKind: SourceKind
  sourceValue: string
  content: string
  createdAt: string
  lastOpenedAt: string
}

export interface LoadedDocument {
  record: StoredDocument
  specification: ApiDocument
}

export type LoadResult = LoadedDocument
