import { initTRPC } from '@trpc/server'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  addIntrospectionEndpoint,
  createIntrospectionRouter,
  introspectRouter,
  withIntrospection,
} from '../src'

function mockRouter(procedures: Record<string, unknown>) {
  return { _def: { procedures, _config: {} } }
}

function mockProcedure(opts: {
  type: 'query' | 'mutation' | 'subscription'
  input?: z.ZodType
  output?: z.ZodType
  description?: string
}) {
  return {
    _def: {
      type: opts.type,
      inputs: opts.input ? [opts.input] : [],
      output: opts.output,
      meta: opts.description ? { description: opts.description } : undefined,
    },
  }
}

function getResolver(
  router: { _def: { procedures: Record<string, unknown> } },
  path: string,
) {
  return (
    router._def.procedures[path] as {
      _def: { resolver: () => unknown }
    }
  )._def.resolver
}

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

describe('createIntrospectionRouter', () => {
  it('creates a router with _introspect procedure by default', () => {
    const appRouter = mockRouter({
      'user.list': mockProcedure({
        type: 'query',
        output: z.array(z.string()),
      }),
    })

    let capturedResolver: (() => unknown) | undefined
    const mockT = {
      procedure: {
        query: (resolver: () => unknown) => {
          capturedResolver = resolver
          return { _type: 'query', resolver }
        },
      },
      router: (procedures: Record<string, unknown>) => ({ _def: { procedures } }),
    }

    const result = createIntrospectionRouter(mockT, appRouter)

    expect(result._def.procedures).toHaveProperty('_introspect')
    expect(capturedResolver).toBeDefined()

    const endpoints = capturedResolver!() as Array<{ path: string; output?: Record<string, unknown> }>
    expect(endpoints).toHaveLength(1)
    expect(endpoints[0]).toEqual(
      expect.objectContaining({ path: 'user.list', type: 'query' }),
    )
    expect((endpoints[0]?.output?.items as { type: string }).type).toBe('string')
  })

  it('uses custom path', () => {
    const appRouter = mockRouter({})
    const mockT = {
      procedure: { query: (r: () => unknown) => ({ _type: 'query', resolver: r }) },
      router: (procedures: Record<string, unknown>) => ({ _def: { procedures } }),
    }

    const result = createIntrospectionRouter(mockT, appRouter, { path: 'schema' })

    expect(result._def.procedures).toHaveProperty('schema')
    expect(result._def.procedures).not.toHaveProperty('_introspect')
  })

  it('passes exclude option through', () => {
    const appRouter = mockRouter({
      'admin.stats': mockProcedure({ type: 'query' }),
      'user.list': mockProcedure({ type: 'query' }),
    })

    let capturedResolver: (() => unknown) | undefined
    const mockT = {
      procedure: {
        query: (resolver: () => unknown) => {
          capturedResolver = resolver
          return { _type: 'query', resolver }
        },
      },
      router: (procedures: Record<string, unknown>) => ({ _def: { procedures } }),
    }

    createIntrospectionRouter(mockT, appRouter, { exclude: ['admin.'] })

    const endpoints = capturedResolver!() as { path: string }[]
    expect(endpoints).toHaveLength(1)
    expect(endpoints[0]?.path).toBe('user.list')
  })

  it('precomputes the introspection payload once during router creation', () => {
    let inputAccessCount = 0
    const appRouter = mockRouter({
      'user.create': {
        _def: {
          type: 'mutation',
          get inputs() {
            inputAccessCount += 1
            return [z.object({ name: z.string() })]
          },
        },
      },
    })

    let capturedResolver: (() => unknown) | undefined
    const mockT = {
      procedure: {
        query: (resolver: () => unknown) => {
          capturedResolver = resolver
          return { _type: 'query', resolver }
        },
      },
      router: (procedures: Record<string, unknown>) => ({ _def: { procedures } }),
    }

    createIntrospectionRouter(mockT, appRouter)

    expect(inputAccessCount).toBe(1)

    capturedResolver!()
    capturedResolver!()

    expect(inputAccessCount).toBe(1)
  })

  it('returns an empty router when disabled', () => {
    const appRouter = mockRouter({
      'user.list': mockProcedure({ type: 'query' }),
    })
    const mockT = {
      procedure: { query: (resolver: () => unknown) => ({ _type: 'query', resolver }) },
      router: (procedures: Record<string, unknown>) => ({ _def: { procedures } }),
    }

    const result = createIntrospectionRouter(mockT, appRouter, { enabled: false })

    expect(result._def.procedures).toEqual({})
  })
})

describe('withIntrospection', () => {
  it('merges the introspection router into the app router', () => {
    const appRouter = mockRouter({
      'user.list': mockProcedure({ type: 'query' }),
    })
    const mockT = {
      procedure: {
        query: (resolver: () => unknown) => ({ _def: { resolver } }),
      },
      router: (procedures: Record<string, unknown>) => ({ _def: { procedures } }),
      mergeRouters: (
        ...routers: Array<{ _def: { procedures: Record<string, unknown> } }>
      ) => ({
        _def: {
          procedures: Object.assign({}, ...routers.map(router => router._def.procedures)),
        },
      }),
    }

    const result = withIntrospection(mockT, appRouter)

    expect(result._def.procedures).toHaveProperty('user.list')
    expect(result._def.procedures).toHaveProperty('_introspect')
  })
})

describe('addIntrospectionEndpoint', () => {
  it('adds an introspection endpoint without introspecting itself', () => {
    const t = initTRPC.create()
    const appRouter = t.router({
      userList: t.procedure
        .output(z.array(z.string()))
        .query(() => ['alice', 'bob']),
    })

    const result = addIntrospectionEndpoint(appRouter)
    const endpoints = getResolver(result, '_introspect')() as Array<{
      path: string
      output?: Record<string, unknown>
    }>

    expect(result._def.procedures).toHaveProperty('_introspect')
    expect(endpoints).toHaveLength(1)
    expect(endpoints[0]?.path).toBe('userList')
    expect((endpoints[0]?.output?.items as { type: string }).type).toBe('string')
  })
})
