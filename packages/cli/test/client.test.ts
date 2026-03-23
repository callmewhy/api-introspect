import type { Server } from 'node:http'

import { TRPCError } from '@trpc/server'
import { createHTTPServer } from '@trpc/server/adapters/standalone'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Context } from '../../../examples/trpc/context'
import { createContext } from '../../../examples/trpc/context'
import { exampleRouter } from '../../../examples/trpc/router'
import { callProcedure, fetchIntrospection } from '../src'

let server: Server
let baseUrl: string

let authServer: Server
let authBaseUrl: string

const AUTH_HEADERS = { Authorization: 'Bearer test-token' }

beforeAll(async () => {
  // Normal server: public queries, protected mutations
  server = createHTTPServer({ router: exampleRouter, createContext }).listen(0)
  const addr = server.address()
  const port = typeof addr === 'object' && addr ? addr.port : 0
  baseUrl = `http://localhost:${port}`

  // Strict auth server: ALL endpoints require auth (simulates server behind auth proxy)
  authServer = createHTTPServer({
    router: exampleRouter,
    createContext: ({ req }): Context => {
      const auth = req.headers.authorization
      if (!auth?.startsWith('Bearer '))
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Missing authorization' })
      return { token: auth.slice(7) }
    },
  }).listen(0)
  const authAddr = authServer.address()
  const authPort = typeof authAddr === 'object' && authAddr ? authAddr.port : 0
  authBaseUrl = `http://localhost:${authPort}`
})

afterAll(() => {
  server?.close()
  authServer?.close()
})

describe('fetchIntrospection', () => {
  it('fetches full introspection from base URL', async () => {
    const result = await fetchIntrospection(baseUrl)

    expect(result.name).toBe('Example API')
    expect(result.serializer).toBe('json')

    const paths = result.procedures.map(p => p.path)
    expect(paths).toContain('user.list')
    expect(paths).toContain('user.create')
    expect(paths).toContain('health.check')
  })

  it('passes custom headers', async () => {
    const result = await fetchIntrospection(baseUrl, { headers: AUTH_HEADERS })
    expect(result.procedures.length).toBeGreaterThan(0)
  })
})

describe('callProcedure', () => {
  it('calls a public query (auto-detects type)', async () => {
    const result = await callProcedure(baseUrl, 'user.list')
    expect(result).toEqual([
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
    ])
  })

  it('calls a query with input', async () => {
    const result = await callProcedure(baseUrl, 'user.getById', {
      input: { id: 1 },
    })
    expect(result).toEqual({ id: 1, name: 'Alice', email: 'alice@example.com' })
  })

  it('calls a protected mutation with auth', async () => {
    const result = await callProcedure(baseUrl, 'user.create', {
      input: { name: 'Charlie', email: 'charlie@example.com' },
      headers: AUTH_HEADERS,
    })
    expect(result).toEqual({ id: 3, name: 'Charlie', email: 'charlie@example.com' })
  })

  it('fails calling a protected mutation without auth', async () => {
    expect(
      callProcedure(baseUrl, 'user.create', {
        input: { name: 'Nobody', email: 'nobody@example.com' },
      }),
    ).rejects.toThrow()
  })

  it('calls with explicit type to skip introspection', async () => {
    const result = await callProcedure(baseUrl, 'health.check', {
      type: 'query',
      transformer: 'json',
    })
    expect(result).toEqual(expect.objectContaining({ status: 'ok' }))
  })

  it('accepts pre-fetched introspection to avoid extra round-trip', async () => {
    const introspection = await fetchIntrospection(baseUrl)
    const result = await callProcedure(baseUrl, 'user.list', { introspection })
    expect(result).toBeInstanceOf(Array)
  })

  it('throws on unknown procedure', async () => {
    expect(
      callProcedure(baseUrl, 'nonexistent'),
    ).rejects.toThrow('Procedure "nonexistent" not found')
  })

  it('supports custom transformer', async () => {
    const result = await callProcedure(baseUrl, 'health.check', {
      type: 'query',
      transformer: {
        serialize: v => v,
        deserialize: v => v,
      },
    })
    expect(result).toEqual(expect.objectContaining({ status: 'ok' }))
  })

  it('forwards headers to introspection request on auth-gated server', async () => {
    const result = await callProcedure(authBaseUrl, 'user.list', {
      headers: AUTH_HEADERS,
    })
    expect(result).toBeInstanceOf(Array)
  })

  it('fails without auth on auth-gated server', async () => {
    expect(
      callProcedure(authBaseUrl, 'user.list'),
    ).rejects.toThrow()
  })

  it('throws on invalid introspection response', async () => {
    expect(
      callProcedure(baseUrl, 'user.list', {
        // @ts-expect-error testing invalid introspection
        introspection: {},
      }),
    ).rejects.toThrow('Invalid introspection response: missing "procedures" field')
  })
})
