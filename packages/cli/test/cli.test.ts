import type { IntrospectionResult } from '@api-introspect/core'
import { describe, expect, it, vi } from 'vitest'

import { formatSummary } from '../src/cli/format'
import { outputIntrospection, SUMMARY_THRESHOLD } from '../src/cli/output'
import { parseArgs } from '../src/cli/parse'

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

describe('parseArgs --summary / --full', () => {
  it('parses --summary flag', () => {
    const args = parseArgs(['http://localhost:3000', '--summary'])
    expect(args.format).toBe('summary')
    expect(args.baseUrl).toBe('http://localhost:3000')
  })

  it('parses --full flag', () => {
    const args = parseArgs(['http://localhost:3000', '--full'])
    expect(args.format).toBe('full')
  })

  it('defaults format to undefined', () => {
    const args = parseArgs(['http://localhost:3000'])
    expect(args.format).toBeUndefined()
  })

  it('last flag wins when both are provided', () => {
    const args = parseArgs(['http://localhost:3000', '--summary', '--full'])
    expect(args.format).toBe('full')
  })
})

describe('outputIntrospection format override', () => {
  const defaultArgs = parseArgs(['http://localhost:3000'])

  it('uses summary when --summary is set even with few procedures', () => {
    const introspection = makeIntrospection(2)
    const args = parseArgs(['http://localhost:3000', '--summary'])
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    outputIntrospection(introspection, args)
    expect(spy).toHaveBeenCalledOnce()
    expect(spy.mock.calls[0][0]).toContain('2 procedures:')
    spy.mockRestore()
  })

  it('uses full JSON when --full is set even with many procedures', () => {
    const introspection = makeIntrospection(SUMMARY_THRESHOLD + 5)
    const args = parseArgs(['http://localhost:3000', '--full'])
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    outputIntrospection(introspection, args)
    expect(spy).toHaveBeenCalledOnce()
    const output = JSON.parse(spy.mock.calls[0][0])
    expect(output.procedures).toHaveLength(SUMMARY_THRESHOLD + 5)
    spy.mockRestore()
  })

  it('auto-selects summary when count exceeds threshold', () => {
    const introspection = makeIntrospection(SUMMARY_THRESHOLD + 1)
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    outputIntrospection(introspection, defaultArgs)
    expect(spy).toHaveBeenCalledOnce()
    expect(spy.mock.calls[0][0]).toContain('procedures:')
    spy.mockRestore()
  })

  it('auto-selects full JSON when count is within threshold', () => {
    const introspection = makeIntrospection(SUMMARY_THRESHOLD)
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    outputIntrospection(introspection, defaultArgs)
    expect(spy).toHaveBeenCalledOnce()
    const output = JSON.parse(spy.mock.calls[0][0])
    expect(output.procedures).toHaveLength(SUMMARY_THRESHOLD)
    spy.mockRestore()
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

  it('uses method for HTTP endpoints in summary', () => {
    const introspection: IntrospectionResult = {
      description: 'Test',
      serializer: 'json',
      procedures: [
        { path: '/users', type: 'http', method: 'GET' },
        { path: '/users', type: 'http', method: 'POST' },
        { path: '/users/:id', type: 'http', method: 'DELETE' },
      ],
    }
    const output = formatSummary(introspection)
    expect(output).toContain('GET     /users')
    expect(output).toContain('POST    /users')
    expect(output).toContain('DELETE  /users/:id')
  })
})
