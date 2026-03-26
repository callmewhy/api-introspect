import type { JSONSchema } from './types'

const MAX_SAFE_INT = 9007199254740991

/** Keys that are pure noise for LLM consumers. */
const STRIP_KEYS = new Set(['pattern', 'format', 'title', 'examples', '$id'])

/**
 * Strips noise from a JSON Schema for LLM consumption.
 *
 * Removed: `additionalProperties: false`, `pattern`, `format`, `title`,
 * `examples`, `$id`, `maximum: MAX_SAFE_INT`.
 * Simplified: nullable primitive `anyOf` → `type: [X, "null"]`, all-const `anyOf` → `enum`.
 * Preserved as `anyOf`: nullable object/array types for better toolchain compatibility.
 * Preserved: `type`, `properties`, `required`, `items`, `enum`, `description`,
 * `minimum`, `maximum`, `minLength`, `maxLength`, `exclusiveMinimum`, `exclusiveMaximum`.
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
    if (STRIP_KEYS.has(key))
      continue
    if (isDate && (key === 'deprecated' || key === 'description'))
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
        continue
      }
      const constEnum = simplifyConstAnyOf(value as JSONSchema[])
      if (constEnum) {
        result.enum = constEnum
        continue
      }
      result[key] = value.map(v => isRecord(v) ? cleanNode(v as JSONSchema) : v)
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

const PRIMITIVE_TYPES = new Set(['string', 'number', 'integer', 'boolean'])

function simplifyNullableAnyOf(parts: JSONSchema[]): JSONSchema | null {
  const nonNull = parts.filter(s => s.type !== 'null')
  if (nonNull.length !== 1 || nonNull.length === parts.length)
    return null

  const inner = cleanNode(nonNull[0])
  const type = inner.type
  if (typeof type !== 'string')
    return null

  // Only simplify primitives; keep anyOf for object/array for better compatibility
  if (!PRIMITIVE_TYPES.has(type))
    return null

  const { type: _, ...rest } = inner
  return { type: [type, 'null'], ...rest }
}

function simplifyConstAnyOf(parts: JSONSchema[]): unknown[] | null {
  if (parts.length === 0)
    return null
  const values: unknown[] = []
  for (const part of parts) {
    if (part.const === undefined)
      return null
    values.push(part.const)
  }
  return values
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
