import { SearchOutlined } from '@ant-design/icons'
import { AutoComplete, Button, Collapse, Empty, Input, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import Pinyin from 'tiny-pinyin'
import { searchOperations } from '../lib/openapi'
import type { Operation } from '../types/openapi'

interface OperationNavigationProps {
  operations: Operation[]
  schemas?: Record<string, unknown>
  selectedOperationKey?: string
  onSelect: (operation: Operation) => void
}

interface Group {
  tag: string
  operations: Operation[]
}

const SEARCH_HISTORY_KEY = 'openapi-viewer:search-history'
const MAX_SEARCH_HISTORY = 100

function storedSearchHistory(): string[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(SEARCH_HISTORY_KEY) ?? '[]')
    if (!Array.isArray(stored)) return []
    return [...new Set(stored.filter((value): value is string => typeof value === 'string' && Boolean(value.trim())).map((value) => value.trim()))].slice(0, MAX_SEARCH_HISTORY)
  } catch {
    return []
  }
}

function saveSearchHistory(entries: string[]) {
  try {
    window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(entries))
  } catch {
    // Search remains available when browser storage is unavailable.
  }
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

interface TextRange {
  end: number
  start: number
}

function directMatchRange(value: string, query: string): TextRange | undefined {
  const start = value.toLocaleLowerCase().indexOf(query)
  return start < 0 ? undefined : { end: start + query.length, start }
}

function pinyinMatchRange(value: string, query: string): TextRange | undefined {
  const tokens = Pinyin.parse(value)
  for (const targets of [tokens.map(({ target }) => target), tokens.map(({ target }) => target[0])]) {
    const normalizedTargets = targets.map((target) => target.toLocaleLowerCase())
    const matchStart = normalizedTargets.join('').indexOf(query)
    if (matchStart < 0) continue

    const matchEnd = matchStart + query.length
    let sourceOffset = 0
    let targetOffset = 0
    let start: number | undefined
    let end: number | undefined
    for (let index = 0; index < tokens.length; index += 1) {
      const targetEnd = targetOffset + normalizedTargets[index].length
      if (start === undefined && targetEnd > matchStart) start = sourceOffset
      if (start !== undefined && targetOffset < matchEnd) end = sourceOffset + tokens[index].source.length
      if (targetOffset >= matchEnd) break
      sourceOffset += tokens[index].source.length
      targetOffset = targetEnd
    }
    if (start !== undefined && end !== undefined) return { end, start }
  }
  return undefined
}

function highlightText(value: string, searchTerm: string) {
  const query = searchTerm.trim().toLocaleLowerCase()
  if (!query) return value
  const range = directMatchRange(value, query) ?? pinyinMatchRange(value, query)
  if (!range) return value
  return <>{value.slice(0, range.start)}<mark className="search-highlight">{value.slice(range.start, range.end)}</mark>{value.slice(range.end)}</>
}

export default function OperationNavigation({ operations, schemas, selectedOperationKey, onSelect }: OperationNavigationProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [searchHistory, setSearchHistory] = useState(storedSearchHistory)
  const [searchHistoryOpen, setSearchHistoryOpen] = useState(false)
  const visibleOperations = useMemo(() => searchOperations(operations, debouncedQuery, schemas), [operations, debouncedQuery, schemas])
  const groups = useMemo(() => groupOperations(visibleOperations), [visibleOperations])
  const historyOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return searchHistory
      .filter((entry) => !normalizedQuery || entry.toLocaleLowerCase().includes(normalizedQuery))
      .map((entry) => ({ label: entry, value: entry }))
  }, [query, searchHistory])
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])

  useEffect(() => {
    setExpandedKeys(groupOperations(operations).map(({ tag }) => `tag-${tag}`))
  }, [operations])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query)
      const entry = query.trim()
      if (!entry) return
      setSearchHistory((history) => {
        const next = [entry, ...history.filter((value) => value !== entry)].slice(0, MAX_SEARCH_HISTORY)
        saveSearchHistory(next)
        return next
      })
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [query])

  return (
    <nav className="operation-navigation" aria-label="API operations">
      <div className="operation-search-toolbar">
        <Typography.Text strong>Endpoints</Typography.Text>
        <AutoComplete
          onBlur={() => setSearchHistoryOpen(false)}
          onChange={setQuery}
          onFocus={() => setSearchHistoryOpen(true)}
          onSelect={(value) => { setQuery(value); setSearchHistoryOpen(false) }}
          open={searchHistoryOpen && historyOptions.length > 0}
          options={historyOptions}
          value={query}
        >
          <Input allowClear placeholder="Search endpoints" prefix={<SearchOutlined />} />
        </AutoComplete>
      </div>
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
                  <span className="operation-path" title={operation.path}>{highlightText(operation.path, debouncedQuery)}</span>
                  {operationDescription(operation) ? <span className="operation-description" title={operationDescription(operation)}>{highlightText(operationDescription(operation) as string, debouncedQuery)}</span> : null}
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
