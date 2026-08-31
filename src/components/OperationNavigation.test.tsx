import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OperationNavigation from './OperationNavigation'
import type { Operation } from '../types/openapi'

const operations: Operation[] = [
  { definition: { summary: 'List pets', tags: ['pets'] }, key: 'get-/pets', method: 'get', parameters: [], path: '/pets' },
  { definition: { summary: 'List users', tags: ['users'] }, key: 'get-/users', method: 'get', parameters: [], path: '/users' },
]

describe('OperationNavigation', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('debounces operation search input before filtering the tree', () => {
    vi.useFakeTimers()
    render(<OperationNavigation onSelect={() => undefined} operations={operations} />)

    fireEvent.change(screen.getByPlaceholderText('Search endpoints'), { target: { value: 'pets' } })

    expect(screen.getByText('/users')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(249))
    expect(screen.getByText('/users')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByText('/users')).not.toBeInTheDocument()
    expect(screen.getByText('/pets')).toBeInTheDocument()
  })

  it('shows each operation summary below its route', () => {
    render(<OperationNavigation onSelect={() => undefined} operations={operations} />)

    expect(screen.getByRole('button', { name: 'pets' })).toBeInTheDocument()
    expect(screen.getByText('List pets')).toBeInTheDocument()
    expect(screen.getByText('List users')).toBeInTheDocument()
  })

  it('keeps a long route readable without expanding the navigation item', () => {
    const longPath = '/bagan-api/member/v2/getMembersPersonalizationFilled/with-a-long-resource-name'
    const longOperation: Operation = {
      definition: { summary: 'Long route', tags: ['gateway'] },
      key: `get-${longPath}`,
      method: 'get',
      parameters: [],
      path: longPath,
    }

    render(<OperationNavigation onSelect={() => undefined} operations={[longOperation]} />)

    expect(screen.getByTitle(longPath)).toHaveTextContent(longPath)
  })
})
