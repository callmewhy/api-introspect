#!/usr/bin/env node
import process from 'node:process'

import { callProcedure } from '../client'
import { loadSource } from '../source'
import { findEndpoint, formatList } from './format'
import { parseArgs } from './parse'

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const headers = Object.keys(args.headers).length > 0 ? args.headers : undefined

  try {
    const loaded = await loadSource(args.url, { headers })
    const { introspection } = loaded
    const baseUrl = args.baseUrl ?? loaded.baseUrl

    if (args.subcommand === 'list') {
      console.log(formatList(introspection))
      return
    }

    const { endpoint, ambiguousMethods } = findEndpoint(introspection, args.path!, args.method)
    if (ambiguousMethods) {
      console.error(`Multiple endpoints match path "${args.path}". Pass --method <${ambiguousMethods.join('|')}> to disambiguate.`)
      process.exit(1)
    }
    if (!endpoint) {
      const available = (introspection.endpoints ?? introspection.procedures ?? [])
        .map(p => 'method' in p && p.method ? `${p.method} ${p.path}` : p.path)
        .join(', ')
      console.error(`Endpoint not found: ${args.path}${args.method ? ` (${args.method})` : ''}.`)
      if (available)
        console.error(`Available: ${available}`)
      process.exit(1)
    }

    if (args.subcommand === 'info') {
      console.log(JSON.stringify(endpoint, null, 2))
      return
    }

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

    const result = await callProcedure(baseUrl, endpoint.path, {
      input,
      method: 'method' in endpoint ? endpoint.method : args.method,
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
