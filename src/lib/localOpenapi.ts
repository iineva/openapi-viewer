export interface LocalOpenAPIFile {
  path: string
  title: string
  version: string
}

async function request<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: response.statusText })) as { error?: string }
    throw new Error(payload.error || `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export function localOpenAPIFiles(): Promise<LocalOpenAPIFile[]> {
  return request('/api/dev/openapi-files')
}

export async function localOpenAPIFileContent(path: string): Promise<string> {
  const query = new URLSearchParams({ path })
  return (await request<{ content: string }>(`/api/dev/openapi-file?${query}`)).content
}

export async function defaultLocalOpenAPI(): Promise<{ content: string; name: string } | undefined> {
  try {
    return await request('/api/dev/openapi-default')
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'no local OpenAPI file configured') return undefined
    throw cause
  }
}
