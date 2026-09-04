import { DownOutlined, RightOutlined } from '@ant-design/icons'
import { Alert, Button, Descriptions, Empty, Space, Table, Tabs, Tag, Typography } from 'antd'
import { useState } from 'react'
import JsonCodeBlock from './JsonCodeBlock'
import MarkdownDescription from './MarkdownDescription'
import type { ApiDocument, Operation } from '../types/openapi'
import { schemaPreview } from '../lib/schemaPreview'

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
  children?: SchemaRow[]
  description: string
  enumDescription?: string
  key: string
  name: string
  required: boolean
  schema: unknown
  type: string
}

function schemaReferenceName(schema: unknown): string | undefined {
  return isRecord(schema) && typeof schema.$ref === 'string' ? schema.$ref.split('/').at(-1) : undefined
}

function resolvedSchema(schema: unknown, schemas?: Record<string, unknown>): unknown {
  const reference = schemaReferenceName(schema)
  return reference ? schemas?.[reference] ?? schema : schema
}

function schemaAnchorId(name: string): string {
  return `schema-${encodeURIComponent(name)}`
}

function schemaType(schema: unknown, schemaNames?: WeakMap<object, string>): string {
  if (!isRecord(schema)) return 'unknown'
  if (typeof schema.$ref === 'string') return schema.$ref.split('/').at(-1) ?? schema.$ref
  const type = typeof schema.type === 'string' ? schema.type : undefined
  const format = typeof schema.format === 'string' ? schema.format : undefined
  if (type === 'array') return `[${schemaType(schema.items, schemaNames)}]`
  const generatedName = schemaNames?.get(schema)
  if (generatedName) return generatedName
  if (Array.isArray(schema.enum)) return type ? `enum<${format ? `${type}/${format}` : type}>` : 'enum'
  if (type) return format ? `${type}<${format}>` : type
  if (isRecord(schema.properties)) return 'object'
  return 'unknown'
}

function enumValues(schema: unknown): string[] | undefined {
  if (!isRecord(schema) || !Array.isArray(schema.enum)) return undefined
  return schema.enum.map((value, index) => `${typeof value === 'string' ? value : JSON.stringify(value)}(${index})`)
}

function EnumValues({ values }: { values: string[] }) {
  return <span className="schema-enum-values">{values.map((value) => <span key={value}>{value}</span>)}</span>
}

function schemaMetadata(schema: unknown): string[] {
  if (!isRecord(schema)) return []
  const metadata: string[] = []
  if (schema.default !== undefined) metadata.push(`default: ${typeof schema.default === 'string' ? schema.default : JSON.stringify(schema.default)}`)
  if (schema.nullable === true || schema['x-nullable'] === true) metadata.push('Nullable')
  return metadata
}

function schemaRows(schema: unknown, schemaNames?: WeakMap<object, string>, schemas?: Record<string, unknown>, ancestors = new WeakSet<object>(), parentKey = ''): SchemaRow[] {
  if (!isRecord(schema) || !isRecord(schema.properties) || ancestors.has(schema)) return []
  ancestors.add(schema)
  const requiredNames = Array.isArray(schema.required) ? schema.required.filter((name): name is string => typeof name === 'string') : []
  const rows = Object.entries(schema.properties).map(([name, field]) => {
    const fieldRecord = isRecord(field) ? field : {}
    const resolvedField = resolvedSchema(field, schemas)
    const nested = nestedObjectSchema(resolvedField)
    const description = details(fieldRecord.description) ?? details(fieldRecord.title)
    const enumDescription = enumValues(resolvedField) ? (isRecord(resolvedField) ? details(resolvedField.description) : undefined) : undefined
    return {
      children: nested ? schemaRows(nested, schemaNames, schemas, ancestors, `${parentKey}${name}.`) : undefined,
      description: description ?? '---',
      enumDescription: enumDescription !== description ? enumDescription : undefined,
      key: `${parentKey}${name}`,
      name,
      required: requiredNames.includes(name),
      schema: field,
      type: schemaType(field, schemaNames),
    }
  })
  ancestors.delete(schema)
  return rows
}

function schemaCatalogName(schema: unknown, schemaNames?: WeakMap<object, string>): string | undefined {
  if (!isRecord(schema)) return undefined
  if (typeof schema.$ref === 'string') return schemaReferenceName(schema)
  if (schema.type === 'array') return schemaCatalogName(schema.items, schemaNames)
  return schemaNames?.get(schema)
}

