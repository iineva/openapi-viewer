import { Alert, Button, Divider, Drawer, Input, Space, Typography } from 'antd'
import { useState } from 'react'
import { buildRequest } from '../lib/request'
import type { Operation, RequestValues } from '../types/openapi'

interface RequestDrawerProps {
  onClose: () => void
  open: boolean
  operation: Operation
}

interface ResponseDetails {
  body: string
  headers: Array<[string, string]>
  status: string
}

function initialValues(operation: Operation): RequestValues {
  const values: RequestValues = { body: requestBodyExample(operation), headers: {}, path: {}, query: {} }
  for (const parameter of operation.parameters) {
    if (parameter.in === 'path') values.path[parameter.name] = ''
    if (parameter.in === 'query') values.query[parameter.name] = ''
    if (parameter.in === 'header') values.headers[parameter.name] = ''
  }
  return values
}

function requestBodyExample(operation: Operation): string {
  const requestBody = operation.definition.requestBody as { content?: Record<string, { example?: unknown; examples?: Record<string, { value?: unknown }> }> } | undefined
  const content = requestBody?.content
  const mediaType = content?.['application/json'] ?? Object.values(content ?? {})[0]
  const example = mediaType?.example ?? Object.values(mediaType?.examples ?? {})[0]?.value
  return example === undefined ? '' : typeof example === 'string' ? example : JSON.stringify(example, null, 2)
}

function displayBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}

export default function RequestDrawer({ onClose, open, operation }: RequestDrawerProps) {
  const [values, setValues] = useState(() => initialValues(operation))
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<ResponseDetails>()

  const parameters = {
    header: operation.parameters.filter((parameter) => parameter.in === 'header'),
    path: operation.parameters.filter((parameter) => parameter.in === 'path'),
    query: operation.parameters.filter((parameter) => parameter.in === 'query'),
  }

  const setValue = (location: 'path' | 'query' | 'headers', name: string, value: string) => {
    setValues((current) => ({ ...current, [location]: { ...current[location], [name]: value } }))
  }

  const sendRequest = async () => {
    const requiredPath = parameters.path.find((parameter) => parameter.required && !values.path[parameter.name].trim())
    if (requiredPath) {
      setError(`Required path parameter: ${requiredPath.name}`)
      return
    }

    setError(undefined)
    setResponse(undefined)
    setLoading(true)
    try {
      const prepared = buildRequest(operation, values)
      const result = await fetch(prepared.url, {
        body: prepared.body || undefined,
        headers: prepared.headers,
        method: prepared.method,
      })
      setResponse({
        body: displayBody(await result.text()),
        headers: [...result.headers.entries()],
        status: `${result.status} ${result.statusText}`.trim(),
      })
    } catch {
      setError('The request could not be sent. It may be blocked by CORS; the server must permit this browser origin.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Drawer className="request-drawer" onClose={onClose} open={open} size="large" title={`${operation.method.toUpperCase()} ${operation.path}`}>
      <div className="request-form">
        <Typography.Paragraph type="secondary">Request values are used only for this open drawer and are never saved.</Typography.Paragraph>
        {parameters.path.length ? (
          <section className="request-input-section">
            <Typography.Title level={5}>Path parameters</Typography.Title>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {parameters.path.map((parameter) => (
                <Input
                  aria-label={`Path parameter ${parameter.name}`}
                  addonBefore={parameter.name}
                  key={parameter.name}
                  onChange={(event) => setValue('path', parameter.name, event.target.value)}
                  placeholder={parameter.required ? 'Required' : 'Optional'}
                  value={values.path[parameter.name]}
                />
              ))}
            </Space>
          </section>
        ) : null}
        {parameters.query.length ? (
          <section className="request-input-section">
            <Typography.Title level={5}>Query parameters</Typography.Title>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {parameters.query.map((parameter) => (
                <Input
                  aria-label={`Query parameter ${parameter.name}`}
                  addonBefore={parameter.name}
                  key={parameter.name}
                  onChange={(event) => setValue('query', parameter.name, event.target.value)}
                  placeholder={parameter.required ? 'Required' : 'Optional'}
                  value={values.query[parameter.name]}
                />
              ))}
            </Space>
          </section>
        ) : null}
        {parameters.header.length ? (
          <section className="request-input-section">
            <Typography.Title level={5}>Headers</Typography.Title>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {parameters.header.map((parameter) => (
                <Input
                  aria-label={`Header ${parameter.name}`}
                  addonBefore={parameter.name}
                  key={parameter.name}
                  onChange={(event) => setValue('headers', parameter.name, event.target.value)}
                  placeholder={parameter.required ? 'Required' : 'Optional'}
                  value={values.headers[parameter.name]}
                />
              ))}
            </Space>
          </section>
        ) : null}
        <section className="request-input-section">
          <Typography.Title level={5}>Request body</Typography.Title>
          <Input.TextArea aria-label="Request body" autoSize={{ minRows: 6, maxRows: 16 }} onChange={(event) => setValues((current) => ({ ...current, body: event.target.value }))} placeholder="Request body" value={values.body} />
        </section>
        {error ? <Alert message={error} showIcon type="error" /> : null}
        <Button loading={loading} onClick={() => void sendRequest()} type="primary">Send request</Button>

        {response ? (
          <section className="response-panel" aria-label="Response">
            <Divider />
            <Typography.Title level={4}>Response</Typography.Title>
            <Typography.Text strong>{response.status}</Typography.Text>
            <Typography.Title level={5}>Headers</Typography.Title>
            {response.headers.length ? <dl className="response-headers">{response.headers.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl> : <Typography.Text type="secondary">No response headers</Typography.Text>}
            <Typography.Title level={5}>Body</Typography.Title>
            <pre>{response.body || 'No response body'}</pre>
          </section>
        ) : null}
      </div>
    </Drawer>
  )
}
