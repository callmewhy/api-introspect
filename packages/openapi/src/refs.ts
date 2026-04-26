import type { JSONSchema } from '@api-introspect/core'

import type { OpenAPIDocument } from './types'

/**
 * Resolves `$ref` pointers within an OpenAPI document.
 * Tracks visited refs to prevent infinite recursion on cyclic schemas.
 */
export function createRefResolver(doc: OpenAPIDocument) {
  function resolveRef(ref: string, seen: Set<string>): unknown {
    if (seen.has(ref))
      return { $ref: ref }
    if (!ref.startsWith('#/'))
      return { $ref: ref }

    const parts = ref.slice(2).split('/').map(decodePointer)
    let cursor: unknown = doc
    for (const part of parts) {
      if (cursor && typeof cursor === 'object' && part in (cursor as Record<string, unknown>)) {
        cursor = (cursor as Record<string, unknown>)[part]
      }
      else {
        return { $ref: ref }
      }
    }
    const next = new Set(seen)
    next.add(ref)
    return inlineRefs(cursor, next)
  }

  function inlineRefs(value: unknown, seen: Set<string> = new Set()): unknown {
    if (Array.isArray(value))
      return value.map(item => inlineRefs(item, seen))
    if (!value || typeof value !== 'object')
      return value

    const obj = value as Record<string, unknown>
    if (typeof obj.$ref === 'string')
      return resolveRef(obj.$ref, seen)

    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj))
      out[k] = inlineRefs(v, seen)
    return out
  }

  return {
    resolveSchema(schema: JSONSchema | undefined): JSONSchema | undefined {
      if (!schema)
        return undefined
      const result = inlineRefs(schema)
      return (result && typeof result === 'object') ? result as JSONSchema : undefined
    },
    resolve(value: unknown): unknown {
      return inlineRefs(value)
    },
  }
}

const ENCODED_SLASH = /~1/g
const ENCODED_TILDE = /~0/g

function decodePointer(segment: string): string {
  return segment.replace(ENCODED_SLASH, '/').replace(ENCODED_TILDE, '~')
}
