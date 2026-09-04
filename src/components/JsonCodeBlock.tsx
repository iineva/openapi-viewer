import Prism from 'prismjs'
import 'prismjs/components/prism-json'

interface JsonCodeBlockProps {
  value: unknown
}

function stringify(value: unknown): string {
  const seen = new WeakSet<object>()
  const content = JSON.stringify(value, (_key, nestedValue) => {
    if (nestedValue && typeof nestedValue === 'object') {
      if (seen.has(nestedValue)) return '[Circular]'
      seen.add(nestedValue)
    }
    return nestedValue
  }, 2)
  return content === undefined ? String(value) : content
}

export default function JsonCodeBlock({ value }: JsonCodeBlockProps) {
  const content = stringify(value)
  const highlighted = Prism.highlight(content, Prism.languages.json, 'json')

  return (
    <pre aria-label="JSON content" className="json-code"><code dangerouslySetInnerHTML={{ __html: highlighted }} /></pre>
  )
}
