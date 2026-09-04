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
    window.localStorage.clear()
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
    expect(screen.getByTitle('/pets')).toBeInTheDocument()
  })

  it('shows each operation summary below its route', () => {
    render(<OperationNavigation onSelect={() => undefined} operations={operations} />)

    expect(screen.getByRole('button', { name: 'pets' })).toBeInTheDocument()
    expect(screen.getByTitle('/pets').previousElementSibling).toHaveClass('method')
    expect(screen.getByText('List pets')).toBeInTheDocument()
    expect(screen.getByText('List users')).toBeInTheDocument()
  })

  it('highlights direct and pinyin matches in endpoint text', () => {
    vi.useFakeTimers()
    const chineseOperation: Operation = {
      definition: { summary: '查询会员信息', tags: ['gateway'] },
      key: 'get-/members',
      method: 'get',
      parameters: [],
      path: '/members',
    }
    render(<OperationNavigation onSelect={() => undefined} operations={[operations[0], chineseOperation]} />)

    fireEvent.change(screen.getByPlaceholderText('Search endpoints'), { target: { value: 'pets' } })
    act(() => vi.advanceTimersByTime(250))
    expect(screen.getAllByText('pets', { selector: 'mark' })).toHaveLength(2)

    fireEvent.change(screen.getByPlaceholderText('Search endpoints'), { target: { value: 'cxhy' } })
    act(() => vi.advanceTimersByTime(250))
    expect(screen.getByText('查询会员', { selector: 'mark' })).toBeInTheDocument()
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

  it('shows matching local search history and reuses the selected term', () => {
    window.localStorage.setItem('openapi-viewer:search-history', JSON.stringify(['previous filter']))
    render(<OperationNavigation onSelect={() => undefined} operations={operations} />)

    const input = screen.getByPlaceholderText('Search endpoints')
    fireEvent.focus(input)
    expect(screen.getByRole('option', { name: 'previous filter' })).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('previous filter'))
    expect(input).toHaveValue('previous filter')
  })

  it('persists recent searches locally and caps history at 100 terms', () => {
    vi.useFakeTimers()
    const existing = Array.from({ length: 100 }, (_, index) => `term-${index}`)
    window.localStorage.setItem('openapi-viewer:search-history', JSON.stringify(existing))
    render(<OperationNavigation onSelect={() => undefined} operations={operations} />)

    fireEvent.change(screen.getByPlaceholderText('Search endpoints'), { target: { value: 'new query' } })
    act(() => vi.advanceTimersByTime(250))

    expect(JSON.parse(window.localStorage.getItem('openapi-viewer:search-history') ?? '[]')).toEqual(['new query', ...existing.slice(0, 99)])
  })
})
