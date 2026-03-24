import { describe, expect, it } from 'vitest'

import type { RouteInfo } from '../src'
import { introspectRoutes } from '../src'

function route(method: string, url: string, schema?: RouteInfo['schema'], meta?: Record<string, unknown>): RouteInfo {
  return { method, url, schema, ...(meta && { meta }) }
}

describe('introspectRoutes', () => {
  it('extracts GET route as query', () => {
    const routes = [route('GET', '/users')]
    const result = introspectRoutes(routes)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ path: '/users', type: 'http', method: 'GET' })
  })

  it('extracts POST route', () => {
    const routes = [route('POST', '/users')]
    const result = introspectRoutes(routes)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ path: '/users', type: 'http', method: 'POST' })
  })

  it('preserves HTTP method for PUT, PATCH, DELETE', () => {
    const routes = [
      route('PUT', '/users/1'),
      route('PATCH', '/users/1'),
      route('DELETE', '/users/1'),
    ]
    const result = introspectRoutes(routes)

    expect(result).toHaveLength(3)
    for (const r of result) {
      expect(r.type).toBe('http')
    }
    expect(result[0]?.method).toBe('PUT')
    expect(result[1]?.method).toBe('PATCH')
    expect(result[2]?.method).toBe('DELETE')
  })

  it('preserves OPTIONS method', () => {
    const routes = [route('OPTIONS', '/users')]
    const result = introspectRoutes(routes)

    expect(result[0]?.type).toBe('http')
    expect(result[0]?.method).toBe('OPTIONS')
  })

  it('extracts description from schema', () => {
    const routes = [route('GET', '/users', { description: 'List all users' })]
    const result = introspectRoutes(routes)

    expect(result[0]?.description).toBe('List all users')
  })

  it('omits description when not provided', () => {
    const routes = [route('GET', '/users')]
    const result = introspectRoutes(routes)

    expect(result[0]).not.toHaveProperty('description')
  })

  it('extracts meta from route', () => {
    const routes = [route('POST', '/users', { description: 'Create user' }, { auth: true })]
    const result = introspectRoutes(routes)

    expect(result[0]?.meta).toEqual({ auth: true })
  })

  it('omits meta when not provided', () => {
    const routes = [route('GET', '/users')]
    const result = introspectRoutes(routes)

    expect(result[0]).not.toHaveProperty('meta')
  })

  it('omits meta when empty object', () => {
    const routes = [route('GET', '/users', undefined, {})]
    const result = introspectRoutes(routes)

    expect(result[0]).not.toHaveProperty('meta')
  })

  it('extracts body schema as input for POST', () => {
    const routes = [route('POST', '/users', {
      body: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
    })]
    const result = introspectRoutes(routes)

    expect(result[0]?.input).toEqual({
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    })
  })

  it('extracts querystring schema as input for GET', () => {
    const routes = [route('GET', '/users', {
      querystring: {
        type: 'object',
        properties: { page: { type: 'number' } },
      },
    })]
    const result = introspectRoutes(routes)

    expect(result[0]?.input).toEqual({
      type: 'object',
      properties: { page: { type: 'number' } },
    })
  })

  it('extracts params schema as input when no body or querystring', () => {
    const routes = [route('GET', '/users/:id', {
      params: {
        type: 'object',
        properties: { id: { type: 'number' } },
        required: ['id'],
      },
    })]
    const result = introspectRoutes(routes)

    expect(result[0]?.input).toEqual({
      type: 'object',
      properties: { id: { type: 'number' } },
      required: ['id'],
    })
  })

  it('merges params with body for mutation input', () => {
    const routes = [route('PATCH', '/users/:id', {
      params: {
        type: 'object',
        properties: { id: { type: 'number' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: { name: { type: 'string' } },
      },
    })]
    const result = introspectRoutes(routes)

    const input = result[0]?.input as Record<string, unknown>
    expect(input.type).toBe('object')
    const props = input.properties as Record<string, unknown>
    expect(props).toHaveProperty('id')
    expect(props).toHaveProperty('name')
    expect(input.required).toEqual(['id'])
  })

  it('extracts 200 response as output', () => {
    const routes = [route('GET', '/users', {
      response: {
        200: {
          type: 'object',
          properties: { id: { type: 'number' } },
        },
      },
    })]
    const result = introspectRoutes(routes)

    expect(result[0]?.output).toEqual({
      type: 'object',
      properties: { id: { type: 'number' } },
    })
  })

  it('extracts 201 response as output for POST', () => {
    const routes = [route('POST', '/users', {
      response: {
        201: {
          type: 'object',
          properties: { id: { type: 'number' }, name: { type: 'string' } },
        },
      },
    })]
    const result = introspectRoutes(routes)

    expect(result[0]?.output).toEqual({
      type: 'object',
      properties: { id: { type: 'number' }, name: { type: 'string' } },
    })
  })

  it('prefers 200 over 201 when both present', () => {
    const routes = [route('POST', '/users', {
      response: {
        200: { type: 'object', properties: { ok: { type: 'boolean' } } },
        201: { type: 'object', properties: { id: { type: 'number' } } },
      },
    })]
    const result = introspectRoutes(routes)

    const output = result[0]?.output as Record<string, unknown>
    const props = output.properties as Record<string, unknown>
    expect(props).toHaveProperty('ok')
  })

  it('returns undefined output when no response schema', () => {
    const routes = [route('GET', '/health')]
    const result = introspectRoutes(routes)

    expect(result[0]).not.toHaveProperty('output')
  })

  it('returns undefined input when no schema', () => {
    const routes = [route('GET', '/health')]
    const result = introspectRoutes(routes)

    expect(result[0]).not.toHaveProperty('input')
  })

  it('separates method from path', () => {
    const routes = [
      route('GET', '/users'),
      route('POST', '/users'),
    ]
    const result = introspectRoutes(routes)

    expect(result[0]?.path).toBe('/users')
    expect(result[0]?.method).toBe('GET')
    expect(result[1]?.path).toBe('/users')
    expect(result[1]?.method).toBe('POST')
  })

  it('applies include filter on URL path', () => {
    const routes = [
      route('GET', '/users'),
      route('GET', '/admin/stats'),
      route('POST', '/users'),
    ]
    const result = introspectRoutes(routes, { include: ['/users'] })

    expect(result).toHaveLength(2)
    expect(result[0]?.path).toBe('/users')
    expect(result[1]?.path).toBe('/users')
  })

  it('applies exclude filter on URL path', () => {
    const routes = [
      route('GET', '/users'),
      route('GET', '/admin/stats'),
      route('POST', '/users'),
    ]
    const result = introspectRoutes(routes, { exclude: ['/admin'] })

    expect(result).toHaveLength(2)
    expect(result[0]?.path).toBe('/users')
    expect(result[1]?.path).toBe('/users')
  })

  it('applies both include and exclude filters', () => {
    const routes = [
      route('GET', '/api/users'),
      route('POST', '/api/users'),
      route('DELETE', '/api/users/:id'),
      route('GET', '/api/admin'),
    ]
    const result = introspectRoutes(routes, {
      include: ['/api/users'],
      exclude: ['/api/users/:id'],
    })

    expect(result).toHaveLength(2)
    expect(result[0]?.path).toBe('/api/users')
    expect(result[1]?.path).toBe('/api/users')
  })

  it('compacts schemas - removes additionalProperties', () => {
    const routes = [route('POST', '/users', {
      body: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
        additionalProperties: false,
      },
      response: {
        200: {
          type: 'object',
          properties: { id: { type: 'number' } },
          additionalProperties: false,
        },
      },
    })]
    const result = introspectRoutes(routes)

    expect(result[0]?.input).not.toHaveProperty('additionalProperties')
    expect(result[0]?.output).not.toHaveProperty('additionalProperties')
  })

  it('handles routes with empty schema', () => {
    const routes = [route('GET', '/health', {})]
    const result = introspectRoutes(routes)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ path: '/health', type: 'http', method: 'GET' })
  })

  it('normalizes method to uppercase', () => {
    const routes = [route('get', '/users')]
    const result = introspectRoutes(routes)

    expect(result[0]?.path).toBe('/users')
    expect(result[0]?.method).toBe('GET')
  })
})
