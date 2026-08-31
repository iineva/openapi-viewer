import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RequestDrawer from './RequestDrawer'
import type { Operation } from '../types/openapi'

const operation: Operation = {
  key: 'post-/pets/{id}',
  method: 'post',
  path: '/pets/{id}',
  serverUrl: 'https://api.example.com',
  parameters: [
    { in: 'path', name: 'id', required: true },
    { in: 'query', name: 'include' },
    { in: 'header', name: 'X-Request-ID' },
  ],
  definition: {},
}

describe('RequestDrawer', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('blocks a request when a required path parameter is blank', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<RequestDrawer onClose={() => undefined} open operation={operation} />)

    fireEvent.click(screen.getByRole('button', { name: /send request/i }))

    expect(await screen.findByText(/required path parameter: id/i)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends edited path, query, header, and body values then renders a JSON response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      headers: new Headers({ 'content-type': 'application/json', 'x-trace-id': 'trace-7' }),
      status: 201,
      statusText: 'Created',
      text: async () => '{"created":true}',
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<RequestDrawer onClose={() => undefined} open operation={operation} />)

    fireEvent.change(screen.getByLabelText('Path parameter id'), { target: { value: 'pet-7' } })
    fireEvent.change(screen.getByLabelText('Query parameter include'), { target: { value: 'owner' } })
    fireEvent.change(screen.getByLabelText('Header X-Request-ID'), { target: { value: 'request-7' } })
    fireEvent.change(screen.getByLabelText('Request body'), { target: { value: '{"name":"Milo"}' } })
    fireEvent.click(screen.getByRole('button', { name: /send request/i }))

    expect(await screen.findByText('201 Created')).toBeInTheDocument()
    expect(screen.getByText('x-trace-id')).toBeInTheDocument()
    expect(screen.getByText('trace-7')).toBeInTheDocument()
    expect(screen.getByText((_, element) => element?.tagName === 'PRE' && element.textContent === '{\n  "created": true\n}')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/pets/pet-7?include=owner', {
      body: '{"name":"Milo"}',
      headers: { 'X-Request-ID': 'request-7' },
      method: 'POST',
    })
  })

  it('renders a non-JSON response as text', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      headers: new Headers({ 'content-type': 'text/plain' }),
      status: 204,
      statusText: 'No Content',
      text: async () => 'No pets found',
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<RequestDrawer onClose={() => undefined} open operation={operation} />)

    fireEvent.change(screen.getByLabelText('Path parameter id'), { target: { value: 'pet-7' } })
    fireEvent.click(screen.getByRole('button', { name: /send request/i }))

    expect(await screen.findByText('204 No Content')).toBeInTheDocument()
    expect(screen.getByText('No pets found')).toBeInTheDocument()
  })

  it('preserves the selected request media type and omits blank optional headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      headers: new Headers(),
      status: 202,
      statusText: 'Accepted',
      text: async () => '',
    })
    vi.stubGlobal('fetch', fetchMock)
    const textOperation: Operation = {
      ...operation,
      definition: {
        requestBody: {
          content: {
            'text/plain': { example: 'prefilled text' },
          },
        },
      },
    }

    render(<RequestDrawer onClose={() => undefined} open operation={textOperation} />)

    expect(screen.getByLabelText('Request body')).toHaveValue('prefilled text')
    fireEvent.change(screen.getByLabelText('Path parameter id'), { target: { value: 'pet-7' } })
    fireEvent.click(screen.getByRole('button', { name: /send request/i }))

    expect(await screen.findByText('202 Accepted')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/pets/pet-7', {
      body: 'prefilled text',
      headers: { 'Content-Type': 'text/plain' },
      method: 'POST',
    })
  })
})