function schemaTypeClass(schema: unknown, schemaNames?: WeakMap<object, string>): string {
  const catalogName = schemaCatalogName(schema, schemaNames)
  if (catalogName) return 'schema-type-reference'
  if (!isRecord(schema)) return 'schema-type-unknown'
  const type = schema.type === 'array' ? schemaDisplayType(schema.items, schemaNames) : schemaDisplayType(schema, schemaNames)
  return `schema-type-${type.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`
}

function schemaDisplayType(schema: unknown, schemaNames?: WeakMap<object, string>): string {
  if (!isRecord(schema)) return 'unknown'
  const reference = schemaReferenceName(schema)
  if (reference) return reference
  if (schema.type === 'array') return `[${schemaDisplayType(schema.items, schemaNames)}]`
  const catalogName = schemaNames?.get(schema)
  if (catalogName) return catalogName
  return schemaType(schema, schemaNames)
}

function SchemaFields({ onSchemaNavigate, schema, schemaNames, schemas }: { onSchemaNavigate?: (name: string) => void; schema: unknown; schemaNames?: WeakMap<object, string>; schemas?: Record<string, unknown> }) {
  const resolved = resolvedSchema(schema, schemas)
  const rows = schemaRows(resolved, schemaNames, schemas)
  const [expandedEnums, setExpandedEnums] = useState<Set<string>>(() => new Set())
  if (!rows.length) {
    const values = enumValues(resolved)
    const expanded = expandedEnums.has('__root__')
    return <span className="schema-type-cell"><span className="schema-type">{schemaType(resolved)}{values ? <Button aria-label={`${expanded ? 'Collapse' : 'Expand'} enum values`} className="schema-enum-toggle" icon={expanded ? <DownOutlined /> : <RightOutlined />} onClick={() => setExpandedEnums((keys) => { const next = new Set(keys); expanded ? next.delete('__root__') : next.add('__root__'); return next })} size="small" type="text" /> : null}</span>{schemaMetadata(resolved).map((item) => <span className="schema-metadata" key={item}>{item}</span>)}{values && expanded ? <EnumValues values={values} /> : null}</span>
  }
  return (
    <Table
      columns={[
        { dataIndex: 'name', key: 'name', title: 'Field' },
        {
          dataIndex: 'type',
          key: 'type',
          render: (_type, row: SchemaRow) => {
            const reference = schemaCatalogName(row.schema, schemaNames)
            const className = `schema-type ${schemaTypeClass(row.schema, schemaNames)}`
            const resolvedField = resolvedSchema(row.schema, schemas)
            const baseDisplayType = schemaDisplayType(row.schema, schemaNames)
            const values = enumValues(resolvedField)
            const displayType = values && !baseDisplayType.startsWith('enum<') ? `enum<${baseDisplayType}>` : baseDisplayType
            const type = reference && onSchemaNavigate
              ? <Typography.Link className={className} href={`#${schemaAnchorId(reference)}`} onClick={(event) => { event.preventDefault(); onSchemaNavigate(reference) }} title={reference}>{displayType}</Typography.Link>
              : <span className={className}>{displayType}</span>
            const expanded = expandedEnums.has(row.key)
            return <span className="schema-type-cell"><span>{type}{values ? <Button aria-label={`${expanded ? 'Collapse' : 'Expand'} enum values for ${row.name}`} className="schema-enum-toggle" icon={expanded ? <DownOutlined /> : <RightOutlined />} onClick={() => setExpandedEnums((keys) => { const next = new Set(keys); expanded ? next.delete(row.key) : next.add(row.key); return next })} size="small" type="text" /> : null}</span>{schemaMetadata(row.schema).map((item) => <span className="schema-metadata" key={item}>{item}</span>)}{values && expanded ? <EnumValues values={values} /> : null}</span>
          },
          title: 'Type',
        },
        { dataIndex: 'required', key: 'required', render: (required) => required ? 'Required' : 'Optional', title: 'Required' },
        {
          dataIndex: 'description',
          key: 'description',
          render: (description: string, row: SchemaRow) => {
            const descriptions = [description === '---' ? undefined : description, row.enumDescription].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index)
            return descriptions.length ? <div className="schema-description-cell">{descriptions.map((value) => <MarkdownDescription compact key={value} value={value} />)}</div> : <Typography.Text type="secondary">---</Typography.Text>
          },
          title: 'Description',
        },
      ]}
      dataSource={rows}
      expandable={{ defaultExpandedRowKeys: rows.filter((row) => row.children?.length).map(({ key }) => key), expandRowByClick: false }}
      pagination={false}
      className="schema-fields-table"
      size="small"
      title={() => 'Fields'}
    />
  )
}

