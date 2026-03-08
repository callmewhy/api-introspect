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
      description: undefined,
      input: undefined,
      output: undefined,
    })
    expect(result[1]).toEqual({
      path: 'user.create',
      type: 'mutation',
      description: undefined,
      input: undefined,
      output: undefined,
    })
    expect(result[2]).toEqual({
      path: 'events.stream',
      type: 'subscription',
      description: undefined,
      input: undefined,
      output: undefined,
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

  it('converts input schema to JSON schema', () => {
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

    expect(result[0]?.input).toBeDefined()
    expect(result[0]?.input?.type).toBe('object')
    const properties = result[0]?.input?.properties as Record<string, { type: string }>
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
    const input = result[0]?.input as {
      allOf: Array<{
        properties?: Record<string, { type: string }>
      }>
    }

    expect(input.allOf).toHaveLength(2)
    expect(input.allOf[0]?.properties?.orgId?.type).toBe('string')
    expect(input.allOf[1]?.properties?.name?.type).toBe('string')
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

    expect(result[0]?.input).toBeDefined()
    const properties = result[0]?.input?.properties as Record<string, Record<string, unknown>>
    expect(properties.date).toMatchObject({
      type: 'string',
      format: 'date-time',
      deprecated: true,
    })
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

    expect(result[0]?.input).toBeDefined()
    expect(result[0]?.input?.type).toBe('object')
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
