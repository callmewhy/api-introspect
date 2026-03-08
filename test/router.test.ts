import { initTRPC } from '@trpc/server'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import type { IntrospectionResult } from '../src'
import { addIntrospectionEndpoint, createIntrospectionRouter, withIntrospection } from '../src'
import { getResolver, mockRouter } from './helpers'

const duplicateIntrospectionPathError = /Duplicate key _introspect/

describe('createIntrospectionRouter', () => {
  it('creates a router with _introspect procedure', () => {
    const t = initTRPC.create()
    const appRouter = t.router({
      user: t.router({
        list: t.procedure
          .output(z.array(z.string()))
          .query(() => ['alice', 'bob']),
      }),
    })

    const result = createIntrospectionRouter(t, appRouter)

    expect(result._def.procedures).toHaveProperty('_introspect')

    const data = getResolver(result, '_introspect')() as IntrospectionResult
    expect(data.serializer).toBe('json')
    expect(data.procedures).toHaveLength(1)
    expect(data.procedures[0]).toEqual(
      expect.objectContaining({ path: 'user.list', type: 'query' }),
    )
    expect((data.procedures[0]?.output?.items as { type: string }).type).toBe('string')
  })

  it('uses custom path', () => {
    const t = initTRPC.create()
    const result = createIntrospectionRouter(t, t.router({}), { path: 'schema' })

    expect(result._def.procedures).toHaveProperty('schema')
    expect(result._def.procedures).not.toHaveProperty('_introspect')
  })

  it('passes exclude option through', () => {
    const t = initTRPC.create()
    const appRouter = t.router({
      admin: t.router({
        stats: t.procedure.query(() => ({ total: 1 })),
      }),
      user: t.router({
        list: t.procedure.query(() => ['alice']),
      }),
    })

    const result = createIntrospectionRouter(t, appRouter, { exclude: ['admin.'] })

    const data = getResolver(result, '_introspect')() as IntrospectionResult
    expect(data.procedures).toHaveLength(1)
    expect(data.procedures[0]?.path).toBe('user.list')
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

    const t = initTRPC.create()
    const result = createIntrospectionRouter(t, appRouter)

    expect(inputAccessCount).toBe(1)

    getResolver(result, '_introspect')()
    getResolver(result, '_introspect')()

    expect(inputAccessCount).toBe(1)
  })

  it('creates namespace sub-routes for each top-level namespace', () => {
    const t = initTRPC.create()
    const appRouter = t.router({
      user: t.router({
        list: t.procedure.query(() => ['alice']),
        create: t.procedure
          .input(z.object({ name: z.string() }))
          .mutation(({ input }) => input),
      }),
      health: t.router({
        check: t.procedure.query(() => ({ status: 'ok' })),
      }),
    })

    const result = createIntrospectionRouter(t, appRouter)

    expect(result._def.procedures).toHaveProperty('_introspect')
    expect(result._def.procedures).toHaveProperty('_introspect.user')
    expect(result._def.procedures).toHaveProperty('_introspect.health')

    const rootData = getResolver(result, '_introspect')() as IntrospectionResult
    expect(rootData.pathFilter).toBeUndefined()
    expect(rootData.procedures).toHaveLength(3)

    const userData = getResolver(result, '_introspect.user')() as IntrospectionResult
    expect(userData.pathFilter).toBe('user')
    expect(userData.procedures).toHaveLength(2)
    expect(userData.procedures.map(p => p.path)).toEqual(['user.list', 'user.create'])

    const healthData = getResolver(result, '_introspect.health')() as IntrospectionResult
    expect(healthData.pathFilter).toBe('health')
    expect(healthData.procedures).toHaveLength(1)
    expect(healthData.procedures[0]?.path).toBe('health.check')
  })

  it('creates multi-level sub-routes for deep path filtering', () => {
    const t = initTRPC.create()
    const appRouter = t.router({
      user: t.router({
        list: t.procedure.query(() => ['alice']),
        create: t.procedure
          .input(z.object({ name: z.string() }))
          .mutation(({ input }) => input),
      }),
      health: t.router({
        check: t.procedure.query(() => ({ status: 'ok' })),
      }),
    })

    const result = createIntrospectionRouter(t, appRouter)

    // Deep path filters should exist
    expect(result._def.procedures).toHaveProperty('_introspect.user.list')
    expect(result._def.procedures).toHaveProperty('_introspect.user.create')
    expect(result._def.procedures).toHaveProperty('_introspect.health.check')

    const userList = getResolver(result, '_introspect.user.list')() as IntrospectionResult
    expect(userList.pathFilter).toBe('user.list')
    expect(userList.procedures).toHaveLength(1)
    expect(userList.procedures[0]?.path).toBe('user.list')

    const userCreate = getResolver(result, '_introspect.user.create')() as IntrospectionResult
    expect(userCreate.pathFilter).toBe('user.create')
    expect(userCreate.procedures).toHaveLength(1)
    expect(userCreate.procedures[0]?.path).toBe('user.create')

    const healthCheck = getResolver(result, '_introspect.health.check')() as IntrospectionResult
    expect(healthCheck.pathFilter).toBe('health.check')
    expect(healthCheck.procedures).toHaveLength(1)
    expect(healthCheck.procedures[0]?.path).toBe('health.check')
  })

  it('includes top-level procedures in their namespace sub-route', () => {
    const t = initTRPC.create()
    const appRouter = t.router({
      userList: t.procedure
        .output(z.array(z.string()))
        .query(() => ['alice', 'bob']),
    })

    const result = createIntrospectionRouter(t, appRouter)

    expect(result._def.procedures).toHaveProperty('_introspect.userList')

    const data = getResolver(result, '_introspect.userList')() as IntrospectionResult
    expect(data.pathFilter).toBe('userList')
    expect(data.procedures).toHaveLength(1)
    expect(data.procedures[0]?.path).toBe('userList')
  })

  it('returns an empty router when disabled', () => {
    const t = initTRPC.create()
    const appRouter = t.router({
      user: t.router({
        list: t.procedure.query(() => ['alice']),
      }),
    })

    const result = createIntrospectionRouter(t, appRouter, { enabled: false })

    expect(result._def.procedures).toEqual({})
  })
})

describe('withIntrospection', () => {
  it('merges the introspection router into the app router', () => {
    const t = initTRPC.create()
    const appRouter = t.router({
      user: t.router({
        list: t.procedure.query(() => ['alice']),
      }),
    })

    const result = withIntrospection(t, appRouter)

    expect(result._def.procedures).toHaveProperty('user.list')
    expect(result._def.procedures).toHaveProperty('_introspect')
  })

  it('surfaces duplicate path errors from real tRPC merges', () => {
    const t = initTRPC.create()
    const appRouter = t.router({
      _introspect: t.procedure.query(() => 'reserved'),
    })

    expect(() => withIntrospection(t, appRouter)).toThrowError(duplicateIntrospectionPathError)
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
    const data = getResolver(result, '_introspect')() as IntrospectionResult

    expect(result._def.procedures).toHaveProperty('_introspect')
    expect(data.serializer).toBe('json')
    expect(data.procedures).toHaveLength(1)
    expect(data.procedures[0]?.path).toBe('userList')
    expect((data.procedures[0]?.output?.items as { type: string }).type).toBe('string')
  })
})
