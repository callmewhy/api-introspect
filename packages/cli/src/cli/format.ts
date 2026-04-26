import type { EndpointInfo, IntrospectionResult } from '@api-introspect/core'

/** Collapsed listing: name + count + one line per endpoint (path, method/type, description). */
export function formatList(introspection: IntrospectionResult): string {
  const items = introspection.endpoints ?? introspection.procedures ?? []
  const noun = introspection.endpoints ? 'endpoints' : 'procedures'
  const lines: string[] = []

  if (introspection.name)
    lines.push(introspection.name)
  lines.push('')
  lines.push(`${items.length} ${noun}:`)
  lines.push('')

  if (items.length === 0)
    return lines.join('\n')

  const maxLabelLen = Math.max(...items.map(p => labelOf(p).length))
  for (const p of items) {
    const desc = p.description ? `  # ${p.description}` : ''
    lines.push(`  ${labelOf(p).padEnd(maxLabelLen)}  ${p.path}${desc}`)
  }

  return lines.join('\n')
}

export interface FindEndpointResult {
  endpoint?: EndpointInfo
  /** When >1 endpoints match `path` and no method was supplied, lists their methods. */
  ambiguousMethods?: string[]
}

/** Find the endpoint matching path (and optional method) in an introspection envelope. */
export function findEndpoint(
  introspection: IntrospectionResult,
  path: string,
  method?: string,
): FindEndpointResult {
  const items = introspection.endpoints ?? introspection.procedures ?? []
  const wantMethod = method?.toUpperCase()
  const matches = items.filter(p => p.path === path)
  if (matches.length === 0)
    return {}

  if (wantMethod) {
    const exact = matches.find(p => 'method' in p && p.method === wantMethod)
    return { endpoint: exact }
  }

  if (matches.length > 1) {
    const methods = matches.map(p => 'method' in p && p.method ? p.method : p.type)
    return { ambiguousMethods: methods }
  }

  return { endpoint: matches[0] }
}

function labelOf(p: EndpointInfo): string {
  return p.type === 'http' ? p.method : p.type
}
