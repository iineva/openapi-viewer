import { ClearOutlined, DeleteOutlined, FileTextOutlined, LinkOutlined } from '@ant-design/icons'
import { Button, Empty, List, Space, Typography } from 'antd'
import type { StoredDocument } from '../types/openapi'

interface HistoryPanelProps {
  documents: StoredDocument[]
  activeDocumentId?: string
  onOpen: (document: StoredDocument) => void
  onRemove: (id: string) => void
  onClear: () => void
}

export default function HistoryPanel({ documents, activeDocumentId, onOpen, onRemove, onClear }: HistoryPanelProps) {
  return (
    <section className="history-panel" aria-label="Document history">
      <div className="panel-heading">
        <Typography.Text strong>History</Typography.Text>
        <Button
          aria-label="Clear document history"
          disabled={!documents.length}
          icon={<ClearOutlined />}
          onClick={onClear}
          size="small"
          type="text"
        />
      </div>
      {documents.length ? (
        <List
          dataSource={documents}
          renderItem={(document) => (
            <List.Item
              className={document.id === activeDocumentId ? 'history-item history-item-active' : 'history-item'}
              actions={[
                <Button
                  aria-label={`Remove ${document.name}`}
                  icon={<DeleteOutlined />}
                  key="remove"
                  onClick={(event) => {
                    event.stopPropagation()
                    onRemove(document.id)
                  }}
                  size="small"
                  type="text"
                />,
              ]}
              onClick={() => onOpen(document)}
            >
              <List.Item.Meta
                avatar={document.sourceKind === 'url' ? <LinkOutlined /> : <FileTextOutlined />}
                description={new Date(document.lastOpenedAt).toLocaleString()}
                title={document.name}
              />
            </List.Item>
          )}
        />
      ) : (
        <Empty description="No saved documents" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
      <Space className="history-source-note" direction="vertical" size={2}>
        <Typography.Text type="secondary">Browser history</Typography.Text>
      </Space>
    </section>
  )
}
