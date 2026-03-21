import type { IntrospectionResult, Serializer } from '@api-introspect/core'

export interface TransformerLike {
  serialize: (value: unknown) => unknown
  deserialize: (value: unknown) => unknown
}

export interface FetchIntrospectionOptions {
  /** Introspection endpoint path (default: `'_introspect'`) */
  path?: string
  /** Path prefix filter appended to introspection path, e.g. `'user'` fetches `/_introspect.user` */
  filter?: string
  /** Custom fetch headers */
  headers?: Record<string, string>
}

export interface CallProcedureOptions {
  /** Procedure type. Required unless `introspection` is provided for auto-detection. */
  type?: 'query' | 'mutation'
  /** Input data to send */
  input?: unknown
  /** Wire format (default: `'json'`). Use `TransformerLike` for custom transformers. */
  transformer?: 'json' | 'superjson' | TransformerLike
  /** Custom fetch headers */
  headers?: Record<string, string>
  /** Pre-fetched introspection result to auto-detect `type` and `transformer`. Avoids an extra round-trip. */
  introspection?: IntrospectionResult
}

const TRAILING_SLASHES = /\/+$/
const REST_PATH_RE = /^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+(\/.*)$/i
const PATH_PARAM_RE = /:([A-Z_]\w*)/gi

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(TRAILING_SLASHES, '')
  return `${base}/${path}`
}

/**
 * Fetch introspection data from a tRPC server.
 *
 * @param baseUrl - Base URL of the tRPC server, e.g. `http://localhost:3000`
 * @param options - Optional settings for introspection path, prefix filter, and headers
 */
export async function fetchIntrospection(
  baseUrl: string,
  options: FetchIntrospectionOptions = {},
): Promise<IntrospectionResult> {
  const { path = '_introspect', filter, headers } = options
  const endpoint = filter ? `${path}.${filter}` : path
  const url = joinUrl(baseUrl, endpoint)

  const res = await fetch(url, { headers })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }

  const json: unknown = await res.json()
  let data = unwrapTRPCResponse(json)

  if (isSuperJSONEnvelope(data)) {
    data = (data as { json: unknown }).json
  }

  return data as IntrospectionResult
}

/**
 * Call a tRPC procedure.
 *
 * @param baseUrl - Base URL of the tRPC server, e.g. `http://localhost:3000`
 * @param procedure - Procedure path, e.g. `'user.getById'`
 * @param options - Optional input, type override, transformer, headers, or pre-fetched introspection
 */
export async function callProcedure(
  baseUrl: string,
  procedure: string,
  options: CallProcedureOptions = {},
): Promise<unknown> {
  const { input, headers = {} } = options
  let { type, transformer } = options

  // Auto-detect type and transformer from introspection
  if (!type || !transformer) {
    const introspection = options.introspection ?? await fetchIntrospection(baseUrl, { headers })
    if (!introspection?.procedures) {
      throw new Error('Invalid introspection response: missing "procedures" field')
    }
    const proc = introspection.procedures.find(p => p.path === procedure)
    if (!proc) {
      const available = introspection.procedures.map(p => p.path).join(', ')
      throw new Error(`Procedure "${procedure}" not found. Available: ${available}`)
    }
    type ??= proc.type === 'mutation' ? 'mutation' : 'query'
    transformer ??= resolveTransformer(introspection.serializer)
  }

  // REST-style paths like "GET /user/:id" — extract method and substitute params
  const restMatch = procedure.match(REST_PATH_RE)

  let res: Response
  if (restMatch) {
    const method = restMatch[1].toUpperCase()
    let routePath = restMatch[2]
    let body: Record<string, unknown> | undefined

    // Substitute path params (:id) from input and collect remaining fields for body
    if (input && typeof input === 'object' && !Array.isArray(input)) {
      const remaining = { ...(input as Record<string, unknown>) }
      routePath = routePath.replace(PATH_PARAM_RE, (_match, param: string) => {
        const value = remaining[param]
        delete remaining[param]
        return String(value ?? '')
      })
      if (Object.keys(remaining).length > 0) {
        body = remaining
      }
    }

    const url = `${baseUrl.replace(TRAILING_SLASHES, '')}${routePath}`
    res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json', ...headers } : headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  }
  else {
    const url = joinUrl(baseUrl, procedure)
    const encoded = encodeInput(input, transformer)

    if (type === 'mutation') {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: encoded !== undefined ? JSON.stringify(encoded) : undefined,
      })
    }
    else {
      const queryUrl = encoded !== undefined
        ? `${url}?input=${encodeURIComponent(JSON.stringify(encoded))}`
        : url
      res = await fetch(queryUrl, { headers })
    }
  }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HTTP ${res.status}: ${body}`)
  }

  const json: unknown = await res.json()
  const data = unwrapTRPCResponse(json)
  return decodeOutput(data, transformer)
}

function resolveTransformer(serializer: Serializer): 'json' | 'superjson' {
  return serializer === 'superjson' ? 'superjson' : 'json'
}

function encodeInput(input: unknown, transformer: 'json' | 'superjson' | TransformerLike): unknown {
  if (input === undefined)
    return undefined
  if (transformer === 'superjson')
    return { json: input, meta: {} }
  if (typeof transformer === 'object')
    return transformer.serialize(input)
  return input
}

function decodeOutput(data: unknown, transformer: 'json' | 'superjson' | TransformerLike): unknown {
  if (transformer === 'superjson') {
    return isSuperJSONEnvelope(data) ? (data as { json: unknown }).json : data
  }
  if (typeof transformer === 'object')
    return transformer.deserialize(data)
  return data
}

function unwrapTRPCResponse(json: unknown): unknown {
  if (typeof json === 'object' && json !== null && 'result' in json) {
    const result = (json as { result: unknown }).result
    if (typeof result === 'object' && result !== null && 'data' in result) {
      return (result as { data: unknown }).data
    }
  }
  // Check for tRPC error response
  if (typeof json === 'object' && json !== null && 'error' in json) {
    const error = (json as { error: { message?: string } }).error
    throw new Error(`tRPC error: ${error?.message ?? JSON.stringify(error)}`)
  }
  // Plain JSON response (e.g. from Fastify / REST)
  return json
}

function isSuperJSONEnvelope(data: unknown): boolean {
  return typeof data === 'object' && data !== null && 'json' in data
}