interface SchemaCatalog {
  definitions: Map<string, unknown>
  names: WeakMap<object, string>
}

function nestedObjectSchema(schema: unknown): Record<string, unknown> | undefined {
  if (!isRecord(schema)) return undefined
  if (schema.type === 'array') return nestedObjectSchema(schema.items)
  return isRecord(schema.properties) ? schema : undefined
}

function nestedSchemaName(parentName: string, fieldName: string, inlineRootName?: string): string {
  const name = parentName ? `${parentName}.${fieldName}` : fieldName
  return inlineRootName && name.startsWith(`${inlineRootName}.`) ? name.slice(inlineRootName.length + 1) : name
}

function registerNestedSchemas(
  schema: unknown,
  parentName: string,
  catalog: SchemaCatalog,
  includeComponent: (name: string) => void,
  ancestors = new WeakSet<object>(),
  inlineRootName?: string,
) {
  if (!isRecord(schema) || ancestors.has(schema)) return
  const componentName = catalog.names.get(schema)
  if (componentName && !catalog.definitions.has(componentName)) {
    includeComponent(componentName)
    return
  }
  const reference = schemaReferenceName(schema)
  if (reference) {
    includeComponent(reference)
    return
  }
  ancestors.add(schema)
  if (schema.type === 'array') registerNestedSchemas(schema.items, parentName, catalog, includeComponent, ancestors, inlineRootName)
  if (isRecord(schema.properties)) {
    for (const [fieldName, field] of Object.entries(schema.properties)) {
      const nested = nestedObjectSchema(field)
      const name = nested ? catalog.names.get(nested) ?? nestedSchemaName(parentName, fieldName, inlineRootName) : nestedSchemaName(parentName, fieldName, inlineRootName)
      if (nested && !catalog.names.has(nested)) {
        catalog.names.set(nested, name)
        catalog.definitions.set(name, nested)
      }
      registerNestedSchemas(field, name, catalog, includeComponent, ancestors, inlineRootName ?? (!parentName && nested ? name : undefined))
    }
  }
  ancestors.delete(schema)
}

