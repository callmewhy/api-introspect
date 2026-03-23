import type { EndpointInfo, HttpMethod, IntrospectOptions, JSONSchema } from '@api-introspect/core'
import { compactSchema, isExcludedPath, isIncludedPath } from '@api-introspect/core'

export interface RouteInfo {
  method: string
  url: string
  schema?: {
    description?: string
    body?: unknown
    querystring?: unknown
    params?: unknown
    response?: Record<string, unknown>
  }
}

const QUERY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function extractInputSchema(route: RouteInfo): JSONSchema | undefined {
  const schema = route.schema
  if (!schema)
    return undefined

  const isQuery = QUERY_METHODS.has(route.method.toUpperCase())
  const primary = (isQuery ? schema.querystring : schema.body) as JSONSchema | undefined
  const params = schema.params as JSONSchema | undefined

  if (!primary && !params)
    return undefined
  if (!primary)
    return params
  if (!params)
    return primary

  const merged: JSONSchema = { type: 'object', properties: {} }
  const required: string[] = []

  for (const source of [params, primary]) {
    if (source?.properties && typeof source.properties === 'object') {
      Object.assign(merged.properties as Record<string, unknown>, source.properties)
    }
    if (Array.isArray(source?.required)) {
      required.push(...(source.required as string[]))
    }
  }

  if (required.length > 0) {
    merged.required = required
  }

  return merged
}

function extractOutputSchema(route: RouteInfo): JSONSchema | undefined {
  const response = route.schema?.response
  if (!response || typeof response !== 'object')
    return undefined

  for (const status of ['200', '201', '202', '204']) {
    if (response[status] && typeof response[status] === 'object') {
      return response[status] as JSONSchema
    }
  }

  for (const [status, schema] of Object.entries(response)) {
    const code = Number(status)
    if (code >= 200 && code < 300 && typeof schema === 'object') {
      return schema as JSONSchema
    }
  }

  return undefined
}

export function introspectRoutes(
  routes: RouteInfo[],
  options: IntrospectOptions = {},
): EndpointInfo[] {
  const includePrefixes = options.include ?? []
  const excludePrefixes = options.exclude ?? []
  const endpoints: EndpointInfo[] = []

  for (const route of routes) {
    if (includePrefixes.length > 0 && !isIncludedPath(route.url, includePrefixes))
      continue
    if (isExcludedPath(route.url, excludePrefixes))
      continue

    const method = route.method.toUpperCase()
    const description = typeof route.schema?.description === 'string' ? route.schema.description : undefined
    const input = compactSchema(extractInputSchema(route))
    const output = compactSchema(extractOutputSchema(route))

    endpoints.push({
      path: route.url,
      type: 'http',
      method: method as HttpMethod,
      ...(description && { description }),
      ...(input && { input }),
      ...(output && { output }),
    })
  }

  return endpoints
}
