import type { IntrospectionResult } from '@api-introspect/core'
import type { OpenAPIDocument } from '@api-introspect/openapi'
import { openAPIToIntrospection } from '@api-introspect/openapi'

const TRAILING_SLASHES = /\/+$/
const INTROSPECT_SUFFIX = /\/_introspect\/?$/

export interface LoadSourceOptions {
  /** Fallback path appended to base URLs that aren't direct introspection/spec URLs. */
  introspectPath?: string
  /** Custom fetch headers. */
  headers?: Record<string, string>
}

export interface LoadedSource {
  /** Unified introspection envelope (converted from OpenAPI when applicable). */
  introspection: IntrospectionResult
  /** Origin used to issue `call` requests. */
  baseUrl: string
  /** How the source was identified. */
  kind: 'introspect' | 'openapi'
}

/**
 * Loads an introspection envelope from any of:
 * - a tRPC/Fastify `_introspect` endpoint URL
 * - a base URL whose `_introspect` endpoint should be probed
 * - an OpenAPI / Swagger spec URL (auto-detected by `openapi` / `swagger` field)
 */
export async function loadSource(
  url: string,
  options: LoadSourceOptions = {},
): Promise<LoadedSource> {
  const { introspectPath = '/_introspect', headers } = options

  const direct = await tryFetchJson(url, headers)
  if (direct) {
    const openapi = asOpenAPIDocument(direct)
    if (openapi) {
      const introspection = openAPIToIntrospection(openapi)
      return {
        introspection,
        baseUrl: openapi.servers?.[0]?.url?.trim() || originOf(url),
        kind: 'openapi',
      }
    }

    const envelope = asIntrospectionResult(unwrapTRPCResponse(direct))
    if (envelope) {
      return {
        introspection: envelope,
        baseUrl: stripIntrospectSuffix(url),
        kind: 'introspect',
      }
    }
  }

  // Fallback: treat the input as a base URL and probe `${base}${introspectPath}`.
  const probe = `${url.replace(TRAILING_SLASHES, '')}${introspectPath}`
  const probed = await tryFetchJson(probe, headers)
  if (probed !== undefined) {
    const envelope = asIntrospectionResult(unwrapTRPCResponse(probed))
    if (envelope) {
      return { introspection: envelope, baseUrl: url.replace(TRAILING_SLASHES, ''), kind: 'introspect' }
    }
  }

  throw new Error(`Could not load introspection from ${url}. Tried direct fetch and ${probe}.`)
}

async function tryFetchJson(url: string, headers: Record<string, string> | undefined): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(url, { headers })
  }
  catch {
    return undefined
  }
  if (!res.ok)
    return undefined
  try {
    return await res.json() as unknown
  }
  catch {
    return undefined
  }
}

function asOpenAPIDocument(value: unknown): OpenAPIDocument | undefined {
  if (!value || typeof value !== 'object')
    return undefined
  const obj = value as Record<string, unknown>
  if (typeof obj.openapi === 'string' || typeof obj.swagger === 'string') {
    return obj as OpenAPIDocument
  }
  return undefined
}

function asIntrospectionResult(value: unknown): IntrospectionResult | undefined {
  if (!value || typeof value !== 'object')
    return undefined
  const obj = value as Record<string, unknown>
  if (Array.isArray(obj.endpoints) || Array.isArray(obj.procedures))
    return obj as IntrospectionResult
  return undefined
}

function unwrapTRPCResponse(json: unknown): unknown {
  if (typeof json === 'object' && json !== null && 'result' in json) {
    const result = (json as { result: unknown }).result
    if (typeof result === 'object' && result !== null && 'data' in result) {
      const data = (result as { data: unknown }).data
      if (typeof data === 'object' && data !== null && 'json' in data)
        return (data as { json: unknown }).json
      return data
    }
  }
  return json
}

function originOf(url: string): string {
  try {
    return new URL(url).origin
  }
  catch {
    return url.replace(TRAILING_SLASHES, '')
  }
}

function stripIntrospectSuffix(url: string): string {
  return url.replace(INTROSPECT_SUFFIX, '')
}
