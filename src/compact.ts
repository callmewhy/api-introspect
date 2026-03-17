import type { JSONSchema } from './types'

const MAX_SAFE_INT = 9007199254740991

/**
 * Strips noise from a JSON Schema while preserving standard structure.
 *
 * - Removes `additionalProperties: false`
 * - Simplifies nullable `anyOf` to `type: [X, "null"]`
 * - Strips date verbose metadata (`deprecated`, `title`, `description`)
 * - Removes meaningless `maximum: 9007199254740991`
 */
export function compactSchema(schema: JSONSchema | undefined): JSONSchema | undefined {
  if (!schema || typeof schema !== 'object')
    return undefined
  return cleanNode(schema)
}

function cleanNode(schema: JSONSchema): JSONSchema {
  const isDate = schema.type === 'string'
    && schema.format === 'date-time'
    && schema.deprecated === true

  const result: JSONSchema = {}

  for (const [key, value] of Object.entries(schema)) {
    if (key === 'additionalProperties' && value === false)
      continue
    if (key === 'maximum' && value === MAX_SAFE_INT)
      continue
    if (isDate && (key === 'deprecated' || key === 'title' || key === 'description'))
      continue

    if (key === 'properties' && isRecord(value)) {
      const cleaned: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value)) {
        cleaned[k] = isRecord(v) ? cleanNode(v as JSONSchema) : v
      }
      result[key] = cleaned
      continue
    }

    if (key === 'items' && isRecord(value)) {
      result[key] = cleanNode(value as JSONSchema)
      continue
    }

    if (key === 'anyOf' && Array.isArray(value)) {
      const simplified = simplifyNullableAnyOf(value as JSONSchema[])
      if (simplified) {
        Object.assign(result, simplified)
      }
      else {
        result[key] = value.map(v => isRecord(v) ? cleanNode(v as JSONSchema) : v)
      }
      continue
    }

    if (key === 'allOf' && Array.isArray(value)) {
      result[key] = value.map(v => isRecord(v) ? cleanNode(v as JSONSchema) : v)
      continue
    }

    result[key] = value
  }

  return result
}

function simplifyNullableAnyOf(parts: JSONSchema[]): JSONSchema | null {
  const nonNull = parts.filter(s => s.type !== 'null')
  if (nonNull.length !== 1 || nonNull.length === parts.length)
    return null

  const inner = cleanNode(nonNull[0])
  const type = inner.type
  if (typeof type !== 'string')
    return null

  const { type: _, ...rest } = inner
  return { type: [type, 'null'], ...rest }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
