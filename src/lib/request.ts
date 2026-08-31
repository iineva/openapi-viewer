import type { Operation, PreparedRequest, RequestValues } from '../types/openapi'

export function buildRequest(operation: Operation, values: RequestValues): PreparedRequest {
  const path = operation.path.replace(/\{([^}]+)\}/g, (_, name: string) => encodeURIComponent(values.path[name] ?? `{${name}}`))
  const url = new URL(joinUrl(operation.serverUrl, path), operation.documentUrl ?? window.location.origin)

  for (const [name, value] of Object.entries(values.query)) {
    if (value) {
      url.searchParams.set(name, value)
    }
  }

  const headers = Object.fromEntries(Object.entries(values.headers).filter(([, value]) => value.trim()))
  if (values.body && values.bodyMediaType && !Object.keys(headers).some((name) => name.toLocaleLowerCase() === 'content-type')) {
    headers['Content-Type'] = values.bodyMediaType
  }

  return {
    method: operation.method.toUpperCase(),
    url: url.toString(),
    headers,
    body: values.body,
  }
}

function joinUrl(serverUrl: string | undefined, path: string): string {
  if (!serverUrl) {
    return path
  }

  return `${serverUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}
