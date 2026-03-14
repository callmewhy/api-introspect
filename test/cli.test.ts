import { describe, expect, it } from 'vitest'

import type { EndpointInfo, IntrospectionResult } from '../src/types'
import { formatSummary } from '../src/cli/format'

function makeProcedures(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    path: `ns${Math.floor(i / 3)}.proc${i}`,
    type: i % 2 === 0 ? 'query' as const : 'mutation' as const,
  }))
}

function makeIntrospection(procedureCount: number, name?: string): IntrospectionResult {
  return {
    description: 'Test API',
    serializer: 'json',
    name,
    procedures: makeProcedures(procedureCount),
  }
}

// Mirrors the inline filter logic in cli/index.ts
function filterByPrefixes(procedures: EndpointInfo[], filters: string[]) {
  return procedures.filter(p =>
    filters.some(f => p.path === f || p.path.startsWith(`${f}.`)))
}

const sampleProcedures: EndpointInfo[] = [
  { path: 'user.list', type: 'query' },
  { path: 'user.getById', type: 'query' },
  { path: 'user.create', type: 'mutation' },
  { path: 'post.list', type: 'query' },
  { path: 'post.create', type: 'mutation' },
  { path: 'health.check', type: 'query' },
  { path: 'admin.stats', type: 'query' },
]

describe('multi-filter OR logic', () => {
  it('filters by a single prefix', () => {
    const result = filterByPrefixes(sampleProcedures, ['user'])
    expect(result.map(p => p.path)).toEqual([
      'user.list',
      'user.getById',
      'user.create',
    ])
  })

  it('filters by multiple prefixes (OR logic)', () => {
    const result = filterByPrefixes(sampleProcedures, ['user', 'post'])
    expect(result.map(p => p.path)).toEqual([
      'user.list',
      'user.getById',
      'user.create',
      'post.list',
      'post.create',
    ])
  })

  it('includes exact path matches', () => {
    const result = filterByPrefixes(sampleProcedures, ['health.check'])
    expect(result.map(p => p.path)).toEqual(['health.check'])
  })

  it('combines exact matches and prefix matches', () => {
    const result = filterByPrefixes(sampleProcedures, ['health.check', 'admin'])
    expect(result.map(p => p.path)).toEqual(['health.check', 'admin.stats'])
  })

  it('returns empty array when no match', () => {
    const result = filterByPrefixes(sampleProcedures, ['nonexistent'])
    expect(result).toEqual([])
  })

  it('does not match partial path segments', () => {
    const result = filterByPrefixes(sampleProcedures, ['use'])
    expect(result).toEqual([])
  })

  it('handles empty filters array', () => {
    const result = filterByPrefixes(sampleProcedures, [])
    expect(result).toEqual([])
  })
})

describe('formatSummary', () => {
  it('includes procedure count', () => {
    const introspection = makeIntrospection(15, 'My API')
    const output = formatSummary(introspection)
    expect(output).toContain('15 procedures:')
  })

  it('includes API name when present', () => {
    const introspection = makeIntrospection(3, 'My API')
    const output = formatSummary(introspection)
    expect(output).toContain('My API')
  })

  it('omits API name when not set', () => {
    const introspection = makeIntrospection(3)
    const lines = formatSummary(introspection).split('\n')
    expect(lines[0]).toBe('')
  })

  it('lists each procedure with type and path', () => {
    const introspection: IntrospectionResult = {
      description: 'Test',
      serializer: 'json',
      procedures: [
        { path: 'user.list', type: 'query' },
        { path: 'user.create', type: 'mutation' },
      ],
    }
    const output = formatSummary(introspection)
    expect(output).toContain('query     user.list')
    expect(output).toContain('mutation  user.create')
  })

  it('includes description as inline comment', () => {
    const introspection: IntrospectionResult = {
      description: 'Test',
      serializer: 'json',
      procedures: [
        { path: 'user.list', type: 'query', description: 'List all users' },
      ],
    }
    const output = formatSummary(introspection)
    expect(output).toContain('user.list  # List all users')
  })

  it('shows hint about prefix filtering', () => {
    const introspection = makeIntrospection(3)
    const output = formatSummary(introspection)
    expect(output).toContain('Use a path prefix to see full schemas:')
    expect(output).toContain('<prefix1>,<prefix2>')
  })

  it('aligns type column for mixed procedure types', () => {
    const introspection: IntrospectionResult = {
      description: 'Test',
      serializer: 'json',
      procedures: [
        { path: 'a.short', type: 'query' },
        { path: 'b.medium', type: 'mutation' },
        { path: 'c.long', type: 'subscription' },
      ],
    }
    const output = formatSummary(introspection)
    expect(output).toContain('  query         a.short')
    expect(output).toContain('  mutation      b.medium')
    expect(output).toContain('  subscription  c.long')
  })
})
