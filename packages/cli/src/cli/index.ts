#!/usr/bin/env node
import process from 'node:process'

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
      method: args.method,
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
