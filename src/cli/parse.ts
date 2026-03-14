import process from 'node:process'

import type { ParsedArgs } from './types'

const HELP = `Usage: trpc-introspect <base-url> [procedure] [input]

Discover and call tRPC procedures.

IMPORTANT: Always run without [procedure] first to list all available procedures with input schemas. Do not guess procedure names or input shapes -- use the introspection output to determine the correct values.

Arguments:
  base-url    Base URL of the tRPC server (include path prefix if any)
  procedure   Procedure path to call (e.g. user.getById), or a path prefix
              to filter the procedure list (e.g. "user" lists only user.*)
              Supports multiple prefixes with comma (e.g. "user,post")
  input       JSON input (must match the procedure's input schema from introspection)

Options:
  -H, --header <key:value>  Custom header (repeatable)
  -h, --help                Show this help message

Examples:
  trpc-introspect <base-url>                                  List all procedures
  trpc-introspect <base-url> user                             Filter by prefix
  trpc-introspect <base-url> user,post                        Filter by multiple prefixes
  trpc-introspect <base-url> user.getById '{"id":1}'          Call a query
  trpc-introspect <base-url> user.create '{"name":"Alice"}'   Call a mutation`

export { HELP }

export function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    baseUrl: undefined,
    procedure: undefined,
    input: undefined,
    headers: {},
  }

  const positional: string[] = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === '-h' || arg === '--help') {
      console.log(HELP)
      process.exit(0)
    }

    if (arg === '-H' || arg === '--header') {
      const value = argv[++i]
      if (!value || !value.includes(':')) {
        console.error('Header must be in key:value format.')
        process.exit(1)
      }
      const colonIdx = value.indexOf(':')
      result.headers[value.slice(0, colonIdx).trim()] = value.slice(colonIdx + 1).trim()
      continue
    }

    if (arg.startsWith('-')) {
      console.error(`Unknown option: ${arg}`)
      process.exit(1)
    }

    positional.push(arg)
  }

  result.baseUrl = positional[0]
  result.procedure = positional[1]
  result.input = positional[2]

  return result
}