function schemaCatalog(operation: Operation | undefined, componentSchemas?: Record<string, unknown>): SchemaCatalog {
  const catalog: SchemaCatalog = { definitions: new Map(), names: new WeakMap() }
  for (const [name, schema] of Object.entries(componentSchemas ?? {})) {
    if (isRecord(schema)) catalog.names.set(schema, name)
  }
  const includedComponents = new Set<string>()
  const includeComponent = (name: string) => {
    if (includedComponents.has(name)) return
    const schema = componentSchemas?.[name]
    if (schema === undefined) return
    includedComponents.add(name)
    if (isRecord(schema)) catalog.names.set(schema, name)
    catalog.definitions.set(name, schema)
    registerNestedSchemas(schema, name, catalog, includeComponent)
  }
  if (!operation) return catalog

  const requestBody = operation.definition.requestBody as { content?: unknown } | undefined
  if (isRecord(requestBody?.content)) {
    for (const definition of Object.values(requestBody.content)) {
      if (isRecord(definition)) registerNestedSchemas(definition.schema, 'Request', catalog, includeComponent)
    }
  }
  const responses = operation.definition.responses as Record<string, unknown> | undefined
  for (const [status, response] of Object.entries(responses ?? {})) {
    if (!isRecord(response) || !isRecord(response.content)) continue
    for (const definition of Object.values(response.content)) {
      if (isRecord(definition)) registerNestedSchemas(definition.schema, '', catalog, includeComponent)
    }
  }
  return catalog
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

function MediaTypeModel({ mediaType, onSchemaNavigate, schemaNames, schemas, value }: { mediaType: string; onSchemaNavigate?: (name: string) => void; schemaNames?: WeakMap<object, string>; schemas?: Record<string, unknown>; value: unknown }) {
  if (!isRecord(value)) {
    return <section className="response-media-type"><Typography.Text strong>{mediaType}</Typography.Text><Typography.Text type="secondary">No readable schema is defined.</Typography.Text></section>
  }

  return (
    <section className="response-media-type">
      <Typography.Text strong>{mediaType}</Typography.Text>
      {value.schema !== undefined ? <SchemaFields onSchemaNavigate={onSchemaNavigate} schema={value.schema} schemaNames={schemaNames} schemas={schemas} /> : <Typography.Text type="secondary">No schema is defined.</Typography.Text>}
    </section>
  )
}

function MediaTypeExamples({ mediaType, schemas, value }: { mediaType: string; schemas?: Record<string, unknown>; value: unknown }) {
  const definedExamples = isRecord(value) ? examples(value) : []
  const mediaExamples = definedExamples.length ? definedExamples : isRecord(value) && value.schema !== undefined ? [{ name: 'Preview', value: schemaPreview(value.schema, schemas) }] : []
  if (!mediaExamples.length) return null
  return <section className="example-list"><Typography.Text strong>{mediaType}</Typography.Text>{mediaExamples.map((example) => <div key={example.name}><Typography.Text strong>{example.name}</Typography.Text><JsonCodeBlock value={example.value} /></div>)}</section>
}

function ResponseDetails({ onSchemaNavigate, response, schemas, schemaNames, status }: { onSchemaNavigate?: (name: string) => void; response: unknown; schemas?: Record<string, unknown>; schemaNames?: WeakMap<object, string>; status: string }) {
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
      <Tabs
        items={[
          {
            children: <>{headers.length ? <Table columns={[{ dataIndex: 'name', key: 'name', title: 'Header' }, { dataIndex: 'type', key: 'type', title: 'Type' }, { dataIndex: 'description', key: 'description', render: (description: string) => description === '---' ? <Typography.Text type="secondary">---</Typography.Text> : <MarkdownDescription compact value={description} />, title: 'Description' }]} dataSource={headers} pagination={false} size="small" title={() => 'Headers'} /> : null}{response.schema !== undefined ? <SchemaFields onSchemaNavigate={onSchemaNavigate} schema={response.schema} schemaNames={schemaNames} schemas={schemas} /> : null}{content.map(([mediaType, definition]) => <MediaTypeModel key={mediaType} mediaType={mediaType} onSchemaNavigate={onSchemaNavigate} schemaNames={schemaNames} schemas={schemas} value={definition} />)}</>,
            key: 'model',
            label: 'MODEL',
          },
          {
            children: <>{responseExamples.map((example) => <section className="example-list" key={example.name}><Typography.Text strong>{example.name}</Typography.Text><JsonCodeBlock value={example.value} /></section>)}{content.map(([mediaType, definition]) => <MediaTypeExamples key={mediaType} mediaType={mediaType} schemas={schemas} value={definition} />)}</>,
            key: 'example',
            label: 'EXAMPLE',
          },
        ]}
        size="small"
      />
    </section>
  )
}

function operationTitle(operation: Operation): string {
  return operation.path
}

