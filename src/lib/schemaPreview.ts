function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stringPreview(schema: Record<string, unknown>, fieldName: string): string {
  const format = typeof schema.format === 'string' ? schema.format.toLowerCase() : ''
  const name = fieldName.toLowerCase()
  if (format === 'email' || name.includes('email')) return 'user@example.com'
  if (format === 'uri' || format === 'url' || name.includes('url')) return `https://example.com/${name.includes('avatar') ? 'avatar.png' : 'resource'}`
  if (format === 'uuid') return '00000000-0000-4000-8000-000000000000'
  if (format === 'date-time' || name.endsWith('at')) return '2026-01-01T00:00:00Z'
  if (format === 'date') return '2026-01-01'
  if (format === 'time') return '00:00:00Z'
  if (name.includes('name')) return 'Sample User'
  if (name.includes('title')) return 'Sample Title'
  if (name.includes('description') || name.includes('remark')) return 'Sample description'
  if (name.includes('phone') || name.includes('mobile')) return '13800000000'
  if (name.includes('status')) return 'active'
  if (name.includes('code')) return 'SAMPLE_CODE'
  if (name === 'id' || name.endsWith('id')) return 'sample-id'
  return 'sample string'
}

export function schemaPreview(schema: unknown, schemas?: Record<string, unknown>, ancestors = new WeakSet<object>(), fieldName = ''): unknown {
  if (!isRecord(schema)) return null
  const reference = typeof schema.$ref === 'string' ? schema.$ref.split('/').at(-1) : undefined
  const resolved = reference ? schemas?.[reference] : schema
  if (!isRecord(resolved)) return null
  if (ancestors.has(resolved)) return '[Circular]'

  ancestors.add(resolved)
  const finish = <T,>(value: T): T => {
    ancestors.delete(resolved)
    return value
  }

  if (resolved.example !== undefined) return finish(resolved.example)
  if (resolved.default !== undefined) return finish(resolved.default)
  if (Array.isArray(resolved.enum) && resolved.enum.length) return finish(resolved.enum[0])
  if (Array.isArray(resolved.allOf)) return finish(Object.assign({}, ...resolved.allOf.map((part) => schemaPreview(part, schemas, ancestors, fieldName))))
  if (Array.isArray(resolved.oneOf) && resolved.oneOf.length) return finish(schemaPreview(resolved.oneOf[0], schemas, ancestors, fieldName))
  if (Array.isArray(resolved.anyOf) && resolved.anyOf.length) return finish(schemaPreview(resolved.anyOf[0], schemas, ancestors, fieldName))
  if (resolved.type === 'array') return finish([schemaPreview(resolved.items, schemas, ancestors, fieldName)])
  if (resolved.type === 'object' || isRecord(resolved.properties)) {
    return finish(Object.fromEntries(Object.entries(isRecord(resolved.properties) ? resolved.properties : {}).map(([name, property]) => [name, schemaPreview(property, schemas, ancestors, name)])))
  }
  if (resolved.type === 'boolean') return finish(true)
  if (resolved.type === 'integer' || resolved.type === 'number') {
    return finish(typeof resolved.minimum === 'number' ? resolved.minimum : 1)
  }
  return finish(stringPreview(resolved, fieldName))
}
