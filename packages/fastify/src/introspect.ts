import type { EndpointInfo, HttpMethod, InputLocation, InputSchema, IntrospectOptions, JSONSchema } from '@api-introspect/core'
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
  meta?: Record<string, unknown>
}

const QUERY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const PARAM_RE = /:(\w+)/g

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
    const meta = route.meta && Object.keys(route.meta).length > 0 ? route.meta : undefined
    const isQuery = QUERY_METHODS.has(method)
    const input = buildInput(
      compactSchema(route.schema?.params as JSONSchema | undefined),
      isQuery ? compactSchema(route.schema?.querystring as JSONSchema | undefined) : undefined,
      !isQuery ? compactSchema(route.schema?.body as JSONSchema | undefined) : undefined,
    )
    const output = compactSchema(extractOutputSchema(route))

    endpoints.push({
      path: route.url.replace(PARAM_RE, '{$1}'),
      type: 'http',
      method: method as HttpMethod,
      ...(description && { description }),
      ...meta,
      ...(input && { input }),
      ...(output && { output }),
    })
  }

  return endpoints
}

function buildInput(
  params: JSONSchema | undefined,
  query: JSONSchema | undefined,
  body: JSONSchema | undefined,
): InputSchema[] | undefined {
  const inputs: InputSchema[] = []
  const sources: [InputLocation, JSONSchema | undefined][] = [
    ['path', params],
    ['query', query],
    ['body', body],
  ]

  for (const [location, schema] of sources) {
    if (schema) {
      inputs.push({ in: location, ...schema })
    }
  }

  return inputs.length > 0 ? inputs : undefined
}
