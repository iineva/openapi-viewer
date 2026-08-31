import { Alert, Button, Collapse, Descriptions, Divider, Empty, Space, Table, Tag, Typography } from 'antd'
import { useState } from 'react'
import JsonCodeBlock from './JsonCodeBlock'
import RequestDrawer from './RequestDrawer'
import type { ApiDocument, Operation } from '../types/openapi'

interface DocumentReaderProps {
  document?: ApiDocument
  operations: Operation[]
  selectedOperationKey?: string
}

function details(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function responseRows(operation: Operation) {
  const responses = operation.definition.responses as Record<string, unknown> | undefined
  return Object.entries(responses ?? {}).map(([status, response]) => ({
    key: status,
    status,
    description: isRecord(response) ? details(response.description) ?? 'No description' : 'No description',
    response,
  }))
}

interface SchemaRow {
  description: string
  example?: unknown
  key: string
  name: string
  required: boolean
  type: string
}

function schemaType(schema: unknown): string {
  if (!isRecord(schema)) return 'unknown'
  if (typeof schema.$ref === 'string') return schema.$ref.split('/').at(-1) ?? schema.$ref
  const type = typeof schema.type === 'string' ? schema.type : undefined
  if (type === 'array') return `array<${schemaType(schema.items)}>`
  if (type) return type
  if (isRecord(schema.properties)) return 'object'
  return 'unknown'
}

function schemaRows(schema: unknown, prefix = '', requiredNames: string[] = []): SchemaRow[] {
  if (!isRecord(schema) || !isRecord(schema.properties)) return []
  return Object.entries(schema.properties).flatMap(([name, field]) => {
    const fieldRecord = isRecord(field) ? field : {}
    const path = prefix ? `${prefix}.${name}` : name
    const childRequired = Array.isArray(fieldRecord.required) ? fieldRecord.required.filter((value): value is string => typeof value === 'string') : []
    return [{
      description: details(fieldRecord.description) ?? '---',
      example: fieldRecord.example,
      key: path,
      name: path,
      required: requiredNames.includes(name),
      type: schemaType(field),
    }, ...schemaRows(field, path, childRequired)]
  })
}

function SchemaFields({ schema }: { schema: unknown }) {
  const requiredNames = isRecord(schema) && Array.isArray(schema.required) ? schema.required.filter((value): value is string => typeof value === 'string') : []
  const rows = schemaRows(schema, '', requiredNames)
  if (!rows.length) return <Typography.Text type="secondary">{schemaType(schema)}</Typography.Text>
  return (
    <Table
      columns={[
        { dataIndex: 'name', key: 'name', title: 'Field' },
        { dataIndex: 'type', key: 'type', title: 'Type' },
        { dataIndex: 'required', key: 'required', render: (required) => required ? 'Required' : 'Optional', title: 'Required' },
        { dataIndex: 'description', key: 'description', title: 'Description' },
        { dataIndex: 'example', key: 'example', render: (example) => example === undefined ? '---' : String(example), title: 'Example' },
      ]}
      dataSource={rows}
      pagination={false}
      size="small"
      title={() => 'Fields'}
    />
  )
}

function examples(value: Record<string, unknown>): Array<{ name: string; value: unknown }> {
  const direct = value.example === undefined ? [] : [{ name: 'Example', value: value.example }]
  const named = isRecord(value.examples)
    ? Object.entries(value.examples).map(([name, example]) => ({
      name: isRecord(example) && typeof example.summary === 'string' ? example.summary : name,
      value: isRecord(example) && 'value' in example ? example.value : example,
    }))
    : []
  return [...direct, ...named]
}

function MediaTypeDetails({ mediaType, value }: { mediaType: string; value: unknown }) {
  if (!isRecord(value)) {
    return <section className="response-media-type"><Typography.Text strong>{mediaType}</Typography.Text><Typography.Text type="secondary">No readable schema is defined.</Typography.Text></section>
  }

  const mediaExamples = examples(value)
  return (
    <section className="response-media-type">
      <Typography.Text strong>{mediaType}</Typography.Text>
      {value.schema !== undefined ? <SchemaFields schema={value.schema} /> : <Typography.Text type="secondary">No schema is defined.</Typography.Text>}
      {mediaExamples.length ? <div className="example-list"><Typography.Title level={5}>Examples</Typography.Title>{mediaExamples.map((example) => <div key={example.name}><Typography.Text strong>{example.name}</Typography.Text><JsonCodeBlock value={example.value} /></div>)}</div> : null}
    </section>
  )
}

function ResponseDetails({ response, status }: { response: unknown; status: string }) {
  if (!isRecord(response)) {
    return <section aria-label={`Response ${status} details`} className="response-documentation"><Typography.Text type="secondary">No readable response definition is available.</Typography.Text></section>
  }

  const content = isRecord(response.content) ? Object.entries(response.content) : []
  const responseExamples = examples(response)
  const headers = isRecord(response.headers) ? Object.entries(response.headers).map(([name, header]) => ({
    description: isRecord(header) ? details(header.description) ?? '---' : '---',
    key: name,
    name,
    type: isRecord(header) ? schemaType(header.schema) : 'unknown',
  })) : []

  return (
    <section aria-label={`Response ${status} details`} className="response-documentation">
      {headers.length ? <Table columns={[{ dataIndex: 'name', key: 'name', title: 'Header' }, { dataIndex: 'type', key: 'type', title: 'Type' }, { dataIndex: 'description', key: 'description', title: 'Description' }]} dataSource={headers} pagination={false} size="small" title={() => 'Headers'} /> : null}
      {response.schema !== undefined ? <SchemaFields schema={response.schema} /> : null}
      {responseExamples.length ? <div className="example-list"><Typography.Title level={5}>Examples</Typography.Title>{responseExamples.map((example) => <div key={example.name}><Typography.Text strong>{example.name}</Typography.Text><JsonCodeBlock value={example.value} /></div>)}</div> : null}
      {content.map(([mediaType, definition]) => <MediaTypeDetails key={mediaType} mediaType={mediaType} value={definition} />)}
    </section>
  )
}

function operationTitle(operation: Operation): string {
  return `${operation.method.toUpperCase()} ${operation.path}`
}

export default function DocumentReader({ document, operations, selectedOperationKey }: DocumentReaderProps) {
  const [requestOperation, setRequestOperation] = useState<Operation>()
  const selectedOperation = operations.find(({ key }) => key === selectedOperationKey)

  if (!document) {
    return (
      <main className="document-reader empty-reader">
        <Empty description="Open an OpenAPI document to begin reading" />
      </main>
    )
  }

  const securitySchemes = (document.components as { securitySchemes?: Record<string, unknown> } | undefined)?.securitySchemes
  const schemas = (document.components as { schemas?: Record<string, unknown> } | undefined)?.schemas

  return (
    <main className="document-reader">
      <section className="document-intro">
        <Typography.Title level={1}>{document.info?.title ?? 'Untitled API'}</Typography.Title>
        <Space size={[8, 8]} wrap>
          <Tag>{document.openapi ?? document.swagger ?? 'OpenAPI'}</Tag>
          {document.info?.version ? <Typography.Text type="secondary">v{document.info.version}</Typography.Text> : null}
        </Space>
        {details(document.info?.description) ? <Typography.Paragraph>{details(document.info?.description)}</Typography.Paragraph> : null}
        {document.servers?.length ? (
          <Descriptions className="server-list" column={1} size="small" title="Servers">
            {document.servers.map((server) => <Descriptions.Item key={server.url} label="URL">{server.url}</Descriptions.Item>)}
          </Descriptions>
        ) : null}
        {securitySchemes ? <Alert message="Authentication schemes are documented below." showIcon type="info" /> : null}
      </section>

      <section aria-label="Operations" className="operation-reader-list">
        {selectedOperation ? [selectedOperation].map((operation) => {
          const responses = responseRows(operation)
          const requestBody = operation.definition.requestBody as { description?: string; content?: unknown } | undefined
          return (
            <article
              aria-current={selectedOperationKey === operation.key ? 'true' : undefined}
              className={selectedOperationKey === operation.key ? 'operation-section operation-selected' : 'operation-section'}
              id={operation.key}
              key={operation.key}
            >
              <div className="operation-heading">
                <span className={`method method-${operation.method}`}>{operation.method.toUpperCase()}</span>
                <Typography.Title level={2}>{operationTitle(operation)}</Typography.Title>
              </div>
              {details(operation.definition.summary) ? <Typography.Title level={4}>{details(operation.definition.summary)}</Typography.Title> : null}
              {details(operation.definition.description) ? <Typography.Paragraph>{details(operation.definition.description)}</Typography.Paragraph> : null}
              {operation.definition.tags?.length ? <Space wrap>{operation.definition.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space> : null}

              {operation.parameters.length ? (
                <Table
                  columns={[
                    { dataIndex: 'name', key: 'name', title: 'Parameter' },
                    { dataIndex: 'in', key: 'in', title: 'In' },
                    { dataIndex: 'required', key: 'required', render: (required) => required ? 'Required' : 'Optional', title: 'Required' },
                    { dataIndex: 'description', key: 'description', title: 'Description' },
                  ]}
                  dataSource={operation.parameters.map((parameter) => ({ ...parameter, description: details(parameter.description) ?? '---', key: `${parameter.in}-${parameter.name}` }))}
                  pagination={false}
                  size="small"
                  title={() => 'Parameters'}
                />
              ) : null}

              {requestBody ? (
                <section className="schema-block">
                  <Typography.Title level={4}>Request body</Typography.Title>
                  {details(requestBody.description) ? <Typography.Paragraph>{details(requestBody.description)}</Typography.Paragraph> : null}
                  {isRecord(requestBody.content) ? Object.entries(requestBody.content).map(([mediaType, definition]) => <MediaTypeDetails key={mediaType} mediaType={mediaType} value={definition} />) : <Typography.Text type="secondary">No readable request schema is defined.</Typography.Text>}
                </section>
              ) : null}

              {responses.length ? (
                <section className="response-list">
                  <Table
                    columns={[
                      { dataIndex: 'status', key: 'status', title: 'Response' },
                      { dataIndex: 'description', key: 'description', title: 'Description' },
                    ]}
                    dataSource={responses}
                    pagination={false}
                    size="small"
                    title={() => 'Responses'}
                  />
                  {responses.map(({ response, status }) => <ResponseDetails key={status} response={response} status={status} />)}
                </section>
              ) : null}
              <Collapse
                className="try-it-panel"
                items={[{
                  children: <Button onClick={() => setRequestOperation(operation)} type="primary">Open request editor</Button>,
                  key: 'try-it',
                  label: 'Try it',
                }]}
                size="small"
              />
            </article>
          )
        }) : <Empty description="Select an endpoint to view its details" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
      </section>

      {schemas ? (
        <section className="schema-block" id="schemas">
          <Divider />
          <Typography.Title level={2}>Schemas</Typography.Title>
          <JsonCodeBlock value={schemas} />
        </section>
      ) : null}
      {securitySchemes ? (
        <section className="schema-block" id="security-schemes">
          <Typography.Title level={2}>Authentication</Typography.Title>
          <JsonCodeBlock value={securitySchemes} />
        </section>
      ) : null}
      {requestOperation ? <RequestDrawer key={requestOperation.key} onClose={() => setRequestOperation(undefined)} open operation={requestOperation} /> : null}
    </main>
  )
}
