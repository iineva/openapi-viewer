import { FileTextOutlined, GitlabOutlined } from '@ant-design/icons'
import { Button, Empty, List, Tag, Typography } from 'antd'
import type { GitLabOpenAPIFile } from '../lib/gitlab'

interface GitLabDocumentsPanelProps {
  activePath?: string
  files: GitLabOpenAPIFile[]
  onOpen: (file: GitLabOpenAPIFile) => void
  projectName?: string
  refName?: string
}

export default function GitLabDocumentsPanel({ activePath, files, onOpen, projectName, refName }: GitLabDocumentsPanelProps) {
  if (!projectName || !refName) return null
  return (
    <section aria-label="GitLab OpenAPI files" className="gitlab-documents-panel">
      <div className="panel-heading">
        <Typography.Text strong><GitlabOutlined /> GitLab</Typography.Text>
        <Tag>{refName}</Tag>
      </div>
      <Typography.Text className="gitlab-project-name" title={projectName}>{projectName}</Typography.Text>
      {files.length ? <List dataSource={files} renderItem={(file) => <List.Item className={file.path === activePath ? 'history-item history-item-active' : 'history-item'}><Button aria-label={`Open ${file.path}`} className="gitlab-file-link" icon={<FileTextOutlined />} onClick={() => onOpen(file)} type="text"><span>{file.path}</span><Typography.Text type="secondary">{file.title} {file.version}</Typography.Text></Button></List.Item>} /> : <Empty description="No OpenAPI files found" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
    </section>
  )
}
