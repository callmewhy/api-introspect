import { describe, expect, it } from 'vitest'

import type { EndpointInfo, RouteInfo } from '../src'
import { introspectRoutes } from '../src'

type HttpEndpoint = Extract<EndpointInfo, { type: 'http' }>

function route(method: string, url: string, schema?: RouteInfo['schema'], meta?: Record<string, unknown>): RouteInfo {
  return { method, url, schema, ...(meta && { meta }) }
}

describe('introspectRoutes', () => {
  it('extracts GET route', () => {
    const routes = [route('GET', '/users')]
    const result = introspectRoutes(routes)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ path: '/users', type: 'http', method: 'GET' })
  })

  it('extracts POST route', () => {
    const routes = [route('POST', '/users')]
    const result = introspectRoutes(routes)

    expect(result).toEqual([{ path: '/users', type: 'http', method: 'POST' }])
  })

  it('preserves HTTP method for PUT, PATCH, DELETE', () => {
    const routes = [
      route('PUT', '/users/1'),
      route('PATCH', '/users/1'),
      route('DELETE', '/users/1'),
    ]
    const result = introspectRoutes(routes)

    expect(result).toHaveLength(3)
    expect(result[0]?.method).toBe('PUT')
    expect(result[1]?.method).toBe('PATCH')
    expect(result[2]?.method).toBe('DELETE')
  })

  it('extracts description and meta', () => {
    const routes = [route('POST', '/users', { description: 'Create user' }, { auth: true })]
    const result = introspectRoutes(routes)

    expect(result[0]?.description).toBe('Create user')
    expect(result[0]?.meta).toEqual({ auth: true })
  })

  it('omits description and meta when not provided', () => {
    const routes = [route('GET', '/users')]
    const result = introspectRoutes(routes)

    expect(result[0]).not.toHaveProperty('description')
    expect(result[0]).not.toHaveProperty('meta')
  })

  it('extracts body schema for POST', () => {
    const routes = [route('POST', '/users', {
      body: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
    })]
    const result = introspectRoutes(routes)

    expect((result[0] as HttpEndpoint)?.body).toEqual({
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    })
    expect(result[0]).not.toHaveProperty('query')
  })

  it('extracts querystring schema for GET', () => {
    const routes = [route('GET', '/users', {
      querystring: {
        type: 'object',
        properties: { page: { type: 'number' } },
      },
    })]
    const result = introspectRoutes(routes)

    expect((result[0] as HttpEndpoint)?.query).toEqual({
      type: 'object',
      properties: { page: { type: 'number' } },
    })
    expect(result[0]).not.toHaveProperty('body')
  })

  it('extracts params schema separately', () => {
    const routes = [route('GET', '/users/:id', {
      params: {
        type: 'object',
        properties: { id: { type: 'number' } },
        required: ['id'],
      },
    })]
    const result = introspectRoutes(routes)

    expect((result[0] as HttpEndpoint)?.params).toEqual({
      type: 'object',
      properties: { id: { type: 'number' } },
      required: ['id'],
    })
  })

  it('keeps params and body separate for mutation', () => {
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

    expect((result[0] as HttpEndpoint)?.params).toEqual({
      type: 'object',
      properties: { id: { type: 'number' } },
      required: ['id'],
    })
    expect((result[0] as HttpEndpoint)?.body).toEqual({
      type: 'object',
      properties: { name: { type: 'string' } },
    })
  })

  it('extracts output as JSON Schema', () => {
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

  it('compacts all schema fields', () => {
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

    expect((result[0] as HttpEndpoint)?.body).not.toHaveProperty('additionalProperties')
    expect(result[0]?.output).not.toHaveProperty('additionalProperties')
  })

  it('omits all schema fields when no schema', () => {
    const routes = [route('GET', '/health')]
    const result = introspectRoutes(routes)

    expect(result[0]).not.toHaveProperty('params')
    expect(result[0]).not.toHaveProperty('query')
    expect(result[0]).not.toHaveProperty('body')
    expect(result[0]).not.toHaveProperty('output')
  })

  it('applies include and exclude filters', () => {
    const routes = [
      route('GET', '/api/users'),
      route('GET', '/api/admin'),
      route('GET', '/health'),
    ]
    const result = introspectRoutes(routes, { include: ['/api'], exclude: ['/api/admin'] })

    expect(result).toHaveLength(1)
    expect(result[0]?.path).toBe('/api/users')
  })

  it('handles routes with empty schema', () => {
    const routes = [route('GET', '/health', {})]
    const result = introspectRoutes(routes)

    expect(result[0]).toEqual({ path: '/health', type: 'http', method: 'GET' })
  })

  it('normalizes method to uppercase', () => {
    const routes = [route('get', '/users')]
    const result = introspectRoutes(routes)

    expect(result[0]?.method).toBe('GET')
  })
})
