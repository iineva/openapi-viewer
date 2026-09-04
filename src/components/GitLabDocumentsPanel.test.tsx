import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import GitLabDocumentsPanel from './GitLabDocumentsPanel'

describe('GitLabDocumentsPanel', () => {
  it('lists scanned OpenAPI files for the selected repository', () => {
    const onOpen = vi.fn()
    render(<GitLabDocumentsPanel files={[{ path: 'api/openapi.yaml', sha: 'abc', title: 'Gateway API', version: '3.1.1' }]} projectName="platform/gateway" refName="main" onOpen={onOpen} />)

    expect(screen.getByText('platform/gateway')).toBeInTheDocument()
    expect(screen.getByText('main')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /open api\/openapi\.yaml/i }))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ path: 'api/openapi.yaml' }))
  })

  it('uses the GitLab brand icon', () => {
    const { container } = render(<GitLabDocumentsPanel files={[]} projectName="platform/gateway" refName="main" onOpen={() => undefined} />)

    expect(container.querySelector('.anticon-gitlab')).toBeInTheDocument()
    expect(container.querySelector('.anticon-github')).not.toBeInTheDocument()
  })
})
