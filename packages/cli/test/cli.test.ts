import type { IntrospectionResult } from '@api-introspect/core'
import { describe, expect, it } from 'vitest'

import { findEndpoint, formatList } from '../src/cli/format'
import { parseArgs } from '../src/cli/parse'

function intro(procedures: IntrospectionResult['procedures'], name?: string): IntrospectionResult {
  return {
    description: 'Test API',
    serializer: 'json',
    name,
    procedures,
  }
}

describe('parseArgs', () => {
  it('parses list subcommand', () => {
    const args = parseArgs(['list', 'http://localhost:3000'])
    expect(args.subcommand).toBe('list')
    expect(args.url).toBe('http://localhost:3000')
  })

  it('parses info subcommand with --path', () => {
    const args = parseArgs(['info', 'http://localhost:3000', '--path', 'user.getById'])
    expect(args.subcommand).toBe('info')
    expect(args.path).toBe('user.getById')
  })

  it('parses call subcommand with --input', () => {
    const args = parseArgs([
      'call',
      'http://localhost:3000',
      '--path',
      '/users/{id}',
      '--method',
      'GET',
      '--input',
      '{"id":1}',
    ])
    expect(args.subcommand).toBe('call')
    expect(args.path).toBe('/users/{id}')
    expect(args.method).toBe('GET')
    expect(args.input).toBe('{"id":1}')
  })

  it('uppercases the --method value', () => {
    const args = parseArgs(['info', 'http://x', '--path', '/a', '--method', 'post'])
    expect(args.method).toBe('POST')
  })

  it('parses --base-url override', () => {
    const args = parseArgs([
      'call',
      'https://docs.example.com/openapi.json',
      '--path',
      '/pets',
      '--method',
      'GET',
      '--base-url',
      'http://localhost:3002',
    ])
    expect(args.baseUrl).toBe('http://localhost:3002')
  })

  it('parses repeated --header flags', () => {
    const args = parseArgs([
      'list',
      'http://localhost:3000',
      '-H',
      'Authorization:Bearer abc',
      '-H',
      'X-Trace:42',
    ])
    expect(args.headers).toEqual({ 'Authorization': 'Bearer abc', 'X-Trace': '42' })
  })
})

describe('formatList', () => {
  it('lists each procedure with type and path', () => {
    const out = formatList(intro([
      { path: 'user.list', type: 'query' },
      { path: 'user.create', type: 'mutation' },
    ]))
    expect(out).toContain('query     user.list')
    expect(out).toContain('mutation  user.create')
  })

  it('includes description as inline comment', () => {
    const out = formatList(intro([
      { path: 'user.list', type: 'query', description: 'List all users' },
    ]))
    expect(out).toContain('user.list  # List all users')
  })

  it('uses HTTP method label for http endpoints', () => {
    const introspection: IntrospectionResult = {
      description: 'Test',
      serializer: 'json',
      endpoints: [
        { path: '/users', type: 'http', method: 'GET' },
        { path: '/users', type: 'http', method: 'POST' },
        { path: '/users/{id}', type: 'http', method: 'DELETE' },
      ],
    }
    const out = formatList(introspection)
    expect(out).toContain('GET     /users')
    expect(out).toContain('POST    /users')
    expect(out).toContain('DELETE  /users/{id}')
  })

  it('includes API name when present', () => {
    const out = formatList(intro([{ path: 'a', type: 'query' }], 'My API'))
    expect(out.split('\n')[0]).toBe('My API')
  })

  it('handles empty endpoint list', () => {
    const out = formatList(intro([]))
    expect(out).toContain('0 procedures:')
  })
})

describe('findEndpoint', () => {
  const introspection: IntrospectionResult = {
    description: 'Test',
    serializer: 'json',
    endpoints: [
      { path: '/users', type: 'http', method: 'GET' },
      { path: '/users', type: 'http', method: 'POST' },
      { path: '/users/{id}', type: 'http', method: 'DELETE' },
    ],
  }

  it('matches by path when method is unique', () => {
    const { endpoint } = findEndpoint(introspection, '/users/{id}')
    expect(endpoint?.method).toBe('DELETE')
  })

  it('disambiguates by method when path is reused', () => {
    const { endpoint } = findEndpoint(introspection, '/users', 'POST')
    expect(endpoint?.method).toBe('POST')
  })

  it('reports ambiguousMethods when path matches multiple methods and none is given', () => {
    const { endpoint, ambiguousMethods } = findEndpoint(introspection, '/users')
    expect(endpoint).toBeUndefined()
    expect(ambiguousMethods).toEqual(['GET', 'POST'])
  })

  it('returns empty result when not found', () => {
    expect(findEndpoint(introspection, '/missing')).toEqual({})
  })
})
