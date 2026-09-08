import { FileTextOutlined, FolderOpenOutlined } from '@ant-design/icons'
import { Button, List, Typography } from 'antd'
import type { LocalOpenAPIFile } from '../lib/localOpenapi'

interface LocalDocumentsPanelProps {
  activePath?: string
  files: LocalOpenAPIFile[]
  onOpen: (file: LocalOpenAPIFile) => void
}

export default function LocalDocumentsPanel({ activePath, files, onOpen }: LocalDocumentsPanelProps) {
  if (!files.length) return null
  return (
    <section aria-label="Local OpenAPI files" className="local-documents-panel">
      <div className="panel-heading">
        <Typography.Text strong><FolderOpenOutlined /> Local files</Typography.Text>
      </div>
      <List dataSource={files} renderItem={(file) => <List.Item className={file.path === activePath ? 'history-item history-item-active' : 'history-item'}><Button aria-label={`Open ${file.path}`} className="gitlab-file-link" icon={<FileTextOutlined />} onClick={() => onOpen(file)} type="text"><span>{file.path}</span><Typography.Text type="secondary">{file.title} {file.version}</Typography.Text></Button></List.Item>} />
    </section>
  )
}
