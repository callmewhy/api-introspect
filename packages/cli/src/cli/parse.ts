import process from 'node:process'

import type { ParsedArgs } from './types'

const HELP = `Usage: api-introspect <base-url> [endpoint] [input]

Discover and call API endpoints.

IMPORTANT: Always run without [endpoint] first to list all available endpoints with input schemas. Do not guess endpoint names or input shapes -- use the introspection output to determine the correct values.

Arguments:
  base-url    Base URL of the server (include path prefix if any)
  endpoint    Endpoint to call (tRPC procedure e.g. user.getById, or route e.g. /user/:id)
  input       JSON input (must match the endpoint's input schema from introspection)

Options:
  -X, --method <METHOD>     HTTP method for disambiguating endpoints (e.g. POST)
  -H, --header <key:value>  Custom header (repeatable)
  --summary                 Force summary output format
  --full                    Force full JSON output format
  -h, --help                Show this help message

Examples:
  api-introspect <base-url>                                  List all endpoints
  api-introspect <base-url> user.getById '{"id":1}'          Call a tRPC procedure
  api-introspect <base-url> user.create '{"name":"Alice"}'   Call a tRPC mutation
  api-introspect <base-url> -H "Authorization:Bearer token123"
  api-introspect <base-url> -X POST /user '{"name":"Alice"}'   Call an HTTP endpoint`

export { HELP }

export function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    baseUrl: undefined,
    procedure: undefined,
    input: undefined,
    headers: {},
    format: undefined,
    method: undefined,
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

    if (arg === '-X' || arg === '--method') {
      const value = argv[++i]
      if (!value) {
        console.error('Method requires a value.')
        process.exit(1)
      }
      result.method = value.toUpperCase()
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
