import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { documentRepository } from './lib/repository'

const PETS_DOCUMENT = `openapi: 3.1.0
info:
  title: Pet API
  version: 1.0.0
paths:
  /pets:
    get:
      summary: List pets
      tags: [pets]
      responses:
        '200':
          description: A list of pets
  /users:
    get:
      summary: List users
      tags: [users]
      responses:
        '200':
          description: A list of users
`

function openApiFile(): File {
  const file = new File([PETS_DOCUMENT], 'pets.yaml', { type: 'application/yaml' })
  Object.defineProperty(file, 'text', { value: async () => PETS_DOCUMENT })
  return file
}

describe('App', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    window.history.replaceState(null, '', '/')
    indexedDB.deleteDatabase('openapi-viewer')
    window.localStorage.clear()
  })

  it('keeps source actions in an overflow menu on narrow screens', async () => {
    render(<App />)

    expect(screen.getByRole('button', { name: /open source actions/i })).toBeInTheDocument()
    expect(screen.queryByText(/^open file$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^load url$/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /open source actions/i }))

    expect(await screen.findByRole('menuitem', { name: 'Open file' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Load URL' })).toBeInTheDocument()
  })

  it('loads a local document, filters its operations, and reads the selected operation', async () => {
    render(<App />)

    fireEvent.change(screen.getByLabelText(/openapi file/i), { target: { files: [openApiFile()] } })

    expect(await screen.findByRole('heading', { name: '/pets' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /open operation navigation/i }))

    fireEvent.change(screen.getByPlaceholderText(/search endpoints/i), { target: { value: 'pets' } })

    const petsOperation = (await screen.findByTitle('/pets')).closest('button')
    expect(petsOperation).toHaveTextContent('GET')
    await waitFor(() => expect(screen.queryByText('/users')).not.toBeInTheDocument())

    fireEvent.click(petsOperation!)

    expect(await screen.findByRole('heading', { name: '/pets' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '/users' })).not.toBeInTheDocument()
    expect(window.location.hash).toBe('#get-/pets')
  }, 10_000)

  it('restores the most recently opened document on page load', async () => {
    await documentRepository.save({
      content: PETS_DOCUMENT,
      createdAt: '2026-08-31T00:00:00.000Z',
      id: 'most-recent',
      lastOpenedAt: '2026-08-31T12:00:00.000Z',
      name: 'pets.yaml',
      sourceKind: 'file',
      sourceValue: 'pets.yaml',
    })

    render(<App />)

    expect(await screen.findByRole('heading', { name: '/pets' })).toBeInTheDocument()
  })

  it('refreshes a restored remote document after showing its cached content', async () => {
    let resolveFetch: ((response: Response) => void) | undefined
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { resolveFetch = resolve })))
    await documentRepository.save({
      content: PETS_DOCUMENT,
      createdAt: '2026-08-31T00:00:00.000Z',
      id: 'remote-cache',
      lastOpenedAt: '2026-08-31T12:00:00.000Z',
      name: 'openapi.yaml',
      sourceKind: 'url',
      sourceValue: 'https://example.test/openapi.yaml',
    })

    render(<App />)

    expect(await screen.findByRole('heading', { name: '/pets' })).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('https://example.test/openapi.yaml')

    resolveFetch?.(new Response(`openapi: 3.1.0
info: { title: Fresh API, version: 1.0.0 }
paths:
  /fresh:
    get:
      summary: Fresh endpoint
`, { status: 200 }))

    expect(await screen.findByRole('heading', { name: '/fresh' })).toBeInTheDocument()
    await waitFor(async () => expect((await documentRepository.list())[0]).toMatchObject({
      content: expect.stringContaining('/fresh'),
      id: 'remote-cache',
    }))
  })

  it('persists a resized desktop endpoint panel', () => {
    const previousMatchMedia = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: () => undefined,
      addListener: () => undefined,
      dispatchEvent: () => false,
      matches: query.includes('min-width'),
      media: query,
      onchange: null,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
    }))

    render(<App />)
    expect(screen.getByLabelText('Viewer panes')).not.toHaveClass('ant-layout')
    const separator = screen.getByRole('separator', { name: 'Resize endpoint panel' })
    fireEvent.pointerDown(separator, { clientX: 500 })
    fireEvent.pointerMove(window, { clientX: 560 })
    fireEvent.pointerUp(window)

    expect(JSON.parse(window.localStorage.getItem('openapi-viewer:panel-widths') ?? '{}')).toMatchObject({ navigation: 332 })
    window.matchMedia = previousMatchMedia
  })

  it('collapses and restores the desktop history panel', () => {
    const previousMatchMedia = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: () => undefined,
      addListener: () => undefined,
      dispatchEvent: () => false,
      matches: query.includes('min-width'),
      media: query,
      onchange: null,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
    }))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Collapse document history' }))
    expect(screen.queryByRole('region', { name: 'Document history' })).not.toBeInTheDocument()
    expect(screen.queryByRole('separator', { name: 'Resize history panel' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Expand document history' }))
    expect(screen.getByRole('region', { name: 'Document history' })).toBeInTheDocument()
    expect(screen.getByRole('separator', { name: 'Resize history panel' })).toBeInTheDocument()
    window.matchMedia = previousMatchMedia
  })
})
