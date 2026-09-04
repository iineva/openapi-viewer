import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
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
        'application/schema-preview+json': {
          schema: {
            properties: { autoField: { type: 'string' } },
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
          'application/schema-preview+json': {
            schema: {
              properties: { autoResponse: { type: 'boolean' } },
              type: 'object',
            },
          },
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
  afterEach(cleanup)

  it('separates request body and response examples from their models', () => {
    render(<DocumentReader document={document} operations={[operation]} selectedOperationKey={operation.key} />)

    const request = screen.getByRole('region', { name: 'Request body content' })
    const details = screen.getByRole('region', { name: 'Response 200 details' })
    expect(within(details).getByText('application/json')).toBeInTheDocument()
    expect(within(details).getByText('text/plain')).toBeInTheDocument()
    expect(within(details).getByText('application/x-custom')).toBeInTheDocument()
    expect(within(details).getByText('Headers')).toBeInTheDocument()
    expect(within(details).getAllByText('Fields')).toHaveLength(2)
    expect(details).toHaveTextContent('X-Rate-Limit')
    expect(details).toHaveTextContent('id')
    expect(screen.getByText('Member profile payload')).toBeInTheDocument()
    expect(screen.getByText('displayName')).toBeInTheDocument()
    expect(screen.getByText('Public profile name')).toBeInTheDocument()
    expect(screen.queryByText('properties')).not.toBeInTheDocument()

    expect(within(request).getByRole('tab', { name: 'MODEL' })).toHaveAttribute('aria-selected', 'true')
    expect(within(request).getByRole('tab', { name: 'BODY' })).toBeInTheDocument()
    expect(within(details).getByRole('tab', { name: 'MODEL' })).toHaveAttribute('aria-selected', 'true')
    expect(within(details).getByRole('tab', { name: 'EXAMPLE' })).toBeInTheDocument()

    fireEvent.click(within(request).getByRole('tab', { name: 'BODY' }))
    expect(within(request).getAllByLabelText('JSON content')[0]).toHaveTextContent('Ada')
    expect(within(request).getAllByLabelText('JSON content')).toHaveLength(2)
    expect(within(request).getByText('"autoField"')).toBeInTheDocument()

    fireEvent.click(within(details).getByRole('tab', { name: 'EXAMPLE' }))
    expect(within(details).getAllByLabelText('JSON content')).toHaveLength(4)
    expect(details).toHaveTextContent('Named pet')
    expect(within(details).getByText('"autoResponse"')).toBeInTheDocument()
  }, 10_000)

  it('renders shared schemas as an expanded field table', () => {
    const referencedOperation: Operation = {
      ...operation,
      definition: {
        ...operation.definition,
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } } },
      },
    }
    render(<DocumentReader document={{ ...document, components: { schemas: { Pet: { description: 'A saved pet record', properties: { name: { type: 'string' } }, type: 'object' } } } }} operations={[referencedOperation]} selectedOperationKey={referencedOperation.key} />)

    const request = screen.getByRole('region', { name: 'Request body content' })
    expect(within(request).getByRole('cell', { name: 'name' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Schemas' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pet' })).toBeInTheDocument()
    expect(screen.getByText('A saved pet record')).toBeInTheDocument()
    expect(screen.getAllByText('Fields').at(-1)).toBeInTheDocument()
    expect(screen.getAllByRole('cell', { name: 'name' })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Schemas' })).not.toBeInTheDocument()
  })

  it('shows only schemas reachable from the selected operation', () => {
    const referencedOperation: Operation = {
      ...operation,
      definition: {
        ...operation.definition,
        requestBody: {
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Pet' } },
          },
        },
      },
    }
    const scopedDocument: ApiDocument = {
      ...document,
      components: {
        schemas: {
          Owner: { properties: { name: { type: 'string' } }, type: 'object' },
          Pet: { properties: { owner: { $ref: '#/components/schemas/Owner' } }, type: 'object' },
          Unrelated: { properties: { hidden: { type: 'boolean' } }, type: 'object' },
        },
      },
    }

    render(<DocumentReader document={scopedDocument} operations={[referencedOperation]} selectedOperationKey={referencedOperation.key} />)

    expect(screen.getByRole('heading', { name: 'Pet' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Owner' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Unrelated' })).not.toBeInTheDocument()
  })

  it('expands referenced nested types as a first-level schema tree', () => {
    const referencedOperation: Operation = {
      ...operation,
      definition: {
        ...operation.definition,
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } } },
      },
    }
    const referenceDocument: ApiDocument = {
      ...document,
      components: {
        schemas: {
          Owner: { properties: { displayName: { description: 'Owner name', type: 'string' } }, type: 'object' },
          Pet: { properties: { owner: { $ref: '#/components/schemas/Owner' } }, type: 'object' },
        },
      },
    }

    render(<DocumentReader document={referenceDocument} operations={[referencedOperation]} selectedOperationKey={referencedOperation.key} />)

    const request = screen.getByRole('region', { name: 'Request body content' })
    expect(within(request).getByText('displayName')).toBeInTheDocument()
    expect(within(request).getByText('Owner name')).toBeInTheDocument()
  })

  it('uses the Proto component name for dereferenced object fields', () => {
    const messageSchema = { properties: { text: { type: 'string' } }, type: 'object' }
    const dereferencedOperation: Operation = {
      ...operation,
      definition: {
        ...operation.definition,
        requestBody: {
          content: {
            'application/json': {
              schema: { properties: { message: messageSchema }, type: 'object' },
            },
          },
        },
      },
    }

    render(<DocumentReader document={{ ...document, components: { schemas: { 'gateway.v1.MsgBodyItem': messageSchema } } }} operations={[dereferencedOperation]} selectedOperationKey={dereferencedOperation.key} />)

    expect(screen.getByRole('link', { name: 'gateway.v1.MsgBodyItem' })).toHaveAttribute('title', 'gateway.v1.MsgBodyItem')
    expect(screen.getByRole('heading', { name: 'gateway.v1.MsgBodyItem' })).toBeInTheDocument()
  })

  it('shows only the selected operation and keeps request and response as separate cards', () => {
    render(<DocumentReader document={document} operations={[operation]} selectedOperationKey={operation.key} />)

    expect(screen.queryByRole('heading', { name: 'Detailed API' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Request body content' })).toHaveClass('documentation-card')
    expect(screen.getByRole('region', { name: 'Response 200 details' }).closest('.documentation-card')).not.toBeNull()
    expect(screen.queryByText('Try it')).not.toBeInTheDocument()
    expect(screen.queryByText('Open request editor')).not.toBeInTheDocument()
  })

  it('jumps from a nested object reference to its shared schema', () => {
    const referencedOperation: Operation = {
      ...operation,
      definition: {
        ...operation.definition,
        requestBody: {
          content: {
            'application/json': {
              schema: { properties: { profile: { $ref: '#/components/schemas/Profile' } }, type: 'object' },
            },
          },
        },
      },
    }
    render(<DocumentReader document={{ ...document, components: { schemas: { Profile: { properties: { name: { type: 'string' } }, type: 'object' } } } }} operations={[referencedOperation]} selectedOperationKey={referencedOperation.key} />)

    fireEvent.click(screen.getByRole('link', { name: 'Profile' }))

    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument()
  })

  it('renders circular schema fields without recursing indefinitely', () => {
    const circularSchema: Record<string, unknown> = { type: 'object' }
    circularSchema.properties = { self: circularSchema }
    const circularOperation: Operation = {
      ...operation,
      definition: {
        ...operation.definition,
        requestBody: { content: { 'application/json': { schema: circularSchema } } },
      },
    }

    render(<DocumentReader document={document} operations={[circularOperation]} selectedOperationKey={circularOperation.key} />)

    expect(screen.getAllByText('self')).toHaveLength(2)
  })

  it('keeps nested objects separate and links them to the schemas section', () => {
    const nestedOperation: Operation = {
      ...operation,
      definition: {
        ...operation.definition,
        requestBody: {
          content: {
            'application/json': {
              schema: {
                properties: {
                  profile: { properties: { displayName: { type: 'string' } }, type: 'object' },
                },
                type: 'object',
              },
            },
          },
        },
      },
    }
    render(<DocumentReader document={document} operations={[nestedOperation]} selectedOperationKey={nestedOperation.key} />)

    expect(screen.getByText('profile')).toBeInTheDocument()
    expect(screen.queryByText('profile.displayName')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request.profile' })).toHaveAttribute('title', 'Request.profile')
    fireEvent.click(screen.getByTitle('Request.profile'))
    expect(screen.getByRole('heading', { name: 'Request.profile' })).toBeInTheDocument()
  })

  it('uses concise names for inline response structures', () => {
    const inlineResponseOperation: Operation = {
      ...operation,
      definition: {
        ...operation.definition,
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  properties: {
                    result: {
                      properties: {
                        id: { type: 'string' },
                        payload: { properties: { value: { type: 'string' } }, type: 'object' },
                      },
                      type: 'object',
                    },
                  },
                  type: 'object',
                },
              },
            },
          },
        },
      },
    }

    render(<DocumentReader document={document} operations={[inlineResponseOperation]} selectedOperationKey={inlineResponseOperation.key} />)

    expect(screen.getByRole('link', { name: 'result' })).toHaveAttribute('title', 'result')
    expect(screen.getByRole('heading', { name: 'result' })).toBeInTheDocument()
    expect(screen.getAllByTitle('payload')).not.toHaveLength(0)
    expect(screen.getByRole('heading', { name: 'payload' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Response 200.result' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'result.payload' })).not.toBeInTheDocument()
  })

  it('previews inline object fields as an expanded schema tree', () => {
    const nestedOperation: Operation = {
      ...operation,
      definition: {
        ...operation.definition,
        requestBody: {
          content: {
            'application/json': {
              schema: {
                properties: {
                  profile: {
                    description: 'Profile details',
                    properties: {
                      displayName: { description: 'Public name', type: 'string' },
                      preferences: {
                        properties: { theme: { description: 'Preferred theme', type: 'string' } },
                        type: 'object',
                      },
                    },
                    type: 'object',
                  },
                },
                type: 'object',
              },
            },
          },
        },
      },
    }

    render(<DocumentReader document={document} operations={[nestedOperation]} selectedOperationKey={nestedOperation.key} />)

    const request = screen.getByRole('region', { name: 'Request body content' })
    expect(screen.getAllByRole('columnheader', { name: 'Field' })).not.toHaveLength(0)
    expect(screen.getAllByRole('columnheader', { name: 'Type' })).not.toHaveLength(0)
    expect(screen.getAllByRole('columnheader', { name: 'Description' })).not.toHaveLength(0)
    expect(screen.getAllByRole('columnheader', { name: 'Required' })).not.toHaveLength(0)
    expect(within(request).getByText('displayName')).toBeInTheDocument()
    expect(within(request).getByText('Public name')).toBeInTheDocument()
    expect(within(request).getByText('preferences')).toBeInTheDocument()
    expect(within(request).queryByText('theme')).not.toBeInTheDocument()
  })

  it('expands enum fields in place to show allowed values', () => {
    const enumOperation: Operation = {
      ...operation,
      definition: {
        ...operation.definition,
        requestBody: {
          content: {
            'application/json': {
              schema: { properties: { status: { default: 'active', enum: ['active', 'disabled'], format: 'status-code', title: '当前状态', type: 'string', 'x-nullable': true } }, type: 'object' },
            },
          },
        },
      },
    }

    render(<DocumentReader document={document} operations={[enumOperation]} selectedOperationKey={enumOperation.key} />)

    expect(screen.getByText('enum<string/status-code>')).toBeInTheDocument()
    expect(screen.getByText('当前状态')).toBeInTheDocument()
    expect(screen.getByText('default: active')).toBeInTheDocument()
    expect(screen.getByText('Nullable')).toBeInTheDocument()
    expect(screen.queryByText('active')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Expand enum values for status' }))
    expect(screen.getByText('active(0)')).toBeInTheDocument()
    expect(screen.getByText('disabled(1)')).toBeInTheDocument()
  })

  it('shows a named enum Schema as an expandable enum type', () => {
    const enumDocument: ApiDocument = {
      ...document,
      components: { schemas: { 'gateway.v1.MessagePreviewMode': { description: 'Preview mode', enum: ['UNSPECIFIED', 'NAME', 'CONTENT'], type: 'string' } } },
    }
    const enumOperation: Operation = {
      ...operation,
      definition: { ...operation.definition, requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/gateway.v1.MessagePreviewMode' } } } } },
    }

    render(<DocumentReader document={enumDocument} operations={[enumOperation]} selectedOperationKey={enumOperation.key} />)

    expect(screen.getByRole('heading', { name: 'gateway.v1.MessagePreviewMode' })).toBeInTheDocument()
    expect(screen.getAllByText('enum<string>')).not.toHaveLength(0)
    fireEvent.click(screen.getAllByRole('button', { name: 'Expand enum values' }).at(-1)!)
    expect(screen.getByText('CONTENT(2)')).toBeInTheDocument()
  })

  it('marks referenced enum fields and shows their enum description', () => {
    const enumDocument: ApiDocument = {
      ...document,
      components: {
        schemas: {
          'gateway.v1.MessagePreviewMode': {
            description: 'Controls how the message preview is rendered.',
            enum: ['UNSPECIFIED', 'NAME', 'CONTENT'],
            type: 'string',
          },
        },
      },
    }
    const enumOperation: Operation = {
      ...operation,
      definition: {
        ...operation.definition,
        requestBody: {
          content: {
            'application/json': {
              schema: {
                properties: {
                  previewMode: {
                    $ref: '#/components/schemas/gateway.v1.MessagePreviewMode',
                    description: 'Choose the preview mode for this message.',
                  },
                },
                type: 'object',
              },
            },
          },
        },
      },
    }

    render(<DocumentReader document={enumDocument} operations={[enumOperation]} selectedOperationKey={enumOperation.key} />)

    expect(screen.getByRole('link', { name: 'enum<gateway.v1.MessagePreviewMode>' })).toHaveAttribute('title', 'gateway.v1.MessagePreviewMode')
    const request = screen.getByRole('region', { name: 'Request body content' })
    expect(within(request).getByText('Choose the preview mode for this message.')).toBeInTheDocument()
    expect(within(request).getByText('Controls how the message preview is rendered.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Expand enum values for previewMode' }))
    expect(screen.getByText('CONTENT(2)')).toBeInTheDocument()
  })

  it('renders descriptions as Markdown while keeping operation summaries as plain text', () => {
    const markdownOperation: Operation = {
      ...operation,
      definition: {
        ...operation.definition,
        description: 'Returns **profile** for `memberId`.\n\n- Fresh data\n\n<img src="invalid" onerror="alert(1)" />',
        summary: 'A concise endpoint summary',
      },
    }

    render(<DocumentReader document={document} operations={[markdownOperation]} selectedOperationKey={markdownOperation.key} />)

    expect(screen.getByText('profile').tagName).toBe('STRONG')
    expect(screen.getByText('memberId').tagName).toBe('CODE')
    expect(screen.getByText('Fresh data').closest('li')).not.toBeNull()
    expect(screen.getByText('A concise endpoint summary')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'A concise endpoint summary' })).toBeNull()
    expect(globalThis.document.querySelector('img')).toBeNull()
  })
})
