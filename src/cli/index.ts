#!/usr/bin/env node
import process from 'node:process'

import { callProcedure, fetchIntrospection } from '../client'
import type { IntrospectionResult } from '../types'
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
      outputIntrospection(introspection)
      return
    }

    // Multi-filter: comma-separated prefixes with OR logic
    const filters = args.procedure.split(',').map(f => f.trim()).filter(Boolean)

    if (filters.length > 1) {
      const filtered: IntrospectionResult = {
        ...introspection,
        procedures: introspection.procedures.filter(p =>
          filters.some(f => p.path === f || p.path.startsWith(`${f}.`))),
      }
      if (!filtered.procedures.length) {
        const available = introspection.procedures.map(p => p.path).join(', ')
        throw new Error(`No procedures match "${args.procedure}". Available: ${available}`)
      }
      outputIntrospection(filtered)
      return
    }

    // Single procedure: try exact match first
    const proc = introspection.procedures?.find(p => p.path === args.procedure)
    if (!proc) {
      // Try as prefix filter
      const filtered = await fetchIntrospection(args.baseUrl, { filter: args.procedure, headers })
      if (filtered.procedures?.length) {
        outputIntrospection(filtered)
        return
      }
      const available = introspection.procedures?.map(p => p.path).join(', ') ?? '(none)'
      throw new Error(`Procedure "${args.procedure}" not found. Available: ${available}`)
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

main()
