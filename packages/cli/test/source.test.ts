import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadSource } from '../src/source'

const originalFetch = globalThis.fetch
const COULD_NOT_LOAD = /Could not load introspection/

function mockFetchByUrl(map: Record<string, unknown | { status: number, body?: unknown }>) {
  globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input.toString()
    const entry = map[url]
    if (entry === undefined) {
      return { ok: false, status: 404, statusText: 'Not Found', json: async () => ({}) } as Response
    }
    if (typeof entry === 'object' && entry !== null && 'status' in entry) {
      const e = entry as { status: number, body?: unknown }
      return {
        ok: e.status >= 200 && e.status < 300,
        status: e.status,
        statusText: 'X',
        json: async () => e.body ?? {},
      } as Response
    }
    return { ok: true, status: 200, statusText: 'OK', json: async () => entry } as Response
  }) as unknown as typeof fetch
}

beforeEach(() => {
  globalThis.fetch = originalFetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('loadSource', () => {
  it('detects an introspection envelope at the given URL', async () => {
    mockFetchByUrl({
      'http://api/_introspect': {
        description: 'tRPC',
        serializer: 'json',
        procedures: [{ path: 'user.list', type: 'query' }],
      },
    })

    const result = await loadSource('http://api/_introspect')
    expect(result.kind).toBe('introspect')
    expect(result.baseUrl).toBe('http://api')
    expect(result.introspection.procedures).toHaveLength(1)
  })

  it('unwraps a tRPC result envelope', async () => {
    mockFetchByUrl({
      'http://api/_introspect': {
        result: {
          data: {
            description: 'tRPC',
            serializer: 'json',
            procedures: [{ path: 'health.check', type: 'query' }],
          },
        },
      },
    })

    const result = await loadSource('http://api/_introspect')
    expect(result.introspection.procedures?.[0]?.path).toBe('health.check')
  })

  it('detects an OpenAPI 3.x document', async () => {
    mockFetchByUrl({
      'http://api/openapi.json': {
        openapi: '3.0.0',
        info: { title: 'Petstore' },
        servers: [{ url: 'https://petstore.example.com' }],
        paths: {
          '/pets': { get: { summary: 'List pets' } },
        },
      },
    })

    const result = await loadSource('http://api/openapi.json')
    expect(result.kind).toBe('openapi')
    expect(result.baseUrl).toBe('https://petstore.example.com')
    expect(result.introspection.endpoints?.[0]?.path).toBe('/pets')
  })

  it('detects a Swagger 2.0 document', async () => {
    mockFetchByUrl({
      'http://api/swagger.json': {
        swagger: '2.0',
        info: { title: 'Old' },
        paths: { '/x': { get: {} } },
      },
    })

    const result = await loadSource('http://api/swagger.json')
    expect(result.kind).toBe('openapi')
  })

  it('resolves a relative servers[0].url against the spec URL', async () => {
    mockFetchByUrl({
      'https://api.example.com/docs/openapi.json': {
        openapi: '3.0.0',
        info: { title: 'X' },
        servers: [{ url: '/v2' }],
        paths: {},
      },
    })

    const result = await loadSource('https://api.example.com/docs/openapi.json')
    expect(result.baseUrl).toBe('https://api.example.com/v2')
  })

  it('falls back to URL origin when servers is missing', async () => {
    mockFetchByUrl({
      'https://api.example.com/openapi.json': {
        openapi: '3.0.0',
        info: { title: 'X' },
        paths: {},
      },
    })

    const result = await loadSource('https://api.example.com/openapi.json')
    expect(result.baseUrl).toBe('https://api.example.com')
  })

  it('probes /_introspect when the given URL is a base URL', async () => {
    mockFetchByUrl({
      'http://api': { status: 404 },
      'http://api/_introspect': {
        description: 'fastify',
        serializer: 'json',
        endpoints: [{ path: '/users', type: 'http', method: 'GET' }],
      },
    })

    const result = await loadSource('http://api')
    expect(result.kind).toBe('introspect')
    expect(result.baseUrl).toBe('http://api')
    expect(result.introspection.endpoints?.[0]?.path).toBe('/users')
  })

  it('throws when neither direct fetch nor /_introspect probe yields a recognized payload', async () => {
    mockFetchByUrl({})
    await expect(loadSource('http://nope')).rejects.toThrow(COULD_NOT_LOAD)
  })
})
