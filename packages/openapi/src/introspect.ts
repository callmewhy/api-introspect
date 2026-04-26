import type { EndpointInfo, HttpMethod, InputLocation, InputSchema, IntrospectionResult, IntrospectOptions, JSONSchema } from '@api-introspect/core'
import { compactSchema, isExcludedPath, isIncludedPath } from '@api-introspect/core'

import { createRefResolver } from './refs'
import type { OpenAPIDocument, OpenAPIOperation, OpenAPIParameter, OpenAPIPathItem, OpenAPIResponse } from './types'

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch'] as const
type HttpVerb = typeof HTTP_METHODS[number]

const OUTPUT_STATUS_PREFERENCE = ['200', '201', '202', '204']

const INPUT_LOCATIONS: Record<string, InputLocation> = {
  path: 'path',
  query: 'query',
}

export interface IntrospectOpenAPIOptions extends IntrospectOptions {
  /** Override the introspection name (defaults to `info.title`). */
  name?: string
  /** Override the description (defaults to `info.description`). */
  description?: string
}

export function introspectOpenAPI(
  doc: OpenAPIDocument,
  options: IntrospectOpenAPIOptions = {},
): EndpointInfo[] {
  const includePrefixes = options.include ?? []
  const excludePrefixes = options.exclude ?? []
  const refs = createRefResolver(doc)
  const endpoints: EndpointInfo[] = []

  const paths = doc.paths ?? {}
  for (const [rawPath, rawItem] of Object.entries(paths)) {
    if (!rawItem || typeof rawItem !== 'object')
      continue

    if (includePrefixes.length > 0 && !isIncludedPath(rawPath, includePrefixes))
      continue
    if (isExcludedPath(rawPath, excludePrefixes))
      continue

    const item = refs.resolve(rawItem) as OpenAPIPathItem
    const pathParams = item.parameters ?? []

    for (const verb of HTTP_METHODS) {
      const op = item[verb] as OpenAPIOperation | undefined
      if (!op)
        continue

      endpoints.push(buildEndpoint(rawPath, verb, op, pathParams, refs))
    }
  }

  return endpoints
}

export function openAPIToIntrospection(
  doc: OpenAPIDocument,
  options: IntrospectOpenAPIOptions = {},
): IntrospectionResult {
  const endpoints = introspectOpenAPI(doc, options)
  const title = options.name ?? doc.info?.title
  const description = options.description ?? doc.info?.description ?? defaultDescription(title)

  return {
    ...(title && { name: title }),
    description,
    serializer: 'json',
    endpoints,
  }
}

function defaultDescription(name: string | undefined): string {
  const which = name ?? 'OpenAPI'
  return `${which} (imported from OpenAPI spec). Use "npx api-introspect info <url> --path <endpoint>" to inspect a single endpoint.`
}

function buildEndpoint(
  path: string,
  verb: HttpVerb,
  operation: OpenAPIOperation,
  pathLevelParams: OpenAPIParameter[],
  refs: ReturnType<typeof createRefResolver>,
): EndpointInfo {
  const method = verb.toUpperCase() as HttpMethod
  const description = operation.summary ?? operation.description
  const parameters = mergeParameters(pathLevelParams, operation.parameters ?? [], refs)

  const input = buildInput(parameters, operation, refs)
  const output = compactSchema(extractOutputSchema(operation, refs))
  const meta = collectMeta(operation)

  return {
    path,
    type: 'http',
    method,
    ...(description && { description }),
    ...meta,
    ...(input && { input }),
    ...(output && { output }),
  }
}

function mergeParameters(
  pathLevel: OpenAPIParameter[],
  operationLevel: OpenAPIParameter[],
  refs: ReturnType<typeof createRefResolver>,
): OpenAPIParameter[] {
  const merged: OpenAPIParameter[] = []
  const index = new Map<string, number>()

  for (const param of [...pathLevel, ...operationLevel]) {
    const resolved = refs.resolve(param) as OpenAPIParameter
    if (!resolved?.name || !resolved.in)
      continue
    const key = `${resolved.in}:${resolved.name}`
    if (index.has(key)) {
      merged[index.get(key)!] = resolved
    }
    else {
      index.set(key, merged.length)
      merged.push(resolved)
    }
  }

  return merged
}

