#!/usr/bin/env node
import process from 'node:process'

import type { IntrospectionResult } from '@api-introspect/core'

import { callProcedure, fetchIntrospection } from '../client'
import { outputIntrospection } from './output'
import { HELP, parseArgs } from './parse'

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!args.baseUrl) {
    console.log(HELP)
    process.exit(1)
  }

  const headers = Object.keys(args.headers).length > 0 ? args.headers : undefined

  try {
    const introspection = await fetchIntrospection(args.baseUrl, { headers })

    if (!args.procedure) {
      outputIntrospection(introspection, args)
      return
    }

    // Multi-filter: comma-separated prefixes with OR logic
    const filters = args.procedure.split(',').map(f => f.trim()).filter(Boolean)

    if (filters.length > 1) {
      const filtered: IntrospectionResult = {
        ...introspection,
        procedures: introspection.procedures.filter(p =>
          filters.some(f => matchesPrefix(p.path, f))),
      }
      if (!filtered.procedures.length) {
        const available = introspection.procedures.map(p => p.path).join(', ')
        console.error(`Error: No procedures match "${args.procedure}". Available: ${available}`)
        process.exit(1)
      }
      outputIntrospection(filtered, args)
      return
    }

    // Single procedure: try exact match first
    const proc = introspection.procedures?.find(p => p.path === args.procedure)
    if (!proc) {
      // Try as prefix filter: server-side first, then client-side fallback
      let filtered: IntrospectionResult | undefined
      try {
        filtered = await fetchIntrospection(args.baseUrl, { filter: args.procedure, headers })
      }
      catch {
        // Server doesn't support prefix filtering (e.g. Fastify) — filter client-side
      }

      if (!filtered?.procedures?.length) {
        filtered = {
          ...introspection,
          procedures: introspection.procedures.filter(p => matchesPrefix(p.path, args.procedure!)),
        }
      }

      if (filtered.procedures?.length) {
        outputIntrospection(filtered, args)
        return
      }
      const available = introspection.procedures?.map(p => p.path).join(', ') ?? '(none)'
      console.error(`Error: Procedure "${args.procedure}" not found. Available: ${available}`)
      process.exit(1)
    }

    // Exact match: call the procedure
    let input: unknown
    if (args.input) {
      try {
        input = JSON.parse(args.input)
      }
      catch {
        console.error(`Invalid JSON input: ${args.input}`)
        process.exit(1)
      }
    }

    const result = await callProcedure(args.baseUrl, args.procedure, {
      input,
      introspection,
      headers,
    })
    console.log(JSON.stringify(result, null, 2))
  }
  catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

/** Match prefix for both tRPC dot paths (`user.getById`) and REST paths (`GET /user/:id`). */
function matchesPrefix(path: string, prefix: string): boolean {
  // tRPC: "user.getById" matches prefix "user"
  if (path === prefix || path.startsWith(`${prefix}.`))
    return true
  // REST: "GET /user/:id" matches prefix "user" (check the URL path portion)
  const spaceIdx = path.indexOf(' ')
  if (spaceIdx !== -1) {
    const urlPath = path.slice(spaceIdx + 1)
    return urlPath === `/${prefix}` || urlPath.startsWith(`/${prefix}/`)
  }
  return false
}

main()
