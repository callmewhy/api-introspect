import { initTRPC } from '@trpc/server'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import type { IntrospectionResult } from '../src'
import { addIntrospectionEndpoint, createIntrospectionRouter, withIntrospection } from '../src'
import { getResolver, mockProcedure, mockRouter, mockT } from './helpers'

describe('createIntrospectionRouter', () => {
  it('creates a router with _introspect procedure', () => {
    const appRouter = mockRouter({
      'user.list': mockProcedure({
        type: 'query',
        output: z.array(z.string()),
      }),
    })

    const result = createIntrospectionRouter(mockT(), appRouter)

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
    const result = createIntrospectionRouter(mockT(), mockRouter({}), { path: 'schema' })

    expect(result._def.procedures).toHaveProperty('schema')
    expect(result._def.procedures).not.toHaveProperty('_introspect')
  })

  it('passes exclude option through', () => {
    const appRouter = mockRouter({
      'admin.stats': mockProcedure({ type: 'query' }),
      'user.list': mockProcedure({ type: 'query' }),
    })

    const result = createIntrospectionRouter(mockT(), appRouter, { exclude: ['admin.'] })

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

    const result = createIntrospectionRouter(mockT(), appRouter)

    expect(inputAccessCount).toBe(1)

    getResolver(result, '_introspect')()
    getResolver(result, '_introspect')()

    expect(inputAccessCount).toBe(1)
  })

  it('creates namespace sub-routes for each top-level namespace', () => {
    const appRouter = mockRouter({
      'user.list': mockProcedure({ type: 'query' }),
      'user.create': mockProcedure({ type: 'mutation' }),
      'health.check': mockProcedure({ type: 'query' }),
    })

    const result = createIntrospectionRouter(mockT(), appRouter)

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

  it('returns an empty router when disabled', () => {
    const appRouter = mockRouter({
      'user.list': mockProcedure({ type: 'query' }),
    })

    const result = createIntrospectionRouter(mockT(), appRouter, { enabled: false })

    expect(result._def.procedures).toEqual({})
  })
})

describe('withIntrospection', () => {
  it('merges the introspection router into the app router', () => {
    const appRouter = mockRouter({
      'user.list': mockProcedure({ type: 'query' }),
    })
    const t = mockT()

    const result = withIntrospection(t, appRouter)

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
    const data = getResolver(result, '_introspect')() as IntrospectionResult

    expect(result._def.procedures).toHaveProperty('_introspect')
    expect(data.serializer).toBe('json')
    expect(data.procedures).toHaveLength(1)
    expect(data.procedures[0]?.path).toBe('userList')
    expect((data.procedures[0]?.output?.items as { type: string }).type).toBe('string')
  })
})
