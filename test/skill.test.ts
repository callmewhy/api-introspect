import type { AnyTRPCRouter } from '@trpc/server'
import { initTRPC } from '@trpc/server'
import { describe, expect, it } from 'vitest'

import type { IntrospectionResult } from '../src'
import { createIntrospectionRouter } from '../src'
import { getResolver } from './helpers'

describe('serializer detection', () => {
  it('defaults to json serializer', () => {
    const t = initTRPC.create()
    const result = createIntrospectionRouter(t, t.router({}))
    const data = getResolver(result, '_introspect')() as IntrospectionResult

    expect(data.serializer).toBe('json')
  })

  it('detects superjson transformer from config', () => {
    const t = initTRPC.create({
      transformer: {
        serialize: (v: unknown) => ({ json: v, meta: {} }),
        deserialize: (v: unknown) => v,
      },
    })
    const appRouter = t.router({}) as AnyTRPCRouter
    const result = createIntrospectionRouter(t, appRouter)
    const data = getResolver(result, '_introspect')() as IntrospectionResult

    expect(data.serializer).toBe('superjson')
  })

  it('describes custom transformers without claiming standard JSON', () => {
    const t = initTRPC.create({
      transformer: {
        serialize: (v: unknown) => [v],
        deserialize: (v: unknown) => v,
      },
    })
    const result = createIntrospectionRouter(t, t.router({}))
    const data = getResolver(result, '_introspect')() as IntrospectionResult

    expect(data.serializer).toBe('custom')
    expect(data.description).toContain('npx trpc-introspect')
    expect(data.description).not.toContain('standard JSON')
    expect(data.description).not.toContain('GET /<path>?input=<url-encoded-json>')
  })

  it('allows manual serializer override', () => {
    const t = initTRPC.create()
    const result = createIntrospectionRouter(t, t.router({}), { serializer: 'superjson' })
    const data = getResolver(result, '_introspect')() as IntrospectionResult

    expect(data.serializer).toBe('superjson')
  })
})

describe('meta fields', () => {
  it('includes user-provided meta in the response', () => {
    const t = initTRPC.create()
    const result = createIntrospectionRouter(t, t.router({}), {
      meta: { name: 'My API' },
    })
    const data = getResolver(result, '_introspect')() as IntrospectionResult

    expect(data.name).toBe('My API')
    expect(data.description).toContain('tRPC API')
    expect(data.serializer).toBe('json')
    expect(data.procedures).toEqual([])
  })

  it('appends meta.description after the generated description', () => {
    const t = initTRPC.create()
    const appRouter = t.router({
      user: t.router({
        list: t.procedure.query(() => ['alice']),
      }),
    })
    const result = createIntrospectionRouter(t, appRouter, {
      meta: {
        description: 'Contact the platform team before using admin procedures.',
      },
    })

    const rootData = getResolver(result, '_introspect')() as IntrospectionResult
    const userData = getResolver(result, '_introspect.user')() as IntrospectionResult

    expect(rootData.description).toContain('tRPC API.')
    expect(rootData.description.endsWith('Contact the platform team before using admin procedures.')).toBe(true)
    expect(userData.description.endsWith('Contact the platform team before using admin procedures.')).toBe(true)
  })

  it('returns only serializer and procedures when no meta provided', () => {
    const t = initTRPC.create()
    const result = createIntrospectionRouter(t, t.router({}))
    const data = getResolver(result, '_introspect')() as IntrospectionResult

    expect(Object.keys(data)).toEqual(['description', 'serializer', 'procedures'])
  })
})
