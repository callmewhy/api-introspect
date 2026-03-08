import type { Server } from 'node:http'

import { initTRPC } from '@trpc/server'
import { createHTTPServer } from '@trpc/server/adapters/standalone'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import type { IntrospectionResult } from '../src'
import { withIntrospection } from '../src'

let server: Server
let baseUrl: string

beforeAll(async () => {
  const t = initTRPC.create()

  const appRouter = t.router({
    user: t.router({
      list: t.procedure
        .output(z.array(z.object({ id: z.number(), name: z.string() })))
        .query(() => [{ id: 1, name: 'Alice' }]),

      create: t.procedure
        .input(z.object({ name: z.string() }))
        .mutation(({ input }) => ({ id: 2, name: input.name })),
    }),

    health: t.router({
      check: t.procedure.query(() => ({ status: 'ok' })),
    }),
  })

  const rootRouter = withIntrospection(t, appRouter, {
    meta: { name: 'Test API' },
  })

  server = createHTTPServer({ router: rootRouter }).listen(0)

  const addr = server.address()
  const port = typeof addr === 'object' && addr ? addr.port : 0
  baseUrl = `http://localhost:${port}`
})

afterAll(() => {
  server?.close()
})

describe('e2e', () => {
  it('_introspect returns procedures with serializer and meta', async () => {
    const res = await fetch(`${baseUrl}/_introspect`)
    expect(res.ok).toBe(true)

    const json = await res.json()
    const data = json.result.data as IntrospectionResult

    expect(data.serializer).toBe('json')
    expect(data.name).toBe('Test API')
    expect(data.description).toContain('tRPC API')
    expect(data.pathFilter).toBeUndefined()

    const paths = data.procedures.map(e => e.path)
    expect(paths).toContain('user.list')
    expect(paths).toContain('user.create')
    expect(paths).toContain('health.check')
    expect(paths).not.toContain('_introspect')
  })

  it('_introspect returns correct types for each procedure', async () => {
    const res = await fetch(`${baseUrl}/_introspect`)
    const json = await res.json()
    const data = json.result.data as IntrospectionResult

    const userList = data.procedures.find(e => e.path === 'user.list')
    expect(userList?.type).toBe('query')
    expect(userList?.input).toBeUndefined()
    expect(userList?.output).toBeDefined()
    expect(userList?.output?.type).toBe('array')

    const userCreate = data.procedures.find(e => e.path === 'user.create')
    expect(userCreate?.type).toBe('mutation')
    expect(userCreate?.input).toBeDefined()
    expect(userCreate?.input?.type).toBe('object')
  })

  it('_introspect.user returns only user namespace procedures', async () => {
    const res = await fetch(`${baseUrl}/_introspect.user`)
    expect(res.ok).toBe(true)

    const json = await res.json()
    const data = json.result.data as IntrospectionResult

    expect(data.pathFilter).toBe('user')

    const paths = data.procedures.map(e => e.path)
    expect(paths).toEqual(['user.list', 'user.create'])
    expect(paths).not.toContain('health.check')
  })

  it('can call a query discovered via introspection', async () => {
    const res = await fetch(`${baseUrl}/user.list`)
    expect(res.ok).toBe(true)

    const json = await res.json()
    const users = json.result.data as Array<{ id: number; name: string }>

    expect(users).toEqual([{ id: 1, name: 'Alice' }])
  })

  it('can call a mutation discovered via introspection', async () => {
    const res = await fetch(`${baseUrl}/user.create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bob' }),
    })
    expect(res.ok).toBe(true)

    const json = await res.json()
    const user = json.result.data as { id: number; name: string }

    expect(user.name).toBe('Bob')
  })
})
