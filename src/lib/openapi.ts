import { dereference, upgrade } from '@scalar/openapi-parser'
import Pinyin from 'tiny-pinyin'
import type { ApiDocument, HttpMethod, Operation, OperationDefinition, Parameter, PathItem } from '../types/openapi'

const HTTP_METHODS: HttpMethod[] = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']
const HAN_CHARACTERS = /[\u3400-\u9fff]/
const PINYIN_VARIANTS = new Map<string, string[]>()

export async function parseSpecification(content: string): Promise<ApiDocument> {
  if (!content.trim()) {
    throw new Error('The specification is empty.')
  }

  const upgraded = upgrade(content).specification as ApiDocument
  const result = dereference(upgraded)

  if (result.errors?.length) {
    throw new Error(result.errors.map(({ message }) => message).join('; '))
  }

  // Dereferencing validates the whole document, but returning it would erase
  // component $ref names that identify generated Proto message types.
  return upgraded
}

export function getOperations(document: ApiDocument, documentUrl?: string): Operation[] {
  return Object.entries(document.paths ?? {}).flatMap(([path, pathItem]) => {
    if (!pathItem || typeof pathItem !== 'object') {
      return []
    }

    return HTTP_METHODS.flatMap((method) => {
      const definition = pathItem[method]
      if (!definition || typeof definition !== 'object') {
        return []
      }

      return [{
        key: `${method}-${path}`,
        method,
        path,
        definition: definition as OperationDefinition,
        parameters: mergeParameters(pathItem.parameters, (definition as OperationDefinition).parameters),
        documentUrl,
        serverUrl: findServerUrl(document, pathItem, definition as OperationDefinition),
      }]
    })
  })
}

export function searchOperations(operations: Operation[], term: string, schemas?: Record<string, unknown>): Operation[] {
  const query = term.trim().toLocaleLowerCase()
  if (!query) {
    return operations
  }

  return operations.filter((operation) => [
    operation.method,
    operation.path,
    operation.definition.summary,
    operation.definition.operationId,
    ...(operation.definition.tags ?? []),
    ...collectSearchTerms(operation.parameters),
    ...collectSearchTerms(operation.definition),
    ...collectReferencedSchemaTerms(operation.definition, schemas),
  ].some((value) => matchesSearch(value, query)))
}

function matchesSearch(value: string | undefined, query: string): boolean {
  if (!value) return false
  const normalized = value.toLocaleLowerCase()
  if (normalized.includes(query) || !HAN_CHARACTERS.test(value)) return normalized.includes(query)

  const variants = PINYIN_VARIANTS.get(value) ?? [
    Pinyin.parse(value).map(({ target }) => target[0]).join('').toLocaleLowerCase(),
    Pinyin.convertToPinyin(value, '', true),
  ]
  PINYIN_VARIANTS.set(value, variants)
  return variants.some((variant) => variant.includes(query))
}

function collectSearchTerms(value: unknown, seen = new WeakSet<object>()): string[] {
  if (typeof value === 'string') {
    return [value]
  }
  if (!value || typeof value !== 'object') {
    return []
  }
  if (seen.has(value)) {
    return []
  }
  seen.add(value)

  return Object.entries(value).flatMap(([key, nested]) => [key, ...collectSearchTerms(nested, seen)])
}

function collectReferencedSchemaTerms(value: unknown, schemas?: Record<string, unknown>, seenReferences = new Set<string>(), seenValues = new WeakSet<object>()): string[] {
  if (!value || typeof value !== 'object' || seenValues.has(value)) return []
  seenValues.add(value)

  const record = value as Record<string, unknown>
  const reference = typeof record.$ref === 'string' ? record.$ref.match(/^#\/components\/schemas\/(.+)$/)?.[1] : undefined
  const resolved = reference && !seenReferences.has(reference) ? schemas?.[reference] : undefined
  if (reference) seenReferences.add(reference)

  return [
    ...(reference ? [reference] : []),
    ...(resolved === undefined ? [] : collectSearchTerms(resolved)),
    ...(resolved === undefined ? [] : collectReferencedSchemaTerms(resolved, schemas, seenReferences, seenValues)),
    ...Object.values(record).flatMap((nested) => collectReferencedSchemaTerms(nested, schemas, seenReferences, seenValues)),
  ]
}

function mergeParameters(pathParameters?: Parameter[], operationParameters?: Parameter[]): Parameter[] {
  const parameters = new Map<string, Parameter>()
  for (const parameter of [...(pathParameters ?? []), ...(operationParameters ?? [])]) {
    parameters.set(`${parameter.in}:${parameter.name}`, parameter)
  }
  return [...parameters.values()]
}

function findServerUrl(document: ApiDocument, pathItem: PathItem, definition: OperationDefinition): string | undefined {
  const server = definition.servers?.[0] ?? pathItem.servers?.[0] ?? document.servers?.[0]
  if (server?.url) {
    return expandServerVariables(server.url, server)
  }

  if (document.swagger === '2.0' && document.host) {
    const scheme = document.schemes?.[0] ?? 'https'
    return `${scheme}://${document.host}${document.basePath ?? ''}`
  }

  return undefined
}

function expandServerVariables(url: string, server: Record<string, unknown>): string {
  const variables = server.variables as Record<string, { default?: string }> | undefined
  return url.replace(/\{([^}]+)\}/g, (_, name: string) => variables?.[name]?.default ?? `{${name}}`)
}
