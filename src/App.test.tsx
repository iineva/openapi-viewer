import 'fake-indexeddb/auto'
import { fireEvent, render, screen } from '@testing-library/react'
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
    window.history.replaceState(null, '', '/')
    indexedDB.deleteDatabase('openapi-viewer')
  })

  it('loads a local document, filters its operations, and reads the selected operation', async () => {
    render(<App />)

    expect(screen.getByRole('button', { name: /open file/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /load url/i })).toBeInTheDocument()

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
