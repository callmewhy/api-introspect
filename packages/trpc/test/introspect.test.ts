import { initTRPC } from '@trpc/server'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { introspectRouter } from '../src'
import { mockProcedure, mockRouter } from './helpers'

describe('introspectRouter', () => {
  it('extracts query, mutation, and subscription procedures', () => {
    const router = mockRouter({
      'user.list': mockProcedure({ type: 'query' }),
      'user.create': mockProcedure({ type: 'mutation' }),
      'events.stream': mockProcedure({ type: 'subscription' }),
    })

    const result = introspectRouter(router)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({
      path: 'user.list',
      type: 'query',
    })
    expect(result[1]).toEqual({
      path: 'user.create',
      type: 'mutation',
    })
    expect(result[2]).toEqual({
      path: 'events.stream',
      type: 'subscription',
    })
  })

  it('extracts description from meta', () => {
    const router = mockRouter({
      'user.get': mockProcedure({
        type: 'query',
        description: 'Get a user by ID',
      }),
    })

    const result = introspectRouter(router)

    expect(result[0]?.description).toBe('Get a user by ID')
  })

  it('flattens meta fields into endpoint', () => {
    const router = mockRouter({
      'user.create': mockProcedure({
        type: 'mutation',
        description: 'Create a user',
        meta: { auth: true, tags: ['users'] },
      }),
    })

    const result = introspectRouter(router)

    expect(result[0]?.description).toBe('Create a user')
    expect(result[0]).toMatchObject({ auth: true, tags: ['users'] })
  })

  it('does not add extra fields when only description is present', () => {
    const router = mockRouter({
      'user.get': mockProcedure({
        type: 'query',
        description: 'Get a user',
      }),
    })

    const result = introspectRouter(router)

    expect(result[0]).toEqual({ path: 'user.get', type: 'query', description: 'Get a user' })
  })

  it('flattens meta with real tRPC procedures', () => {
    const t = initTRPC.meta<{ description?: string, auth?: boolean }>().create()
    const router = t.router({
      'user.create': t.procedure
        .meta({ description: 'Create user', auth: true })
        .mutation(() => 'ok'),
    })

    const result = introspectRouter(router)

    expect(result[0]?.description).toBe('Create user')
    expect(result[0]).toMatchObject({ auth: true })
  })

  it('converts input schema to JSON schema with in: body', () => {
    const router = mockRouter({
      'user.create': mockProcedure({
        type: 'mutation',
        input: z.object({
          name: z.string(),
          age: z.number(),
        }),
      }),
    })

    const result = introspectRouter(router)
    const input = result[0]?.input

    expect(input).toHaveLength(1)
    expect(input![0].in).toBe('body')
    expect(input![0].type).toBe('object')
    const properties = input![0].properties as Record<string, { type: string }>
    expect(properties.name.type).toBe('string')
    expect(properties.age.type).toBe('number')
  })

  it('combines stacked input parsers from real tRPC procedures', () => {
    const t = initTRPC.create()
    const baseProcedure = t.procedure.input(z.object({ orgId: z.string() }))
    const router = t.router({
      'user.create': baseProcedure
        .input(z.object({ name: z.string() }))
        .mutation(({ input }) => input),
    })

    const result = introspectRouter(router)
    const input = result[0]?.input

    expect(input).toHaveLength(1)
    expect(input![0].in).toBe('body')
    const allOf = input![0].allOf as Array<{
      properties?: Record<string, { type: string }>
    }>
    expect(allOf).toHaveLength(2)
    expect(allOf[0]?.properties?.orgId?.type).toBe('string')
    expect(allOf[1]?.properties?.name?.type).toBe('string')
  })

  it('converts output schema to JSON schema', () => {
    const router = mockRouter({
      'user.create': mockProcedure({
        type: 'mutation',
        output: z.object({
          id: z.number(),
          ok: z.boolean(),
        }),
      }),
    })

    const result = introspectRouter(router)

    expect(result[0]?.output).toBeDefined()
    expect(result[0]?.output?.type).toBe('object')
    const properties = result[0]?.output?.properties as Record<string, { type: string }>
    expect(properties.id.type).toBe('number')
    expect(properties.ok.type).toBe('boolean')
  })

  it('maps date-like schemas to a string payload for JSON schema consumers', () => {
    const router = mockRouter({
      'event.create': mockProcedure({
        type: 'mutation',
        input: z.object({
          date: z.coerce.date(),
        }),
      }),
    })

    const result = introspectRouter(router)
    const input = result[0]?.input

    expect(input).toHaveLength(1)
    const properties = input![0].properties as Record<string, Record<string, unknown>>
    expect(properties.date).toEqual({ type: 'string' })
  })

  it('handles .refine() schemas', () => {
    const router = mockRouter({
      'user.update': mockProcedure({
        type: 'mutation',
        input: z
          .object({
            password: z.string(),
            confirm: z.string(),
          })
          .refine(data => data.password === data.confirm),
      }),
    })

    const result = introspectRouter(router)
    const input = result[0]?.input

    expect(input).toHaveLength(1)
    expect(input![0].in).toBe('body')
    expect(input![0].type).toBe('object')
  })

  it('includes only paths matching include prefixes', () => {
    const router = mockRouter({
      'admin.stats': mockProcedure({ type: 'query' }),
      'chat.send': mockProcedure({ type: 'mutation' }),
      'user.list': mockProcedure({ type: 'query' }),
    })

    const result = introspectRouter(router, {
      include: ['user.'],
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.path).toBe('user.list')
  })

  it('includes multiple prefixes', () => {
    const router = mockRouter({
      'admin.stats': mockProcedure({ type: 'query' }),
      'chat.send': mockProcedure({ type: 'mutation' }),
      'user.list': mockProcedure({ type: 'query' }),
    })

    const result = introspectRouter(router, {
      include: ['user.', 'chat.'],
    })

    expect(result).toHaveLength(2)
    expect(result[0]?.path).toBe('chat.send')
    expect(result[1]?.path).toBe('user.list')
  })

  it('applies both include and exclude filters', () => {
    const router = mockRouter({
      'user.list': mockProcedure({ type: 'query' }),
      'user.create': mockProcedure({ type: 'mutation' }),
      'user.delete': mockProcedure({ type: 'mutation' }),
      'admin.stats': mockProcedure({ type: 'query' }),
    })

    const result = introspectRouter(router, {
      include: ['user.'],
      exclude: ['user.delete'],
    })

    expect(result).toHaveLength(2)
    expect(result[0]?.path).toBe('user.list')
    expect(result[1]?.path).toBe('user.create')
  })

  it('returns nothing when include is empty array', () => {
    const router = mockRouter({
      'user.list': mockProcedure({ type: 'query' }),
    })

    const result = introspectRouter(router, {
      include: [],
    })

    expect(result).toHaveLength(1)
  })

  it('excludes paths matching prefixes', () => {
    const router = mockRouter({
      'admin.stats': mockProcedure({ type: 'query' }),
      'chat.send': mockProcedure({ type: 'mutation' }),
      'user.list': mockProcedure({ type: 'query' }),
    })

    const result = introspectRouter(router, {
      exclude: ['admin.', 'chat.'],
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.path).toBe('user.list')
  })

  it('returns undefined input for procedures with no input', () => {
    const router = mockRouter({
      'health.check': mockProcedure({ type: 'query' }),
    })

    const result = introspectRouter(router)

    expect(result[0]?.input).toBeUndefined()
    expect(result[0]?.output).toBeUndefined()
  })

  it('returns all endpoints when no exclude option is provided', () => {
    const router = mockRouter({
      'admin.stats': mockProcedure({ type: 'query' }),
      'user.list': mockProcedure({ type: 'query' }),
    })

    const result = introspectRouter(router)

    expect(result).toHaveLength(2)
  })
})

describe('introspectRouter always compacts', () => {
  it('removes additionalProperties from output', () => {
    const router = mockRouter({
      'user.create': mockProcedure({
        type: 'mutation',
        input: z.object({
          name: z.string(),
          bio: z.string().optional(),
        }),
      }),
    })

    const [endpoint] = introspectRouter(router)
    const inputEntry = endpoint?.input?.[0]

    expect(inputEntry).not.toHaveProperty('additionalProperties')
    expect(inputEntry).toHaveProperty('type', 'object')
    expect(inputEntry).toHaveProperty('required')
    expect(inputEntry).toHaveProperty('properties')
  })

  it('simplifies nullable fields', () => {
    const router = mockRouter({
      'project.update': mockProcedure({
        type: 'mutation',
        input: z.object({
          id: z.string(),
          name: z.string().nullable(),
        }),
      }),
    })

    const [endpoint] = introspectRouter(router)
    const props = endpoint?.input?.[0]?.properties as Record<string, Record<string, unknown>>

    expect(props.name).toEqual({ type: ['string', 'null'] })
  })

  it('compacts stacked input parsers', () => {
    const t = initTRPC.create()
    const baseProcedure = t.procedure.input(z.object({ orgId: z.string() }))
    const router = t.router({
      'user.create': baseProcedure
        .input(z.object({ name: z.string() }))
        .mutation(({ input }) => input),
    })

    const [endpoint] = introspectRouter(router)
    const allOf = endpoint?.input?.[0]?.allOf as Array<Record<string, unknown>>

    expect(allOf).toHaveLength(2)
    expect(allOf[0]).not.toHaveProperty('additionalProperties')
    expect(allOf[1]).not.toHaveProperty('additionalProperties')
  })

  it('leaves procedures with no input unchanged', () => {
    const router = mockRouter({
      'health.check': mockProcedure({ type: 'query' }),
    })

    const [endpoint] = introspectRouter(router)

    expect(endpoint?.input).toBeUndefined()
    expect(endpoint?.output).toBeUndefined()
  })
})
