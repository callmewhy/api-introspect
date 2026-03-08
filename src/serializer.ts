import type { Serializer } from './types'

/* eslint-disable ts/no-explicit-any */
export function detectSerializer(config: unknown): Serializer {
  if (!isRecord(config))
    return 'json'

  const transformer = (config as Record<string, any>).transformer
  if (!transformer)
    return 'json'

  const serialize: unknown
    = typeof transformer.serialize === 'function'
      ? transformer.serialize
      : typeof transformer.input?.serialize === 'function'
        ? transformer.input.serialize
        : null

  if (typeof serialize !== 'function')
    return 'json'

  try {
    const sentinel = { _: new Date(0) }
    const result = (serialize as (v: unknown) => unknown)(sentinel)
    if (result === sentinel)
      return 'json'
    if (isRecord(result) && 'json' in result)
      return 'superjson'
    return 'custom'
  }
  catch {
    return 'json'
  }
}
/* eslint-enable ts/no-explicit-any */

export function generateSkillText(serializer: Serializer): string {
  const header = `# tRPC API Interaction Skill

You have access to a tRPC API with an introspection endpoint.

## Step 1: Discover Procedures

Call the introspection query to get all available procedures:

\`\`\`
GET <BASE_URL>/_introspect
\`\`\`

Response is wrapped in \`{"result":{"data":<value>}}\`. Extract \`result.data\` to get a JSON array:

\`\`\`json
[
  {
    "path": "user.create",
    "type": "mutation",
    "description": "Create a new user",
    "input": { "type": "object", "properties": { "name": { "type": "string" } }, "required": ["name"] },
    "output": { "type": "object", "properties": { "id": { "type": "number" } } }
  }
]
\`\`\`

Fields:
- \`path\` - procedure name, used as the URL path
- \`type\` - \`query\` (GET), \`mutation\` (POST), or \`subscription\` (skip, requires WebSocket/SSE)
- \`input\` - JSON Schema for accepted input (undefined = no input required)
- \`output\` - JSON Schema for return value (undefined = untyped)
- \`description\` - human-readable description if set

## Step 2: Call Procedures
`

  const errorSection = `
## Error Handling

\`\`\`json
{"error": {"message": "...", "code": -32004, "data": {"code": "NOT_FOUND", "httpStatus": 404}}}
\`\`\`

Common \`error.data.code\` values: \`BAD_REQUEST\`, \`UNAUTHORIZED\`, \`FORBIDDEN\`, \`NOT_FOUND\`, \`INTERNAL_SERVER_ERROR\`.
If you get \`BAD_REQUEST\`, re-check your input against the JSON Schema.
`

  if (serializer === 'superjson') {
    return `${header}
This API uses **superjson** serialization. Wrap input and unwrap output accordingly.

### Queries (GET)

Wrap input in a superjson envelope and URL-encode it:

\`\`\`
# input = {"json":{"id":1}}
GET <BASE_URL>/user.getById?input=%7B%22json%22%3A%7B%22id%22%3A1%7D%7D
\`\`\`

The \`input\` parameter is \`encodeURIComponent(JSON.stringify({"json": inputObject}))\`.
For simple inputs (no Date/Map/Set/BigInt), omit the \`meta\` field.

No input:
\`\`\`
GET <BASE_URL>/user.list
\`\`\`

### Mutations (POST)

\`\`\`
POST <BASE_URL>/user.create
Content-Type: application/json

{"json":{"name":"Alice","email":"alice@example.com"}}
\`\`\`

### Parsing Responses

Extract value from \`result.data.json\`. If \`result.data.meta\` exists, it maps paths to types:

\`\`\`json
{"result":{"data":{"json":{"id":1,"createdAt":"2024-01-15T00:00:00.000Z"},"meta":{"values":{"createdAt":["Date"]}}}}}
\`\`\`

Type reconstruction:
- \`"Date"\` - value is an ISO string, parse with \`new Date()\`
- \`"BigInt"\` - value is a string, parse with \`BigInt()\`
- \`"Map"\` - value is an array of [key, value] entries
- \`"Set"\` - value is an array of values

### Input Serialization

- For Date inputs, send: \`{"json":{"date":"2024-01-15T00:00:00.000Z"},"meta":{"values":{"date":["Date"]}}}\`
- For simple types (string, number, boolean, null, arrays, objects), just use \`{"json": <value>}\`
${errorSection}`
  }

  if (serializer === 'custom') {
    return `${header}
This API uses a **custom** serializer. The exact wire format depends on the transformer configured on the server.

### General Pattern

- Queries: \`GET <BASE_URL>/<path>\`
- Mutations: \`POST <BASE_URL>/<path>\`
- Responses are wrapped in \`{"result": {"data": ...}}\`

Try sending plain JSON first. If the server rejects it or responses look wrapped, consult the server documentation for the transformer format.
${errorSection}`
  }

  // Default: json
  return `${header}
This API uses **plain JSON** serialization.

### Queries (GET)

No input:
\`\`\`
GET <BASE_URL>/user.list
\`\`\`

With input - pass as URL-encoded JSON in the \`input\` query parameter:
\`\`\`
# input = {"id": 1}
GET <BASE_URL>/user.getById?input=%7B%22id%22%3A1%7D
\`\`\`

The \`input\` parameter is \`encodeURIComponent(JSON.stringify(inputObject))\`.

### Mutations (POST)

\`\`\`
POST <BASE_URL>/user.create
Content-Type: application/json

{"name":"Alice","email":"alice@example.com"}
\`\`\`

### Parsing Responses

Extract value from \`result.data\`:
\`\`\`json
{"result": {"data": {"id": 1, "name": "Alice"}}}
\`\`\`

### Serialization Notes

- All values are plain JSON.
- Fields with \`"format": "date-time"\` accept ISO 8601 strings (e.g. \`"2024-01-15T09:30:00.000Z"\`).
- Optional fields (not in \`required\`) can be omitted.
- Dates from the server arrive as ISO 8601 strings.
${errorSection}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
