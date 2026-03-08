import { initTRPC } from '@trpc/server'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { addIntrospectionEndpoint, createIntrospectionRouter, withIntrospection } from '../src'
import { getResolver, mockProcedure, mockRouter } from './helpers'

function mockT() {
  return {
    procedure: {
      query: (resolver: () => unknown) => ({ _type: 'query', resolver, _def: { resolver } }),
    },
    router: (procedures: Record<string, unknown>) => ({ _def: { procedures } }),
  }
}

describe('createIntrospectionRouter', () => {
  it('creates a router with _introspect and _introspect.skill.md procedures', () => {
    const appRouter = mockRouter({
      'user.list': mockProcedure({
        type: 'query',
        output: z.array(z.string()),
      }),
    })

    const result = createIntrospectionRouter(mockT(), appRouter)

    expect(result._def.procedures).toHaveProperty('_introspect')
    expect(result._def.procedures).toHaveProperty('_introspect.skill.md')

    const endpoints = getResolver(result, '_introspect')() as Array<{ path: string; output?: Record<string, unknown> }>
    expect(endpoints).toHaveLength(1)
    expect(endpoints[0]).toEqual(
      expect.objectContaining({ path: 'user.list', type: 'query' }),
    )
    expect((endpoints[0]?.output?.items as { type: string }).type).toBe('string')

    const skillText = getResolver(result, '_introspect.skill.md')() as string
    expect(skillText).toContain('tRPC API Interaction Skill')
    expect(skillText).toContain('plain JSON')
  })

  it('uses custom path', () => {
    const result = createIntrospectionRouter(mockT(), mockRouter({}), { path: 'schema' })

    expect(result._def.procedures).toHaveProperty('schema')
    expect(result._def.procedures).toHaveProperty('schema.skill.md')
    expect(result._def.procedures).not.toHaveProperty('_introspect')
  })

  it('passes exclude option through', () => {
    const appRouter = mockRouter({
      'admin.stats': mockProcedure({ type: 'query' }),
      'user.list': mockProcedure({ type: 'query' }),
    })

    const result = createIntrospectionRouter(mockT(), appRouter, { exclude: ['admin.'] })

    const endpoints = getResolver(result, '_introspect')() as { path: string }[]
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

    const result = createIntrospectionRouter(mockT(), appRouter)

    expect(inputAccessCount).toBe(1)

    getResolver(result, '_introspect')()
    getResolver(result, '_introspect')()

    expect(inputAccessCount).toBe(1)
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
    const t = {
      ...mockT(),
      mergeRouters: (
        ...routers: Array<{ _def: { procedures: Record<string, unknown> } }>
      ) => ({
        _def: {
          procedures: Object.assign({}, ...routers.map(router => router._def.procedures)),
        },
      }),
    }

    const result = withIntrospection(t, appRouter)

    expect(result._def.procedures).toHaveProperty('user.list')
    expect(result._def.procedures).toHaveProperty('_introspect')
    expect(result._def.procedures).toHaveProperty('_introspect.skill.md')
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
    expect(result._def.procedures).toHaveProperty('_introspect.skill.md')
    expect(endpoints).toHaveLength(1)
    expect(endpoints[0]?.path).toBe('userList')
    expect((endpoints[0]?.output?.items as { type: string }).type).toBe('string')
  })
})
