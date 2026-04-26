import process from 'node:process'

export type Subcommand = 'list' | 'info' | 'call'

export interface ParsedArgs {
  subcommand: Subcommand
  url: string
  path: string | undefined
  method: string | undefined
  input: string | undefined
  headers: Record<string, string>
}

const SUBCOMMANDS: Subcommand[] = ['list', 'info', 'call']

export const HELP = `Usage: api-introspect <command> <url> [options]

Discover and call API endpoints. Supports tRPC, Fastify, and OpenAPI / Swagger specs.

Commands:
  list <url>                                  List all endpoints (path + method + description)
  info <url> --path <p> [--method M]          Show full schema for a single endpoint
  call <url> --path <p> [--method M] [--input <json>]
                                              Call an endpoint

Arguments:
  url    Introspection endpoint, base URL, or OpenAPI/Swagger spec URL.
         The source is auto-detected (introspection envelope vs. OpenAPI document).

Options:
  --path <p>                Endpoint path (tRPC: e.g. user.getById, HTTP: /users/{id})
  --method <M>, -X <M>      HTTP method to disambiguate same-path endpoints
  --input <json>            JSON input for "call"
  --header <key:value>, -H  Custom header (repeatable)
  -h, --help                Show this help message

Examples:
  api-introspect list http://localhost:3000
  api-introspect list https://api.example.com/openapi.json
  api-introspect info http://localhost:3000 --path user.getById
  api-introspect info https://api.example.com/openapi.json --path /users/{id} --method GET
  api-introspect call http://localhost:3000 --path user.create --input '{"name":"Alice"}'
  api-introspect call http://localhost:3000 --path /users/{id} --method DELETE --input '{"id":1}'
`

export function parseArgs(argv: string[]): ParsedArgs {
  if (argv[0] === '-h' || argv[0] === '--help') {
    console.log(HELP)
    process.exit(0)
  }

  const subcommand = argv[0]
  if (!subcommand || !SUBCOMMANDS.includes(subcommand as Subcommand)) {
    console.error(subcommand
      ? `Unknown command: ${subcommand}. Expected one of: ${SUBCOMMANDS.join(', ')}.`
      : 'Missing command.')
    console.error('')
    console.error(HELP)
    process.exit(1)
  }

  const rest = argv.slice(1)
  const result: ParsedArgs = {
    subcommand: subcommand as Subcommand,
    url: '',
    path: undefined,
    method: undefined,
    input: undefined,
    headers: {},
  }

  let urlSeen = false

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]

    if (arg === '-h' || arg === '--help') {
      console.log(HELP)
      process.exit(0)
    }

    if (arg === '--path') {
      result.path = takeValue(rest, ++i, '--path')
      continue
    }

    if (arg === '--method' || arg === '-X') {
      result.method = takeValue(rest, ++i, '--method').toUpperCase()
      continue
    }

    if (arg === '--input') {
      result.input = takeValue(rest, ++i, '--input')
      continue
    }

    if (arg === '--header' || arg === '-H') {
      const value = takeValue(rest, ++i, '--header')
      if (!value.includes(':')) {
        console.error('Header must be in key:value format.')
        process.exit(1)
      }
      const colon = value.indexOf(':')
      result.headers[value.slice(0, colon).trim()] = value.slice(colon + 1).trim()
      continue
    }

    if (arg.startsWith('-')) {
      console.error(`Unknown option: ${arg}`)
      process.exit(1)
    }

    if (!urlSeen) {
      result.url = arg
      urlSeen = true
      continue
    }

    console.error(`Unexpected argument: ${arg}`)
    process.exit(1)
  }

  if (!result.url) {
    console.error(`"${subcommand}" requires a <url> argument.`)
    process.exit(1)
  }

  if ((result.subcommand === 'info' || result.subcommand === 'call') && !result.path) {
    console.error(`"${result.subcommand}" requires --path <endpoint>.`)
    process.exit(1)
  }

  return result
}

function takeValue(argv: string[], index: number, flag: string): string {
  const value = argv[index]
  if (value === undefined) {
    console.error(`${flag} requires a value.`)
    process.exit(1)
  }
  return value
}
