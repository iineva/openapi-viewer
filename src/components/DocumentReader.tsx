import { Alert, Anchor, Descriptions, Divider, Empty, Space, Table, Tag, Typography } from 'antd'
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

function responseRows(operation: Operation) {
  const responses = operation.definition.responses as Record<string, { description?: string }> | undefined
  return Object.entries(responses ?? {}).map(([status, response]) => ({
    key: status,
    status,
    description: response?.description ?? 'No description',
  }))
}

function operationTitle(operation: Operation): string {
  return `${operation.method.toUpperCase()} ${operation.path}`
}

export default function DocumentReader({ document, operations, selectedOperationKey, onSelect }: DocumentReaderProps) {
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
              ) : null}
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
    </main>
  )
}
