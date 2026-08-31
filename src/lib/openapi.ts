import { dereference, upgrade } from '@scalar/openapi-parser'
import type { ApiDocument, HttpMethod, Operation, OperationDefinition, Parameter, PathItem } from '../types/openapi'

const HTTP_METHODS: HttpMethod[] = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']

export async function parseSpecification(content: string): Promise<ApiDocument> {
  if (!content.trim()) {
    throw new Error('The specification is empty.')
  }

  const upgraded = upgrade(content).specification as ApiDocument
  const result = dereference(upgraded)

  if (result.errors?.length) {
    throw new Error(result.errors.map(({ message }) => message).join('; '))
  }

  return (result.schema ?? result.specification ?? upgraded) as ApiDocument
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

export function searchOperations(operations: Operation[], term: string): Operation[] {
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
  ].some((value) => value?.toLocaleLowerCase().includes(query)))
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
