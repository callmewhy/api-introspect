import Fastify from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'

import { introspection } from '../src'

describe('introspection plugin', () => {
  let app: ReturnType<typeof Fastify>

  afterEach(async () => {
    await app?.close()
  })

  it('registers introspection endpoint', async () => {
    app = Fastify()
    await app.register(introspection, { meta: { name: 'Test API' } })
    app.get('/test', async () => 'ok')

    const response = await app.inject({ method: 'GET', url: '/_introspect' })
    const body = JSON.parse(response.body)

    expect(response.statusCode).toBe(200)
    expect(body.name).toBe('Test API')
    expect(body.serializer).toBe('json')
    expect(body.endpoints).toHaveLength(1)
    expect(body.endpoints[0].path).toBe('/test')
    expect(body.endpoints[0].type).toBe('http')
    expect(body.endpoints[0].method).toBe('GET')
  })

  it('captures routes registered via plugins', async () => {
    app = Fastify()
    app.register(introspection, { meta: { name: 'Test' } })

    app.register(async (fastify: ReturnType<typeof Fastify>) => {
      fastify.get('/', async () => 'list')
      fastify.post('/', async () => 'create')
    }, { prefix: '/users' })

    const response = await app.inject({ method: 'GET', url: '/_introspect' })
    const body = JSON.parse(response.body)

    expect(body.endpoints).toHaveLength(2)
    expect(body.endpoints[0].path).toBe('/users')
    expect(body.endpoints[0].method).toBe('GET')
    expect(body.endpoints[1].path).toBe('/users')
    expect(body.endpoints[1].method).toBe('POST')
  })

  it('extracts schemas from routes', async () => {
    app = Fastify()
    await app.register(introspection, { meta: { name: 'Test' } })

    app.post('/users', {
      schema: {
        description: 'Create a user',
        body: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
        response: {
          201: {
            type: 'object',
            properties: { id: { type: 'number' }, name: { type: 'string' } },
          },
        },
      },
    }, async () => ({}))

    const response = await app.inject({ method: 'GET', url: '/_introspect' })
    const body = JSON.parse(response.body)

    const proc = body.endpoints[0]
    expect(proc.description).toBe('Create a user')
    expect(proc.body.properties.name.type).toBe('string')
    expect(proc.output.properties.id.type).toBe('number')
  })

  it('skips HEAD routes', async () => {
    app = Fastify()
    await app.register(introspection, { meta: { name: 'Test' } })
    app.get('/test', async () => 'ok')

    const response = await app.inject({ method: 'GET', url: '/_introspect' })
    const body = JSON.parse(response.body)

    const methods = body.endpoints.map((p: { method: string }) => p.method)
    expect(methods).not.toContain('HEAD')
    expect(body.endpoints[0].path).toBe('/test')
    expect(body.endpoints[0].method).toBe('GET')
  })

  it('does not include introspection route itself', async () => {
    app = Fastify()
    await app.register(introspection, { meta: { name: 'Test' } })
    app.get('/test', async () => 'ok')

    const response = await app.inject({ method: 'GET', url: '/_introspect' })
    const body = JSON.parse(response.body)

    const paths = body.endpoints.map((p: { path: string }) => p.path)
    expect(paths).not.toContain('/_introspect')
  })

  it('uses custom path', async () => {
    app = Fastify()
    await app.register(introspection, { meta: { name: 'Test' }, path: '/api/docs' })
    app.get('/test', async () => 'ok')

    const response = await app.inject({ method: 'GET', url: '/api/docs' })
    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.body)
    expect(body.endpoints).toHaveLength(1)
  })

  it('does nothing when disabled', async () => {
    app = Fastify()
    await app.register(introspection, { meta: { name: 'Test' }, enabled: false })
    app.get('/test', async () => 'ok')

    const response = await app.inject({ method: 'GET', url: '/_introspect' })
    expect(response.statusCode).toBe(404)
  })

  it('includes description from meta', async () => {
    app = Fastify()
    await app.register(introspection, { meta: { name: 'Test', description: 'My custom API' } })

    const response = await app.inject({ method: 'GET', url: '/_introspect' })
    const body = JSON.parse(response.body)

    expect(body.description).toBe('My custom API')
  })

  it('applies include filter', async () => {
    app = Fastify()
    await app.register(introspection, { meta: { name: 'Test' }, include: ['/api'] })
    app.get('/api/users', async () => [])
    app.get('/health', async () => 'ok')

    const response = await app.inject({ method: 'GET', url: '/_introspect' })
    const body = JSON.parse(response.body)

    expect(body.endpoints).toHaveLength(1)
    expect(body.endpoints[0].path).toBe('/api/users')
  })

  it('applies exclude filter', async () => {
    app = Fastify()
    await app.register(introspection, { meta: { name: 'Test' }, exclude: ['/health'] })
    app.get('/api/users', async () => [])
    app.get('/health', async () => 'ok')

    const response = await app.inject({ method: 'GET', url: '/_introspect' })
    const body = JSON.parse(response.body)

    expect(body.endpoints).toHaveLength(1)
    expect(body.endpoints[0].path).toBe('/api/users')
  })

  it('extracts meta from route config', async () => {
    app = Fastify()
    await app.register(introspection, { meta: { name: 'Test' } })

    app.post('/users', {
      schema: { description: 'Create a user' },
      config: { meta: { auth: true } },
    }, async () => ({}))

    app.get('/users', async () => [])

    const response = await app.inject({ method: 'GET', url: '/_introspect' })
    const body = JSON.parse(response.body)

    const postRoute = body.endpoints.find((p: { method: string }) => p.method === 'POST')
    const getRoute = body.endpoints.find((p: { method: string }) => p.method === 'GET')

    expect(postRoute.meta).toEqual({ auth: true })
    expect(getRoute).not.toHaveProperty('meta')
  })

  it('ignores non-object meta in route config', async () => {
    app = Fastify()
    await app.register(introspection, { meta: { name: 'Test' } })

    app.post('/users', {
      config: { meta: 'invalid' },
    }, async () => ({}))

    const response = await app.inject({ method: 'GET', url: '/_introspect' })
    const body = JSON.parse(response.body)

    expect(body.endpoints[0]).not.toHaveProperty('meta')
  })

  it('sets custom serializer', async () => {
    app = Fastify()
    await app.register(introspection, { meta: { name: 'Test' }, serializer: 'superjson' })

    const response = await app.inject({ method: 'GET', url: '/_introspect' })
    const body = JSON.parse(response.body)

    expect(body.serializer).toBe('superjson')
  })

  it('includes baseUrl from meta', async () => {
    app = Fastify()
    await app.register(introspection, { meta: { name: 'Test', baseUrl: 'http://localhost:3001' } })

    const response = await app.inject({ method: 'GET', url: '/_introspect' })
    const body = JSON.parse(response.body)

    expect(body.baseUrl).toBe('http://localhost:3001')
  })

  it('includes auth from meta', async () => {
    app = Fastify()
    await app.register(introspection, {
      meta: {
        name: 'Test',
        auth: { type: 'header', name: 'x-api-key', description: 'API key' },
      },
    })

    const response = await app.inject({ method: 'GET', url: '/_introspect' })
    const body = JSON.parse(response.body)

    expect(body.auth).toEqual({ type: 'header', name: 'x-api-key', description: 'API key' })
  })

  it('omits baseUrl and auth when not provided', async () => {
    app = Fastify()
    await app.register(introspection, { meta: { name: 'Test' } })

    const response = await app.inject({ method: 'GET', url: '/_introspect' })
    const body = JSON.parse(response.body)

    expect(body).not.toHaveProperty('baseUrl')
    expect(body).not.toHaveProperty('auth')
  })

  it('does not include introspection route when registered under prefix', async () => {
    app = Fastify()
    app.register(async (fastify) => {
      await fastify.register(introspection, { meta: { name: 'Test' }, path: '/__introspection' })
      fastify.get('/test', async () => 'ok')
    }, { prefix: '/api' })

    const response = await app.inject({ method: 'GET', url: '/api/__introspection' })
    const body = JSON.parse(response.body)

    const paths = body.endpoints.map((p: { path: string }) => p.path)
    expect(paths).not.toContain('/api/__introspection')
    expect(paths).toContain('/api/test')
  })
})
