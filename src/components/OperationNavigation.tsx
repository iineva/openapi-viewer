import { SearchOutlined } from '@ant-design/icons'
import { Button, Empty, Input, Tree, Typography } from 'antd'
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

export default function OperationNavigation({ operations, selectedOperationKey, onSelect }: OperationNavigationProps) {
  const [query, setQuery] = useState('')
  const visibleOperations = useMemo(() => searchOperations(operations, query), [operations, query])
  const groups = useMemo(() => groupOperations(visibleOperations), [visibleOperations])
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])

  useEffect(() => {
    setExpandedKeys(groupOperations(operations).map(({ tag }) => `tag-${tag}`))
  }, [operations])

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
        <Tree
          blockNode
          className="operation-tree"
          expandedKeys={expandedKeys}
          onExpand={(keys) => setExpandedKeys(keys.map(String))}
          selectable={false}
          treeData={groups.map((group) => ({
            key: `tag-${group.tag}`,
            title: group.tag,
            children: group.operations.map((operation) => ({
              key: operation.key,
              title: (
                <Button
                  aria-current={selectedOperationKey === operation.key ? 'page' : undefined}
                  className="operation-link"
                  onClick={() => onSelect(operation)}
                  type="text"
                >
                  <span className={`method method-${operation.method}`}>{operation.method.toUpperCase()}</span>
                  <span>{operation.path}</span>
                </Button>
              ),
            })),
          }))}
        />
      ) : (
        <Empty description="No matching endpoints" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </nav>
  )
}
