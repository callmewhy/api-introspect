import process from 'node:process'

import type { ParsedArgs } from './types'

const HELP = `Usage: api-introspect <base-url> [procedure] [input]

Discover and call API procedures.

IMPORTANT: Always run without [procedure] first to list all available procedures with input schemas. Do not guess procedure names or input shapes -- use the introspection output to determine the correct values.

Arguments:
  base-url    Base URL of the server (include path prefix if any)
  procedure   Procedure path to call (e.g. user.getById or /user/:id)
  input       JSON input (must match the procedure's input schema from introspection)

Options:
  -H, --header <key:value>  Custom header (repeatable)
  --summary                 Force summary output format
  --full                    Force full JSON output format
  -h, --help                Show this help message

Examples:
  api-introspect <base-url>                                  List all procedures
  api-introspect <base-url> user.getById '{"id":1}'          Call a query
  api-introspect <base-url> user.create '{"name":"Alice"}'   Call a mutation
  api-introspect <base-url> -H "Authorization:Bearer token123"`

export { HELP }

export function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    baseUrl: undefined,
    procedure: undefined,
    input: undefined,
    headers: {},
    format: undefined,
  }

  const positional: string[] = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === '-h' || arg === '--help') {
      console.log(HELP)
      process.exit(0)
    }

    if (arg === '--summary') {
      result.format = 'summary'
      continue
    }

    if (arg === '--full') {
      result.format = 'full'
      continue
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
