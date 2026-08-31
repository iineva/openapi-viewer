import { BookOutlined, FolderOpenOutlined, LinkOutlined, MenuOutlined, MoreOutlined } from '@ant-design/icons'
import { Alert, Button, Drawer, Dropdown, Grid, Input, Layout, Modal, Space, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DocumentReader from './components/DocumentReader'
import HistoryPanel from './components/HistoryPanel'
import OperationNavigation from './components/OperationNavigation'
import { loadFileDocument, loadRemoteDocument } from './lib/documents'
import { getOperations, parseSpecification } from './lib/openapi'
import { documentRepository } from './lib/repository'
import type { ApiDocument, Operation, StoredDocument } from './types/openapi'

interface ActiveDocument {
  record: StoredDocument
  specification: ApiDocument
}

const PANEL_WIDTHS_KEY = 'openapi-viewer:panel-widths'
const DEFAULT_PANEL_WIDTHS = { history: 224, navigation: 272 }

type PanelName = keyof typeof DEFAULT_PANEL_WIDTHS
type PanelWidths = typeof DEFAULT_PANEL_WIDTHS

function storedPanelWidths(): PanelWidths {
  try {
    const stored = JSON.parse(window.localStorage.getItem(PANEL_WIDTHS_KEY) ?? '{}') as Partial<PanelWidths>
    return {
      history: typeof stored.history === 'number' ? stored.history : DEFAULT_PANEL_WIDTHS.history,
      navigation: typeof stored.navigation === 'number' ? stored.navigation : DEFAULT_PANEL_WIDTHS.navigation,
    }
  } catch {
    return DEFAULT_PANEL_WIDTHS
  }
}

function constrainWidth(panel: PanelName, width: number): number {
  const [minimum, maximum] = panel === 'history' ? [180, 360] : [220, 480]
  return Math.min(maximum, Math.max(minimum, width))
}

function selectedHash(): string | undefined {
  return window.location.hash.slice(1) || undefined
}

export default function App() {
  const screens = Grid.useBreakpoint()
  const fileInput = useRef<HTMLInputElement>(null)
  const [activeDocument, setActiveDocument] = useState<ActiveDocument>()
  const [history, setHistory] = useState<StoredDocument[]>([])
  const [selectedOperationKey, setSelectedOperationKey] = useState(selectedHash)
  const [error, setError] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)
  const [urlOpen, setUrlOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [panelWidths, setPanelWidths] = useState<PanelWidths>(storedPanelWidths)
  const operations = useMemo(() => activeDocument
    ? getOperations(activeDocument.specification, activeDocument.record.sourceKind === 'url' ? activeDocument.record.sourceValue : undefined)
    : [], [activeDocument])
  const compact = !screens.md

  const refreshHistory = useCallback(async () => {
    setHistory(await documentRepository.list())
  }, [])

  useEffect(() => {
    void refreshHistory().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to read document history.'))
  }, [refreshHistory])

  useEffect(() => {
    const onHashChange = () => setSelectedOperationKey(selectedHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const activate = useCallback(async (next: ActiveDocument) => {
    await documentRepository.save(next.record)
    setActiveDocument(next)
    setError(undefined)
    const hash = selectedHash()
    const documentUrl = next.record.sourceKind === 'url' ? next.record.sourceValue : undefined
    const nextOperations = getOperations(next.specification, documentUrl)
    setSelectedOperationKey(nextOperations.some(({ key }) => key === hash) ? hash : nextOperations[0]?.key)
    await refreshHistory()
  }, [refreshHistory])

  const handleFile = async (file?: File) => {
    if (!file) return
    setIsLoading(true)
    try {
      await activate(await loadFileDocument(file))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load this document.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUrl = async () => {
    setIsLoading(true)
    try {
      await activate(await loadRemoteDocument(url))
      setUrlOpen(false)
      setUrl('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load this document.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleHistoryOpen = async (record: StoredDocument) => {
    setIsLoading(true)
    try {
      const specification = await parseSpecification(record.content)
      await activate({ record: { ...record, lastOpenedAt: new Date().toISOString() }, specification })
      setHistoryOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to open this saved document.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelect = (operation: Operation) => {
    window.location.hash = operation.key
    setSelectedOperationKey(operation.key)
    setNavigationOpen(false)
    requestAnimationFrame(() => document.getElementById(operation.key)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const handleRemove = async (id: string) => {
    await documentRepository.remove(id)
    if (activeDocument?.record.id === id) setActiveDocument(undefined)
    await refreshHistory()
  }

  const handleClear = async () => {
    await documentRepository.clear()
    setHistory([])
  }

  const startResize = (panel: PanelName, event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = panelWidths[panel]
    let nextWidth = startWidth
    const onMove = (moveEvent: PointerEvent) => {
      nextWidth = constrainWidth(panel, startWidth + moveEvent.clientX - startX)
      setPanelWidths((current) => ({ ...current, [panel]: nextWidth }))
    }
    const onEnd = () => {
      window.localStorage.setItem(PANEL_WIDTHS_KEY, JSON.stringify({ ...panelWidths, [panel]: nextWidth }))
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd)
  }

  const historyPanel = <HistoryPanel activeDocumentId={activeDocument?.record.id} documents={history} onClear={() => void handleClear()} onOpen={(record) => void handleHistoryOpen(record)} onRemove={(id) => void handleRemove(id)} />
  const operationNavigation = <OperationNavigation onSelect={handleSelect} operations={operations} selectedOperationKey={selectedOperationKey} />

  return (
    <Layout className="app-shell">
      <Layout.Header className="app-header">
        <Space align="center" size="middle">
          <BookOutlined className="brand-icon" />
          <Typography.Text className="app-title">OpenAPI Viewer</Typography.Text>
        </Space>
        <Space className="header-actions" size="small">
          {compact ? <Button aria-label="Open document history" icon={<FolderOpenOutlined />} onClick={() => setHistoryOpen(true)} type="text" /> : null}
          {compact ? <Button aria-label="Open operation navigation" icon={<MenuOutlined />} onClick={() => setNavigationOpen(true)} type="text" /> : null}
          <input accept=".yaml,.yml,.json,application/json,application/yaml" aria-label="OpenAPI file" className="file-input" onChange={(event) => void handleFile(event.target.files?.[0])} ref={fileInput} type="file" />
          {compact ? (
            <Dropdown
              menu={{
                items: [
                  { key: 'open-file', label: 'Open file', onClick: () => fileInput.current?.click() },
                  { key: 'load-url', label: 'Load URL', onClick: () => setUrlOpen(true) },
                ],
              }}
              trigger={['click']}
            >
              <Button aria-label="Open source actions" icon={<MoreOutlined />} loading={isLoading} type="text" />
            </Dropdown>
          ) : (
            <>
              <Button icon={<FolderOpenOutlined />} loading={isLoading} onClick={() => fileInput.current?.click()}>Open file</Button>
              <Button icon={<LinkOutlined />} onClick={() => setUrlOpen(true)} type="primary">Load URL</Button>
            </>
          )}
        </Space>
      </Layout.Header>
      {error ? <Alert banner closable message={error} onClose={() => setError(undefined)} type="error" /> : null}
      <Layout className="viewer-layout">
        {!compact ? <aside className="history-rail" style={{ width: panelWidths.history }}>{historyPanel}</aside> : null}
        {!compact ? <div aria-label="Resize history panel" className="panel-resizer" onPointerDown={(event) => startResize('history', event)} role="separator" /> : null}
        {!compact ? <aside className="navigation-rail" style={{ width: panelWidths.navigation }}>{operationNavigation}</aside> : null}
        {!compact ? <div aria-label="Resize endpoint panel" className="panel-resizer" onPointerDown={(event) => startResize('navigation', event)} role="separator" /> : null}
        <Layout.Content className="reader-content"><DocumentReader document={activeDocument?.specification} operations={operations} selectedOperationKey={selectedOperationKey} /></Layout.Content>
      </Layout>
      <Drawer onClose={() => setHistoryOpen(false)} open={historyOpen} size="default" title="Document history">{historyPanel}</Drawer>
      <Drawer onClose={() => setNavigationOpen(false)} open={navigationOpen} size="default" title="API operations">{operationNavigation}</Drawer>
      <Modal
        confirmLoading={isLoading}
        okText="Load document"
        onCancel={() => setUrlOpen(false)}
        onOk={() => void handleUrl()}
        open={urlOpen}
        title="Load OpenAPI URL"
      >
        <Input autoFocus onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/openapi.yaml" value={url} />
      </Modal>
    </Layout>
  )
}
