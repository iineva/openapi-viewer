import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import DocumentReader from './DocumentReader'
import type { ApiDocument, Operation } from '../types/openapi'

const document: ApiDocument = {
  openapi: '3.1.0',
  info: { title: 'Detailed API', version: '1.0.0' },
}

const operation: Operation = {
  definition: {
    responses: {
      '200': {
        content: {
          'application/json': {
            example: { id: 7 },
            examples: { named: { summary: 'Named pet', value: { id: 8 } } },
            schema: { properties: { id: { type: 'integer' } }, type: 'object' },
          },
          'text/plain': {
            examples: { empty: { value: 'No pet' } },
            schema: { type: 'string' },
          },
          'application/x-custom': 'opaque-response-shape',
        },
        description: 'A detailed pet response',
        headers: {
          'X-Rate-Limit': { description: 'Requests remaining', schema: { type: 'integer' } },
        },
      },
    },
  },
  key: 'get-/pets/7',
  method: 'get',
  parameters: [],
  path: '/pets/7',
}

describe('DocumentReader', () => {
  it('renders response media types, schemas, headers, examples, and unknown shapes', () => {
    render(<DocumentReader document={document} onSelect={() => undefined} operations={[operation]} />)

    const details = screen.getByRole('region', { name: 'Response 200 details' })
    expect(within(details).getByText('application/json')).toBeInTheDocument()
    expect(within(details).getByText('text/plain')).toBeInTheDocument()
    expect(within(details).getByText('application/x-custom')).toBeInTheDocument()
    expect(within(details).getByText('Headers')).toBeInTheDocument()
    expect(within(details).getAllByText('Schema')).toHaveLength(2)
    expect(within(details).getAllByText('Examples')).toHaveLength(2)
    expect(details).toHaveTextContent('X-Rate-Limit')
    expect(details).toHaveTextContent('Named pet')
    expect(details).toHaveTextContent('opaque-response-shape')
  })
})
