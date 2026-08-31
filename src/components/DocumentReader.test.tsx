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
    requestBody: {
      content: {
        'application/json': {
          example: { displayName: 'Ada' },
          schema: {
            properties: {
              displayName: { description: 'Public profile name', type: 'string' },
            },
            required: ['displayName'],
            type: 'object',
          },
        },
      },
      description: 'Member profile payload',
    },
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
  it('renders request and response schemas as readable fields and examples', () => {
    render(<DocumentReader document={document} operations={[operation]} selectedOperationKey={operation.key} />)

    const details = screen.getByRole('region', { name: 'Response 200 details' })
    expect(within(details).getByText('application/json')).toBeInTheDocument()
    expect(within(details).getByText('text/plain')).toBeInTheDocument()
    expect(within(details).getByText('application/x-custom')).toBeInTheDocument()
    expect(within(details).getByText('Headers')).toBeInTheDocument()
    expect(within(details).getAllByText('Fields')).toHaveLength(1)
    expect(within(details).getAllByText('Examples')).toHaveLength(2)
    expect(details).toHaveTextContent('X-Rate-Limit')
    expect(details).toHaveTextContent('id')
    expect(details).toHaveTextContent('Named pet')
    expect(screen.getByText('Member profile payload')).toBeInTheDocument()
    expect(screen.getByText('displayName')).toBeInTheDocument()
    expect(screen.getByText('Public profile name')).toBeInTheDocument()
    expect(screen.queryByText('properties')).not.toBeInTheDocument()
  })
})
