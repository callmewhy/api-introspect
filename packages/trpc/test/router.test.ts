import type { IntrospectionResult } from '@api-introspect/core'
import { initTRPC } from '@trpc/server'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { createIntrospectionRouter, withIntrospection } from '../src'
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
