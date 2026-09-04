export interface GitLabUser {
  id: number
  name: string
  username: string
}

export interface GitLabProject {
  default_branch: string
  id: number
  name: string
  path_with_namespace: string
}

export interface GitLabBranch {
  name: string
}

export interface GitLabOpenAPIFile {
  path: string
  sha: string
  title: string
  version: string
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: response.statusText })) as { error?: string }
    throw new Error(payload.error || `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export function gitLabSession(): Promise<GitLabUser> {
  return request('/api/auth/session')
}

export function gitLabProjects(): Promise<GitLabProject[]> {
  return request('/api/gitlab/projects')
}

export function gitLabBranches(projectID: number): Promise<GitLabBranch[]> {
  return request(`/api/gitlab/projects/${projectID}/refs`)
}

export function scanGitLabOpenAPIFiles(projectID: number, ref: string): Promise<GitLabOpenAPIFile[]> {
  return request(`/api/gitlab/projects/${projectID}/scan`, {
    body: JSON.stringify({ ref }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
}

export async function gitLabFileContent(projectID: number, ref: string, path: string): Promise<string> {
  const query = new URLSearchParams({ path, ref })
  const response = await request<{ content: string }>(`/api/gitlab/projects/${projectID}/file?${query}`)
  return response.content
}
