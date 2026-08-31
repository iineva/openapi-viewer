import type { Operation, PreparedRequest, RequestValues } from '../types/openapi'

export function buildRequest(operation: Operation, values: RequestValues): PreparedRequest {
  const path = operation.path.replace(/\{([^}]+)\}/g, (_, name: string) => encodeURIComponent(values.path[name] ?? `{${name}}`))
  const url = new URL(joinUrl(operation.serverUrl, path), window.location.origin)

  for (const [name, value] of Object.entries(values.query)) {
    if (value) {
      url.searchParams.set(name, value)
    }
  }

  return {
    method: operation.method.toUpperCase(),
    url: url.toString(),
    headers: { ...values.headers },
    body: values.body,
  }
}

function joinUrl(serverUrl: string | undefined, path: string): string {
  if (!serverUrl) {
    return path
  }

  return `${serverUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}
