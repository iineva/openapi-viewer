import { BookOutlined, FolderOpenOutlined, GitlabOutlined, LinkOutlined, MenuFoldOutlined, MenuOutlined, MenuUnfoldOutlined, MoreOutlined, SettingOutlined } from '@ant-design/icons'
import { Alert, Button, Drawer, Dropdown, Grid, Input, Layout, Modal, Select, Space, Tooltip, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DocumentReader from './components/DocumentReader'
import GitLabDocumentsPanel from './components/GitLabDocumentsPanel'
import HistoryPanel from './components/HistoryPanel'
import OperationNavigation from './components/OperationNavigation'
import { loadFileDocument, loadRemoteDocument } from './lib/documents'
import { getOperations, parseSpecification } from './lib/openapi'
import { documentRepository } from './lib/repository'
import { gitLabBranches, gitLabFileContent, gitLabProjects, gitLabSession, scanGitLabOpenAPIFiles } from './lib/gitlab'
import type { GitLabBranch, GitLabOpenAPIFile, GitLabProject, GitLabUser } from './lib/gitlab'
import type { ApiDocument, Operation, StoredDocument } from './types/openapi'

interface ActiveDocument {
  record: StoredDocument
  specification: ApiDocument
}

const PANEL_WIDTHS_KEY = 'openapi-viewer:panel-widths'
const HISTORY_COLLAPSED_KEY = 'openapi-viewer:history-collapsed'
const GITLAB_SELECTION_PREFIX = 'openapi-viewer:gitlab-selection'
const DEFAULT_PANEL_WIDTHS = { history: 224, navigation: 272 }

type PanelName = keyof typeof DEFAULT_PANEL_WIDTHS
type PanelWidths = typeof DEFAULT_PANEL_WIDTHS

interface GitLabSelection {
  filePath?: string
  projectID: number
  projectName: string
  ref: string
}

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

function storedHistoryCollapsed(): boolean {
  return window.localStorage.getItem(HISTORY_COLLAPSED_KEY) === 'true'
}

function constrainWidth(panel: PanelName, width: number): number {
  const [minimum, maximum] = panel === 'history' ? [180, 360] : [220, 480]
  return Math.min(maximum, Math.max(minimum, width))
}

function selectedHash(): string | undefined {
  return window.location.hash.slice(1) || undefined
}

function gitLabSelectionKey(userID: number): string {
  return `${GITLAB_SELECTION_PREFIX}:${userID}`
}

function storedGitLabSelection(userID: number): GitLabSelection | undefined {
  try {
    const selection = JSON.parse(window.localStorage.getItem(gitLabSelectionKey(userID)) ?? '{}') as Partial<GitLabSelection>
    return typeof selection.projectID === 'number' && typeof selection.projectName === 'string' && typeof selection.ref === 'string' ? selection as GitLabSelection : undefined
  } catch {
    return undefined
  }
}

export default function App() {
  const screens = Grid.useBreakpoint()
  const fileInput = useRef<HTMLInputElement>(null)
  const activeDocumentId = useRef<string | undefined>(undefined)
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
  const [historyCollapsed, setHistoryCollapsed] = useState(storedHistoryCollapsed)
  const [gitLabUser, setGitLabUser] = useState<GitLabUser>()
  const [gitLabSettingsOpen, setGitLabSettingsOpen] = useState(false)
  const [gitLabProjectList, setGitLabProjectList] = useState<GitLabProject[]>([])
  const [gitLabBranchList, setGitLabBranchList] = useState<GitLabBranch[]>([])
  const [gitLabSelection, setGitLabSelection] = useState<GitLabSelection>()
  const [gitLabFiles, setGitLabFiles] = useState<GitLabOpenAPIFile[]>([])
  const [selectedGitLabProjectID, setSelectedGitLabProjectID] = useState<number>()
  const [selectedGitLabRef, setSelectedGitLabRef] = useState('')
  const operations = useMemo(() => activeDocument
    ? getOperations(activeDocument.specification, activeDocument.record.sourceKind === 'url' ? activeDocument.record.sourceValue : undefined)
    : [], [activeDocument])
  const schemas = (activeDocument?.specification.components as { schemas?: Record<string, unknown> } | undefined)?.schemas
  const compact = !screens.md

  const refreshHistory = useCallback(async () => {
    setHistory(await documentRepository.list())
  }, [])

  useEffect(() => {
    void gitLabSession().then(setGitLabUser).catch(() => undefined)
  }, [])

  useEffect(() => {
    let mounted = true
    const restoreLatestDocument = async () => {
      const documents = await documentRepository.list()
      if (!mounted) return
      setHistory(documents)
      const record = documents[0]
      if (!record) return

      const specification = await parseSpecification(record.content)
      if (!mounted) return
      const documentUrl = record.sourceKind === 'url' ? record.sourceValue : undefined
      const restoredOperations = getOperations(specification, documentUrl)
      const hash = selectedHash()
      activeDocumentId.current = record.id
      setActiveDocument({ record, specification })
      setSelectedOperationKey(restoredOperations.some(({ key }) => key === hash) ? hash : restoredOperations[0]?.key)

      if (record.sourceKind !== 'url') return
      try {
        const refreshed = await loadRemoteDocument(record.sourceValue)
        if (!mounted) return
        const refreshedRecord = { ...refreshed.record, createdAt: record.createdAt, id: record.id }
        await documentRepository.save(refreshedRecord)
        if (!mounted) return
        setHistory(await documentRepository.list())
        if (activeDocumentId.current !== record.id) return
        const refreshedOperations = getOperations(refreshed.specification, refreshedRecord.sourceValue)
        const refreshedHash = selectedHash()
        activeDocumentId.current = refreshedRecord.id
        setActiveDocument({ record: refreshedRecord, specification: refreshed.specification })
        setSelectedOperationKey(refreshedOperations.some(({ key }) => key === refreshedHash) ? refreshedHash : refreshedOperations[0]?.key)
      } catch {
        // The successfully parsed cache remains readable when the remote source is unavailable.
      }
    }

    void restoreLatestDocument().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to restore the most recent document.'))
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    const onHashChange = () => setSelectedOperationKey(selectedHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const activate = useCallback(async (next: ActiveDocument) => {
    await documentRepository.save(next.record)
    activeDocumentId.current = next.record.id
    setActiveDocument(next)
    setError(undefined)
    const hash = selectedHash()
    const documentUrl = next.record.sourceKind === 'url' ? next.record.sourceValue : undefined
    const nextOperations = getOperations(next.specification, documentUrl)
    setSelectedOperationKey(nextOperations.some(({ key }) => key === hash) ? hash : nextOperations[0]?.key)
    await refreshHistory()
  }, [refreshHistory])

  const openGitLabFile = useCallback(async (selection: GitLabSelection, file: GitLabOpenAPIFile) => {
    setIsLoading(true)
    try {
      const content = await gitLabFileContent(selection.projectID, selection.ref, file.path)
      const specification = await parseSpecification(content)
      const now = new Date().toISOString()
      await activate({
        record: {
          content,
          createdAt: now,
          id: `gitlab-${selection.projectID}-${selection.ref}-${file.path}`,
          lastOpenedAt: now,
          name: file.path,
          sourceKind: 'gitlab',
          sourceValue: `gitlab://${selection.projectID}/${selection.ref}/${file.path}`,
        },
        specification,
      })
      const nextSelection = { ...selection, filePath: file.path }
      setGitLabSelection(nextSelection)
      if (gitLabUser) window.localStorage.setItem(gitLabSelectionKey(gitLabUser.id), JSON.stringify(nextSelection))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load this GitLab OpenAPI document.')
    } finally {
      setIsLoading(false)
    }
  }, [activate, gitLabUser])

  const scanGitLabRepository = useCallback(async (selection: GitLabSelection) => {
    setIsLoading(true)
    try {
      const files = await scanGitLabOpenAPIFiles(selection.projectID, selection.ref)
      setGitLabSelection(selection)
      setGitLabFiles(files)
      if (gitLabUser) window.localStorage.setItem(gitLabSelectionKey(gitLabUser.id), JSON.stringify(selection))
      const selectedFile = selection.filePath ? files.find(({ path }) => path === selection.filePath) : undefined
      if (selectedFile) await openGitLabFile(selection, selectedFile)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to scan the GitLab repository.')
    } finally {
      setIsLoading(false)
    }
  }, [gitLabUser, openGitLabFile])

  useEffect(() => {
    if (!gitLabUser) return
    const selection = storedGitLabSelection(gitLabUser.id)
    if (!selection) return
    setSelectedGitLabProjectID(selection.projectID)
    setSelectedGitLabRef(selection.ref)
    void scanGitLabRepository(selection)
  }, [gitLabUser, scanGitLabRepository])

  const openGitLabSettings = async () => {
    if (!gitLabUser) {
      window.location.assign('/api/auth/gitlab/login')
      return
    }
    setGitLabSettingsOpen(true)
    try {
      setGitLabProjectList(await gitLabProjects())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load GitLab projects.')
    }
  }

  const selectGitLabProject = async (projectID: number) => {
    setSelectedGitLabProjectID(projectID)
    const project = gitLabProjectList.find(({ id }) => id === projectID)
    setSelectedGitLabRef(project?.default_branch ?? '')
    try {
      setGitLabBranchList(await gitLabBranches(projectID))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load GitLab branches.')
    }
  }

  const confirmGitLabRepository = () => {
    const project = gitLabProjectList.find(({ id }) => id === selectedGitLabProjectID)
    if (!project || !selectedGitLabRef) return
    setGitLabSettingsOpen(false)
    void scanGitLabRepository({ projectID: project.id, projectName: project.path_with_namespace, ref: selectedGitLabRef })
  }

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
    if (activeDocument?.record.id === id) {
      activeDocumentId.current = undefined
      setActiveDocument(undefined)
    }
    await refreshHistory()
  }

  const handleClear = async () => {
    await documentRepository.clear()
    setHistory([])
  }

  const toggleHistory = () => {
    setHistoryCollapsed((collapsed) => {
      const next = !collapsed
      window.localStorage.setItem(HISTORY_COLLAPSED_KEY, String(next))
      return next
    })
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
  const gitLabPanel = <GitLabDocumentsPanel activePath={gitLabSelection?.filePath} files={gitLabFiles} onOpen={(file) => gitLabSelection && void openGitLabFile(gitLabSelection, file)} projectName={gitLabSelection?.projectName} refName={gitLabSelection?.ref} />
  const operationNavigation = <OperationNavigation onSelect={handleSelect} operations={operations} schemas={schemas} selectedOperationKey={selectedOperationKey} />

  return (
    <Layout className="app-shell">
      <Layout.Header className="app-header">
        <Space align="center" size="middle">
          <BookOutlined className="brand-icon" />
          <Typography.Text className="app-title">OpenAPI Viewer</Typography.Text>
        </Space>
        <Space className="header-actions" size="small">
          <Button aria-label={gitLabUser ? 'Configure GitLab repository' : 'Log in to GitLab'} icon={gitLabUser ? <SettingOutlined /> : <GitlabOutlined />} onClick={() => void openGitLabSettings()} type="text">{compact ? null : gitLabUser ? 'Repository' : 'GitLab'}</Button>
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
      <div aria-label="Viewer panes" className="viewer-layout">
        {!compact && !historyCollapsed ? <aside className="history-rail" style={{ width: panelWidths.history }}>{gitLabPanel}{historyPanel}</aside> : null}
        {!compact ? (
          <div className="history-toggle">
            <Tooltip title={historyCollapsed ? 'Expand history' : 'Collapse history'}>
              <Button
                aria-label={historyCollapsed ? 'Expand document history' : 'Collapse document history'}
                icon={historyCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={toggleHistory}
                size="small"
                type="text"
              />
            </Tooltip>
          </div>
        ) : null}
        {!compact && !historyCollapsed ? <div aria-label="Resize history panel" className="panel-resizer" onPointerDown={(event) => startResize('history', event)} role="separator" /> : null}
        {!compact ? <aside className="navigation-rail" style={{ width: panelWidths.navigation }}>{operationNavigation}</aside> : null}
        {!compact ? <div aria-label="Resize endpoint panel" className="panel-resizer" onPointerDown={(event) => startResize('navigation', event)} role="separator" /> : null}
        <section className="reader-content"><DocumentReader document={activeDocument?.specification} operations={operations} selectedOperationKey={selectedOperationKey} /></section>
      </div>
      <Drawer onClose={() => setHistoryOpen(false)} open={historyOpen} size="default" title="Document history">{gitLabPanel}{historyPanel}</Drawer>
      <Drawer onClose={() => setNavigationOpen(false)} open={navigationOpen} size="default" title="API operations">{operationNavigation}</Drawer>
      <Drawer onClose={() => setGitLabSettingsOpen(false)} open={gitLabSettingsOpen} size="default" title="GitLab repository">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Typography.Text type="secondary">{gitLabUser ? `Signed in as ${gitLabUser.name || gitLabUser.username}` : null}</Typography.Text>
          <Select
            aria-label="GitLab project"
            onChange={(value) => void selectGitLabProject(value)}
            options={gitLabProjectList.map((project) => ({ label: project.path_with_namespace, value: project.id }))}
            placeholder="Select a repository"
            showSearch
            value={selectedGitLabProjectID}
          />
          <Select
            aria-label="GitLab ref"
            disabled={!selectedGitLabProjectID}
            onChange={setSelectedGitLabRef}
            options={gitLabBranchList.map(({ name }) => ({ label: name, value: name }))}
            placeholder="Select a branch or tag"
            showSearch
            value={selectedGitLabRef || undefined}
          />
          <Button disabled={!selectedGitLabProjectID || !selectedGitLabRef} loading={isLoading} onClick={confirmGitLabRepository} type="primary">Scan OpenAPI files</Button>
        </Space>
      </Drawer>
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
