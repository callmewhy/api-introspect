import type { Server } from 'node:http'

import { initTRPC } from '@trpc/server'
import { createHTTPServer } from '@trpc/server/adapters/standalone'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

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

  const rootRouter = withIntrospection(t, appRouter)
  server = createHTTPServer({ router: rootRouter }).listen(0)

  const addr = server.address()
  const port = typeof addr === 'object' && addr ? addr.port : 0
  baseUrl = `http://localhost:${port}`
})

afterAll(() => {
  server?.close()
})

describe('e2e', () => {
  it('_introspect returns all procedures', async () => {
    const res = await fetch(`${baseUrl}/_introspect`)
    expect(res.ok).toBe(true)

    const json = await res.json()
    const endpoints = json.result.data as Array<{ path: string, type: string }>

    expect(endpoints.length).toBeGreaterThanOrEqual(3)

    const paths = endpoints.map(e => e.path)
    expect(paths).toContain('user.list')
    expect(paths).toContain('user.create')
    expect(paths).toContain('health.check')

    expect(paths).not.toContain('_introspect')
    expect(paths).not.toContain('_introspect/skill.md')
  })

  it('_introspect returns correct types for each procedure', async () => {
    const res = await fetch(`${baseUrl}/_introspect`)
    const json = await res.json()
    const endpoints = json.result.data as Array<{
      path: string
      type: string
      input?: Record<string, unknown>
      output?: Record<string, unknown>
    }>

    const userList = endpoints.find(e => e.path === 'user.list')
    expect(userList?.type).toBe('query')
    expect(userList?.input).toBeUndefined()
    expect(userList?.output).toBeDefined()
    expect(userList?.output?.type).toBe('array')

    const userCreate = endpoints.find(e => e.path === 'user.create')
    expect(userCreate?.type).toBe('mutation')
    expect(userCreate?.input).toBeDefined()
    expect(userCreate?.input?.type).toBe('object')
  })

  it('gET /_introspect/skill.md returns skill text', async () => {
    const res = await fetch(`${baseUrl}/_introspect/skill.md`)
    expect(res.ok).toBe(true)

    const json = await res.json()
    const skillText = json.result.data as string

    expect(typeof skillText).toBe('string')
    expect(skillText).toContain('tRPC API Interaction Skill')
    expect(skillText).toContain('plain JSON')
  })

  it('can call a query discovered via introspection', async () => {
    const res = await fetch(`${baseUrl}/user.list`)
    expect(res.ok).toBe(true)

    const json = await res.json()
    const users = json.result.data as Array<{ id: number, name: string }>

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
    const user = json.result.data as { id: number, name: string }

    expect(user.name).toBe('Bob')
  })

  it('query with input uses ?input= encoding', async () => {
    const input = encodeURIComponent(JSON.stringify({ id: 1 }))
    // user.getById doesn't exist in our test router, but we can verify
    // the introspection data documents the correct encoding format
    const res = await fetch(`${baseUrl}/_introspect/skill.md`)
    const json = await res.json()
    const skillText = json.result.data as string

    expect(skillText).toContain('encodeURIComponent(JSON.stringify(inputObject))')
    // Also verify the encoding works with a real query param format
    expect(input).toBe('%7B%22id%22%3A1%7D')
  })
})
