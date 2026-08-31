import { Alert, Anchor, Button, Collapse, Descriptions, Divider, Empty, Space, Table, Tag, Typography } from 'antd'
import { useState } from 'react'
import RequestDrawer from './RequestDrawer'
import type { ApiDocument, Operation } from '../types/openapi'

interface DocumentReaderProps {
  document?: ApiDocument
  operations: Operation[]
  selectedOperationKey?: string
  onSelect: (operation: Operation) => void
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

function RawValue({ value }: { value: unknown }) {
  return <pre>{JSON.stringify(value, null, 2) ?? String(value)}</pre>
}

function ResponseDetails({ response, status }: { response: unknown; status: string }) {
  if (!isRecord(response)) {
    return <section aria-label={`Response ${status} details`} className="response-documentation"><RawValue value={response} /></section>
  }

  const content = response.content
  const mediaTypes = isRecord(content) ? Object.entries(content) : []
  const additional = Object.fromEntries(Object.entries(response).filter(([name]) => !['content', 'description', 'examples', 'headers', 'schema'].includes(name)))

  return (
    <section aria-label={`Response ${status} details`} className="response-documentation">
      {response.headers !== undefined ? <div><Typography.Title level={5}>Headers</Typography.Title><RawValue value={response.headers} /></div> : null}
      {response.schema !== undefined ? <div><Typography.Title level={5}>Schema</Typography.Title><RawValue value={response.schema} /></div> : null}
      {response.examples !== undefined ? <div><Typography.Title level={5}>Examples</Typography.Title><RawValue value={response.examples} /></div> : null}
      {content !== undefined && !isRecord(content) ? <div><Typography.Title level={5}>Content</Typography.Title><RawValue value={content} /></div> : null}
      {mediaTypes.map(([mediaType, mediaDefinition]) => {
        if (!isRecord(mediaDefinition)) {
          return <div className="response-media-type" key={mediaType}><Typography.Text strong>{mediaType}</Typography.Text><RawValue value={mediaDefinition} /></div>
        }

        const examples = mediaDefinition.example === undefined
          ? mediaDefinition.examples
          : mediaDefinition.examples === undefined
            ? mediaDefinition.example
            : { example: mediaDefinition.example, examples: mediaDefinition.examples }
        const mediaAdditional = Object.fromEntries(Object.entries(mediaDefinition).filter(([name]) => !['example', 'examples', 'schema'].includes(name)))
        return (
          <div className="response-media-type" key={mediaType}>
            <Typography.Text strong>{mediaType}</Typography.Text>
            {mediaDefinition.schema !== undefined ? <div><Typography.Title level={5}>Schema</Typography.Title><RawValue value={mediaDefinition.schema} /></div> : null}
            {examples !== undefined ? <div><Typography.Title level={5}>Examples</Typography.Title><RawValue value={examples} /></div> : null}
            {Object.keys(mediaAdditional).length ? <RawValue value={mediaAdditional} /> : null}
          </div>
        )
      })}
      {Object.keys(additional).length ? <RawValue value={additional} /> : null}
    </section>
  )
}

function operationTitle(operation: Operation): string {
  return `${operation.method.toUpperCase()} ${operation.path}`
}

export default function DocumentReader({ document, operations, selectedOperationKey, onSelect }: DocumentReaderProps) {
  const [requestOperation, setRequestOperation] = useState<Operation>()

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

      <div className="reader-anchor">
        <Anchor
          items={operations.map((operation) => ({ href: `#${operation.key}`, key: operation.key, title: operationTitle(operation) }))}
          onClick={(event, link) => {
            event.preventDefault()
            const operation = operations.find(({ key }) => `#${key}` === link.href)
            if (operation) onSelect(operation)
          }}
        />
      </div>

      <section aria-label="Operations" className="operation-reader-list">
        {operations.map((operation) => {
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
                  <pre>{JSON.stringify(requestBody.content ?? {}, null, 2)}</pre>
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
        })}
      </section>

      {schemas ? (
        <section className="schema-block" id="schemas">
          <Divider />
          <Typography.Title level={2}>Schemas</Typography.Title>
          <pre>{JSON.stringify(schemas, null, 2)}</pre>
        </section>
      ) : null}
      {securitySchemes ? (
        <section className="schema-block" id="security-schemes">
          <Typography.Title level={2}>Authentication</Typography.Title>
          <pre>{JSON.stringify(securitySchemes, null, 2)}</pre>
        </section>
      ) : null}
      {requestOperation ? <RequestDrawer key={requestOperation.key} onClose={() => setRequestOperation(undefined)} open operation={requestOperation} /> : null}
    </main>
  )
}