function buildInput(
  parameters: OpenAPIParameter[],
  operation: OpenAPIOperation,
  refs: ReturnType<typeof createRefResolver>,
): InputSchema[] | undefined {
  const grouped: Record<InputLocation, { properties: Record<string, JSONSchema>, required: string[] }> = {
    path: { properties: {}, required: [] },
    query: { properties: {}, required: [] },
    body: { properties: {}, required: [] },
  }

  for (const param of parameters) {
    const location = INPUT_LOCATIONS[param.in]
    if (!location)
      continue

    const schema = parameterSchema(param)
    if (!schema)
      continue

    grouped[location].properties[param.name] = schema
    if (param.required)
      grouped[location].required.push(param.name)
  }

  // Swagger 2.0: body parameter
  for (const param of parameters) {
    if (param.in !== 'body' || !param.schema)
      continue
    const resolved = refs.resolveSchema(param.schema)
    const compact = compactSchema(resolved)
    if (compact) {
      grouped.body = mergeIntoBody(grouped.body, compact, param.required ?? false)
    }
  }

  // OpenAPI 3.x: requestBody (application/json)
  const requestBody = operation.requestBody
  if (requestBody) {
    const resolved = refs.resolve(requestBody) as { content?: Record<string, { schema?: JSONSchema }>, required?: boolean } | undefined
    const schema = resolved?.content?.['application/json']?.schema
    if (schema) {
      const compact = compactSchema(schema)
      if (compact) {
        grouped.body = mergeIntoBody(grouped.body, compact, resolved?.required ?? false)
      }
    }
  }

  const inputs: InputSchema[] = []
  const order: InputLocation[] = ['path', 'query', 'body']
  for (const location of order) {
    const group = grouped[location]
    const hasProps = Object.keys(group.properties).length > 0
    if (!hasProps)
      continue
    const compactProps: Record<string, JSONSchema> = {}
    for (const [k, v] of Object.entries(group.properties)) {
      const cleaned = compactSchema(v)
      if (cleaned)
        compactProps[k] = cleaned
    }
    inputs.push({
      in: location,
      type: 'object',
      properties: compactProps,
      ...(group.required.length > 0 && { required: group.required }),
    })
  }

  return inputs.length > 0 ? inputs : undefined
}

function parameterSchema(param: OpenAPIParameter): JSONSchema | undefined {
  if (param.schema && typeof param.schema === 'object')
    return param.schema
  // Swagger 2.0 inlines schema fields on the parameter.
  const inline: JSONSchema = {}
  let hasInline = false
  for (const key of ['type', 'enum', 'minimum', 'maximum', 'minLength', 'maxLength', 'description', 'default', 'items']) {
    if (param[key] !== undefined) {
      inline[key] = param[key]
      hasInline = true
    }
  }
  return hasInline ? inline : undefined
}

function mergeIntoBody(
  group: { properties: Record<string, JSONSchema>, required: string[] },
  schema: JSONSchema,
  isRequired: boolean,
): { properties: Record<string, JSONSchema>, required: string[] } {
  if (schema.type === 'object' && schema.properties && typeof schema.properties === 'object') {
    const properties = { ...group.properties, ...(schema.properties as Record<string, JSONSchema>) }
    const required = mergeRequired(group.required, schema.required)
    return { properties, required }
  }

  // Non-object body: nest under a synthetic key. Rare; mostly to keep tests sane.
  const properties = { ...group.properties, body: schema }
  const required = isRequired ? [...group.required, 'body'] : group.required
  return { properties, required }
}

function mergeRequired(existing: string[], next: unknown): string[] {
  if (!Array.isArray(next))
    return existing
  const seen = new Set(existing)
  const out = [...existing]
  for (const item of next) {
    if (typeof item === 'string' && !seen.has(item)) {
      out.push(item)
      seen.add(item)
    }
  }
  return out
}

function extractOutputSchema(
  operation: OpenAPIOperation,
  refs: ReturnType<typeof createRefResolver>,
): JSONSchema | undefined {
  const responses = operation.responses
  if (!responses || typeof responses !== 'object')
    return undefined

  const candidates = [
    ...OUTPUT_STATUS_PREFERENCE,
    ...Object.keys(responses).filter((s) => {
      const code = Number(s)
      return code >= 200 && code < 300 && !OUTPUT_STATUS_PREFERENCE.includes(s)
    }),
  ]

  for (const status of candidates) {
    const raw = responses[status]
    if (!raw)
      continue
    const resolved = refs.resolve(raw) as OpenAPIResponse | undefined
    if (!resolved)
      continue

    const json = resolved.content?.['application/json']?.schema
    if (json)
      return json
    if (resolved.schema)
      return resolved.schema
  }

  return undefined
}

function collectMeta(operation: OpenAPIOperation): Record<string, unknown> {
  const meta: Record<string, unknown> = {}
  if (operation.operationId)
    meta.operationId = operation.operationId
  if (operation.tags?.length)
    meta.tags = operation.tags
  if (operation.deprecated)
    meta.deprecated = true
  if (operation.security?.length)
    meta.auth = true
  return meta
}
