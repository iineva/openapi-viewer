import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownDescriptionProps {
  compact?: boolean
  value: string
}

/** OpenAPI description content is untrusted, so raw HTML is never enabled. */
export default function MarkdownDescription({ compact = false, value }: MarkdownDescriptionProps) {
  return <div className={compact ? 'markdown-description markdown-description-compact' : 'markdown-description'}><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{value}</ReactMarkdown></div>
}
