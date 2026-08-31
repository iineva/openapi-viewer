import { SearchOutlined } from '@ant-design/icons'
import { Button, Collapse, Empty, Input, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { searchOperations } from '../lib/openapi'
import type { Operation } from '../types/openapi'

interface OperationNavigationProps {
  operations: Operation[]
  selectedOperationKey?: string
  onSelect: (operation: Operation) => void
}

interface Group {
  tag: string
  operations: Operation[]
}

function groupOperations(operations: Operation[]): Group[] {
  const grouped = new Map<string, Operation[]>()
  for (const operation of operations) {
    const tags = operation.definition.tags?.length ? operation.definition.tags : ['Other']
    for (const tag of tags) {
      grouped.set(tag, [...(grouped.get(tag) ?? []), operation])
    }
  }

  return [...grouped.entries()].map(([tag, taggedOperations]) => ({ tag, operations: taggedOperations }))
}

function operationDescription(operation: Operation): string | undefined {
  const value = operation.definition.summary ?? operation.definition.description
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export default function OperationNavigation({ operations, selectedOperationKey, onSelect }: OperationNavigationProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const visibleOperations = useMemo(() => searchOperations(operations, debouncedQuery), [operations, debouncedQuery])
  const groups = useMemo(() => groupOperations(visibleOperations), [visibleOperations])
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])

  useEffect(() => {
    setExpandedKeys(groupOperations(operations).map(({ tag }) => `tag-${tag}`))
  }, [operations])

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 250)
    return () => window.clearTimeout(timeout)
  }, [query])

  return (
    <nav className="operation-navigation" aria-label="API operations">
      <Typography.Text strong>Endpoints</Typography.Text>
      <Input
        allowClear
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search endpoints"
        prefix={<SearchOutlined />}
        value={query}
      />
      {groups.length ? (
        <Collapse
          activeKey={expandedKeys}
          className="operation-groups"
          ghost
          items={groups.map((group) => ({
            key: `tag-${group.tag}`,
            label: group.tag,
            children: group.operations.map((operation) => (
                <Button
                  aria-current={selectedOperationKey === operation.key ? 'page' : undefined}
                  className="operation-link"
                  key={operation.key}
                  onClick={() => onSelect(operation)}
                  type="text"
                >
                  <span className={`method method-${operation.method}`}>{operation.method.toUpperCase()}</span>
                  <span className="operation-item-copy">
                    <span className="operation-path" title={operation.path}>{operation.path}</span>
                    {operationDescription(operation) ? <span className="operation-description" title={operationDescription(operation)}>{operationDescription(operation)}</span> : null}
                  </span>
                </Button>
            )),
          }))}
          onChange={(keys) => setExpandedKeys(Array.isArray(keys) ? keys.map(String) : [String(keys)])}
        />
      ) : (
        <Empty description="No matching endpoints" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </nav>
  )
}
