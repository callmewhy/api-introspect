import type { IntrospectionResult } from '@api-introspect/core'

export function formatSummary(introspection: IntrospectionResult): string {
  const procedures = introspection.procedures ?? []
  const lines: string[] = []

  if (introspection.name)
    lines.push(introspection.name)
  lines.push('')
  lines.push(`${procedures.length} procedures:`)
  lines.push('')

  const label = (p: { type: string, method?: string }) => p.type === 'http' ? p.method ?? '' : p.type
  const maxLabelLen = Math.max(...procedures.map(p => label(p).length))
  for (const p of procedures) {
    const desc = p.description ? `  # ${p.description}` : ''
    lines.push(`  ${label(p).padEnd(maxLabelLen)}  ${p.path}${desc}`)
  }

  return lines.join('\n')
}
