import { describe, expect, it } from 'vitest'

import type { OpenAPIDocument } from '../src'
import { introspectOpenAPI, openAPIToIntrospection } from '../src'

const baseDoc: OpenAPIDocument = {
  openapi: '3.0.0',
  info: { title: 'Petstore', description: 'Demo API' },
  paths: {},
}

describe('introspectOpenAPI', () => {
  it('extracts a simple GET operation', () => {
    const result = introspectOpenAPI({
      ...baseDoc,
      paths: {
        '/health': {
          get: { summary: 'Health check' },
        },
      },
    })

    expect(result).toEqual([
      {
        path: '/health',
        type: 'http',
        method: 'GET',
        description: 'Health check',
      },
    ])
  })

  it('emits one endpoint per HTTP method on the same path', () => {
    const result = introspectOpenAPI({
      ...baseDoc,
      paths: {
        '/users': {
          get: {},
          post: {},
          delete: {},
        },
      },
    })

    expect(result.map(e => e.method)).toEqual(['GET', 'POST', 'DELETE'])
    expect(result.every(e => e.path === '/users')).toBe(true)
  })

  it('groups parameters by location', () => {
    const result = introspectOpenAPI({
      ...baseDoc,
      paths: {
        '/users/{id}': {
          get: {
            parameters: [
              { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
              { name: 'expand', in: 'query', schema: { type: 'string' } },
            ],
          },
        },
      },
    })

    expect(result[0]?.input).toEqual([
      {
        in: 'path',
        type: 'object',
        properties: { id: { type: 'integer' } },
        required: ['id'],
      },
      {
        in: 'query',
        type: 'object',
        properties: { expand: { type: 'string' } },
      },
    ])
  })

  it('inherits path-level parameters into each operation', () => {
    const result = introspectOpenAPI({
      ...baseDoc,
      paths: {
        '/users/{id}': {
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          ],
          get: {},
          delete: {},
        },
      },
    })

    expect(result).toHaveLength(2)
    for (const endpoint of result) {
      expect(endpoint.input).toEqual([
        { in: 'path', type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] },
      ])
    }
  })

  it('extracts requestBody as input with in: body', () => {
    const result = introspectOpenAPI({
      ...baseDoc,
      paths: {
        '/users': {
          post: {
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { name: { type: 'string' } },
                    required: ['name'],
                  },
                },
              },
            },
          },
        },
      },
    })

    expect(result[0]?.input).toEqual([
      {
        in: 'body',
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
    ])
  })

  it('resolves $ref to components.schemas', () => {
    const result = introspectOpenAPI({
      openapi: '3.0.0',
      info: { title: 'API' },
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: { id: { type: 'integer' } },
            required: ['id'],
          },
        },
      },
      paths: {
        '/users': {
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/User' },
                },
              },
            },
            responses: {
              200: {
                description: 'ok',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
        },
      },
    })

    const endpoint = result[0]!
    expect(endpoint.input?.[0]).toEqual({
      in: 'body',
      type: 'object',
      properties: { id: { type: 'integer' } },
      required: ['id'],
    })
    expect(endpoint.output).toEqual({
      type: 'object',
      properties: { id: { type: 'integer' } },
      required: ['id'],
    })
  })

  it('extracts output from 2xx response', () => {
    const result = introspectOpenAPI({
      ...baseDoc,
      paths: {
        '/users': {
          post: {
            responses: {
              201: {
                description: 'Created',
                content: {
                  'application/json': {
                    schema: { type: 'object', properties: { id: { type: 'integer' } } },
                  },
                },
              },
            },
          },
        },
      },
    })

    expect(result[0]?.output).toEqual({
      type: 'object',
      properties: { id: { type: 'integer' } },
    })
  })

  it('prefers 200 over 201', () => {
    const result = introspectOpenAPI({
      ...baseDoc,
      paths: {
        '/users': {
          post: {
            responses: {
              201: { content: { 'application/json': { schema: { type: 'object', properties: { created: { type: 'boolean' } } } } } },
              200: { content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' } } } } } },
            },
          },
        },
      },
    })

    const props = (result[0]?.output as Record<string, unknown>).properties as Record<string, unknown>
    expect(props).toHaveProperty('ok')
  })

  it('falls back to any 2xx response', () => {
    const result = introspectOpenAPI({
      ...baseDoc,
      paths: {
        '/users': {
          post: {
            responses: {
              299: { content: { 'application/json': { schema: { type: 'object' } } } },
            },
          },
        },
      },
    })

    expect(result[0]?.output).toEqual({ type: 'object' })
  })

  it('compacts schema noise', () => {
    const result = introspectOpenAPI({
      ...baseDoc,
      paths: {
        '/users': {
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { name: { type: 'string' } },
                    additionalProperties: false,
                  },
                },
              },
            },
            responses: {
              200: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: { id: { type: 'integer' } },
                      additionalProperties: false,
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    expect(result[0]?.input?.[0]).not.toHaveProperty('additionalProperties')
    expect(result[0]?.output).not.toHaveProperty('additionalProperties')
  })

  it('uses summary when present, otherwise description', () => {
    const result = introspectOpenAPI({
      ...baseDoc,
      paths: {
        '/a': { get: { summary: 'short', description: 'long' } },
        '/b': { get: { description: 'fallback' } },
      },
    })

    expect(result[0]?.description).toBe('short')
    expect(result[1]?.description).toBe('fallback')
  })

  it('collects operationId, tags, security into meta', () => {
    const result = introspectOpenAPI({
      ...baseDoc,
      paths: {
        '/users': {
          post: {
            operationId: 'createUser',
            tags: ['user'],
            security: [{ bearer: [] }],
          },
        },
      },
    })

    expect(result[0]).toMatchObject({
      operationId: 'createUser',
      tags: ['user'],
      auth: true,
    })
  })

  it('applies include/exclude filters', () => {
    const result = introspectOpenAPI({
      ...baseDoc,
      paths: {
        '/api/users': { get: {} },
        '/api/admin': { get: {} },
        '/health': { get: {} },
      },
    }, { include: ['/api'], exclude: ['/api/admin'] })

    expect(result).toHaveLength(1)
    expect(result[0]?.path).toBe('/api/users')
  })

  it('handles Swagger 2.0 body parameter', () => {
    const result = introspectOpenAPI({
      swagger: '2.0',
      info: { title: 'Old' },
      paths: {
        '/users': {
          post: {
            parameters: [
              {
                name: 'body',
                in: 'body',
                required: true,
                schema: {
                  type: 'object',
                  properties: { name: { type: 'string' } },
                  required: ['name'],
                },
              },
            ],
            responses: {
              200: {
                schema: { type: 'object', properties: { id: { type: 'integer' } } },
              },
            },
          },
        },
      },
    })

    expect(result[0]?.input).toEqual([
      {
        in: 'body',
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
    ])
    expect(result[0]?.output).toEqual({
      type: 'object',
      properties: { id: { type: 'integer' } },
    })
  })

  it('handles Swagger 2.0 inline parameter schema', () => {
    const result = introspectOpenAPI({
      swagger: '2.0',
      info: { title: 'Old' },
      paths: {
        '/users/{id}': {
          get: {
            parameters: [
              { name: 'id', in: 'path', required: true, type: 'integer' },
            ],
          },
        },
      },
    })

    expect(result[0]?.input).toEqual([
      {
        in: 'path',
        type: 'object',
        properties: { id: { type: 'integer' } },
        required: ['id'],
      },
    ])
  })

  it('does not loop on cyclic refs', () => {
    expect(() => introspectOpenAPI({
      openapi: '3.0.0',
      info: { title: 'cyclic' },
      components: {
        schemas: {
          Node: {
            type: 'object',
            properties: { child: { $ref: '#/components/schemas/Node' } },
          },
        },
      },
      paths: {
        '/x': {
          get: {
            responses: {
              200: {
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Node' } } },
              },
            },
          },
        },
      },
    })).not.toThrow()
  })
})

describe('openAPIToIntrospection', () => {
  it('wraps endpoints with name/description/serializer', () => {
    const result = openAPIToIntrospection({
      openapi: '3.0.0',
      info: { title: 'My API', description: 'Demo' },
      paths: { '/health': { get: {} } },
    })

    expect(result.name).toBe('My API')
    expect(result.description).toBe('Demo')
    expect(result.serializer).toBe('json')
    expect(result.endpoints).toHaveLength(1)
  })

  it('falls back to default description when info.description missing', () => {
    const result = openAPIToIntrospection({
      openapi: '3.0.0',
      info: { title: 'My API' },
      paths: {},
    })

    expect(result.description).toContain('My API')
  })
})
