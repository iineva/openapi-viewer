import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import LocalDocumentsPanel from './LocalDocumentsPanel'

describe('LocalDocumentsPanel', () => {
  it('opens a selected development OpenAPI file', () => {
    const onOpen = vi.fn()
    render(<LocalDocumentsPanel files={[{ path: 'gateway.yaml', title: 'Gateway', version: '1.0.0' }]} onOpen={onOpen} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open gateway.yaml' }))

    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ path: 'gateway.yaml' }))
  })
})