export default function DocumentReader({ document, operations, selectedOperationKey }: DocumentReaderProps) {
  const selectedOperation = operations.find(({ key }) => key === selectedOperationKey)
  const schemas = (document?.components as { schemas?: Record<string, unknown> } | undefined)?.schemas
  const catalog = schemaCatalog(selectedOperation, schemas)
  const navigateToSchema = (name: string) => {
    window.setTimeout(() => globalThis.document.getElementById(schemaAnchorId(name))?.scrollIntoView?.({ block: 'start' }), 0)
  }

  if (!document) {
    return (
      <main className="document-reader empty-reader">
        <Empty description="Open an OpenAPI document to begin reading" />
      </main>
    )
  }

  const securitySchemes = (document.components as { securitySchemes?: Record<string, unknown> } | undefined)?.securitySchemes

  return (
    <main className="document-reader">
      {!selectedOperation ? (
        <section className="document-intro">
          <Typography.Title level={1}>{document.info?.title ?? 'Untitled API'}</Typography.Title>
          <Space size={[8, 8]} wrap>
            <Tag>{document.openapi ?? document.swagger ?? 'OpenAPI'}</Tag>
            {document.info?.version ? <Typography.Text type="secondary">v{document.info.version}</Typography.Text> : null}
          </Space>
          {details(document.info?.description) ? <MarkdownDescription value={details(document.info?.description)!} /> : null}
          {document.servers?.length ? (
            <Descriptions className="server-list" column={1} size="small" title="Servers">
              {document.servers.map((server) => <Descriptions.Item key={server.url} label="URL">{server.url}</Descriptions.Item>)}
            </Descriptions>
          ) : null}
          {securitySchemes ? <Alert message="Authentication schemes are documented below." showIcon type="info" /> : null}
        </section>
      ) : null}

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
              {details(operation.definition.summary) ? <Typography.Text className="operation-summary">{details(operation.definition.summary)}</Typography.Text> : null}
              {details(operation.definition.operationId) ? <Typography.Text type="secondary">{details(operation.definition.operationId)}</Typography.Text> : null}
              {details(operation.definition.description) ? <MarkdownDescription value={details(operation.definition.description)!} /> : null}
              {operation.definition.tags?.length ? <Space wrap>{operation.definition.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space> : null}

              {operation.parameters.length ? (
                <Table
                  columns={[
                    { dataIndex: 'name', key: 'name', title: 'Parameter' },
                    { dataIndex: 'in', key: 'in', title: 'In' },
                    { dataIndex: 'required', key: 'required', render: (required) => required ? 'Required' : 'Optional', title: 'Required' },
                    { dataIndex: 'description', key: 'description', render: (description: string) => description === '---' ? <Typography.Text type="secondary">---</Typography.Text> : <MarkdownDescription compact value={description} />, title: 'Description' },
                  ]}
                  dataSource={operation.parameters.map((parameter) => ({ ...parameter, description: details(parameter.description) ?? '---', key: `${parameter.in}-${parameter.name}` }))}
                  pagination={false}
                  size="small"
                  title={() => 'Parameters'}
                />
              ) : null}

              {requestBody ? (
                <section aria-label="Request body content" className="documentation-card">
                  <Typography.Title level={4}>Request body</Typography.Title>
                  {details(requestBody.description) ? <MarkdownDescription value={details(requestBody.description)!} /> : null}
                  {isRecord(requestBody.content) ? (
                    <Tabs
                      items={[
                        { children: Object.entries(requestBody.content).map(([mediaType, definition]) => <MediaTypeModel key={mediaType} mediaType={mediaType} onSchemaNavigate={navigateToSchema} schemaNames={catalog.names} schemas={schemas} value={definition} />), key: 'model', label: 'MODEL' },
                        { children: Object.entries(requestBody.content).map(([mediaType, definition]) => <MediaTypeExamples key={mediaType} mediaType={mediaType} schemas={schemas} value={definition} />), key: 'body', label: 'BODY' },
                      ]}
                      size="small"
                    />
                  ) : <Typography.Text type="secondary">No readable request schema is defined.</Typography.Text>}
                </section>
              ) : null}

              {responses.length ? (
                <section className="documentation-card response-list">
                  <Table
                    columns={[
                      { dataIndex: 'status', key: 'status', title: 'Response' },
                      { dataIndex: 'description', key: 'description', render: (description: string) => <MarkdownDescription compact value={description} />, title: 'Description' },
                    ]}
                    dataSource={responses}
                    pagination={false}
                    size="small"
                    title={() => 'Responses'}
                  />
                  {responses.map(({ response, status }) => <ResponseDetails key={status} onSchemaNavigate={navigateToSchema} response={response} schemas={schemas} schemaNames={catalog.names} status={status} />)}
                </section>
              ) : null}
            </article>
          )
        }) : <Empty description="Select an endpoint to view its details" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
      </section>

      {catalog.definitions.size ? (
        <section className="documentation-card schema-catalog" id="schemas">
          <Typography.Title level={4}>Schemas</Typography.Title>
          {[...catalog.definitions].map(([name, schema]) => (
            <section className="shared-schema" id={schemaAnchorId(name)} key={name}>
              <Typography.Title level={5}>{name}</Typography.Title>
              {isRecord(schema) && details(schema.description) ? <MarkdownDescription value={details(schema.description)!} /> : isRecord(schema) && details(schema.title) ? <Typography.Paragraph className="schema-title">{details(schema.title)}</Typography.Paragraph> : null}
              <SchemaFields onSchemaNavigate={navigateToSchema} schema={schema} schemaNames={catalog.names} schemas={schemas} />
            </section>
          ))}
        </section>
      ) : null}
      {securitySchemes ? (
        <section className="schema-block" id="security-schemes">
          <Typography.Title level={2}>Authentication</Typography.Title>
          <JsonCodeBlock value={securitySchemes} />
        </section>
      ) : null}
    </main>
  )
}
