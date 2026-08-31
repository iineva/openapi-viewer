import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

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
    window.history.replaceState(null, '', '/')
    indexedDB.deleteDatabase('openapi-viewer')
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

    expect(await screen.findByRole('heading', { name: 'Pet API' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /open operation navigation/i }))

    fireEvent.change(screen.getByPlaceholderText(/search endpoints/i), { target: { value: 'pets' } })

    const petsOperation = (await screen.findByText('/pets')).closest('button')
    expect(petsOperation).toHaveTextContent('GET')
    expect(screen.queryByText('/users')).not.toBeInTheDocument()

    fireEvent.click(petsOperation!)

    expect(await screen.findByRole('heading', { name: 'GET /pets' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#get-/pets')
  })
})
