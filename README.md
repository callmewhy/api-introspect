# trpc-introspect

[![npm version](https://img.shields.io/npm/v/trpc-introspect)](https://www.npmjs.com/package/trpc-introspect)
[![CI](https://github.com/callmewhy/trpc-introspect/actions/workflows/ci.yml/badge.svg)](https://github.com/callmewhy/trpc-introspect/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/npm/l/trpc-introspect)](https://github.com/callmewhy/trpc-introspect/blob/main/LICENSE)

Introspection for tRPC routers. Adds a query endpoint that returns all available API procedures with
their types, descriptions, and input/output schemas as JSON Schema. Designed for AI agents to
autonomously discover and learn how to use your API.

## Install

```bash
pnpm add trpc-introspect
```

Peer dependencies: `@trpc/server >= 11`, `zod >= 4`

## Usage

```ts
import {initTRPC} from '@trpc/server'
import {z} from 'zod'
import {withIntrospection} from 'trpc-introspect'

const t = initTRPC.meta<{ description?: string }>().create()

const p = t.procedure

const userList = p
  .meta({description: 'List all users'})
  .query(() => [])

const userCreate = p
  .meta({description: 'Create a new user'})
  .input(z.object({name: z.string()}))
  .mutation(({input}) => input)

const appRouter = t.router({
  user: t.router({
    list: userList,
    create: userCreate,
  }),
})

const rootRouter = withIntrospection(t, appRouter, {
  meta: {
    name: 'My API',
    description: 'User management service.'
  },
  exclude: ['admin.'],
})
```

This adds the root introspection endpoint plus path-prefix filters:

- `_introspect` -- returns metadata plus all procedures with their input/output JSON Schemas
- `_introspect.<prefix>` -- returns the same payload filtered by any dot-separated path prefix
  (for example `_introspect.user` or `_introspect.user.profile`)

If you pass `meta.description`, it is appended after the generated description in every
introspection response.

The `_introspect` query returns:

```json
{
  "name": "My API",
  "description": "User management service. tRPC API with 2 queries, 1 mutations. Encoding: standard JSON.",
  "serializer": "json",
  "procedures": [
    {
      "path": "user.list",
      "type": "query",
      "description": "List all users"
    },
    {
      "path": "user.create",
      "type": "mutation",
      "description": "Create a new user",
      "input": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          }
        },
        "required": [
          "name"
        ]
      }
    }
  ]
}
```

## API

### `introspectRouter(router, options?)`

Low-level function. Extracts endpoint info from a tRPC router directly.

```ts
import {introspectRouter} from 'trpc-introspect'

const endpoints = introspectRouter(appRouter)
```

### `compactSchema(schema)`

Strips noise from a JSON Schema: removes `additionalProperties: false`, simplifies nullable `anyOf` unions to `type: [X, "null"]`, strips verbose date metadata, and removes meaningless `maximum: 9007199254740991`. Applied automatically to introspection output, but also available as a standalone utility.

### `createIntrospectionRouter(t, appRouter, options?)`

Creates a tRPC router with an introspection query, ready to merge.

### `withIntrospection(t, appRouter, options?)`

Merges the introspection router into an existing router.

### Options

| Option       | Type         | Default         | Description                                                                                               |
|--------------|--------------|-----------------|-----------------------------------------------------------------------------------------------------------|
| `enabled`    | `boolean`    | `true`          | Disable the introspection endpoint entirely                                                               |
| `include`    | `string[]`   | `[]`            | Path prefixes to include (only matching paths are returned; empty means include all)                      |
| `exclude`    | `string[]`   | `[]`            | Path prefixes to exclude (e.g. `admin.`)                                                                  |
| `meta`       | `object`     | `undefined`     | Extra metadata to merge into the response; `meta.description` is appended after the generated description |
| `path`       | `string`     | `'_introspect'` | Procedure path for the introspection query                                                                |
| `serializer` | `Serializer` | auto-detected   | Override serializer detection (`'json'`, `'superjson'`, `'custom'`)                                       |

## EndpointInfo

Each endpoint returns:

| Field         | Type                                      | Description                                    |
|---------------|-------------------------------------------|------------------------------------------------|
| `path`        | `string`                                  | Dot-separated procedure path                   |
| `type`        | `'query' \| 'mutation' \| 'subscription'` | Procedure type                                 |
| `description` | `string \| undefined`                     | From procedure meta, if set                    |
| `input`       | `Record<string, unknown> \| undefined`    | JSON Schema of the input, via `z.toJSONSchema` |
| `output`      | `Record<string, unknown> \| undefined`    | JSON Schema of the output, if declared         |

## IntrospectionResult

The root response shape is:

| Field         | Type                                | Description                                                                            |
|---------------|-------------------------------------|----------------------------------------------------------------------------------------|
| `description` | `string`                            | Human-readable calling hints for the router, optionally followed by `meta.description` |
| `serializer`  | `'json' \| 'superjson' \| 'custom'` | Detected or overridden serializer                                                      |
| `pathFilter`  | `string \| undefined`               | Present on prefix-filtered sub-routes                                                  |
| `procedures`  | `EndpointInfo[]`                    | Introspected procedures                                                                |

## CLI

The package includes a CLI for discovering and calling tRPC procedures from the terminal.

```bash
# Install globally
npm install -g trpc-introspect

# List all procedures (always start here)
trpc-introspect <base-url>

# Filter by prefix
trpc-introspect <base-url> user

# Filter by multiple prefixes
trpc-introspect <base-url> user,post

# Call a query
trpc-introspect <base-url> user.getById '{"id":1}'

# Call a mutation
trpc-introspect <base-url> user.create '{"name":"Alice"}'

# Custom headers
trpc-introspect <base-url> -H "Authorization:Bearer token123"

# Force summary or full JSON output
trpc-introspect <base-url> --summary
trpc-introspect <base-url> --full
```

When listing procedures, the CLI auto-selects a summary format for routers with more than 10 procedures. Use `--summary` or `--full` to override.

Always run without a procedure argument first to list all available procedures and their input schemas. Use the introspection output to determine the correct procedure names and input shapes.

## Example

```bash
pnpm dev
# Server running on http://localhost:3000
# curl http://localhost:3000/_introspect
```

The introspection payload is precomputed when the router is built, so the endpoint does not
regenerate schemas on every request.

See [example/server.ts](./example/server.ts) for a full example with queries and mutations.

## Testing

### Unit Tests

```bash
pnpm test      # run all tests
```

### Testing with an AI Agent

Start the example server, then give your AI agent the introspection
endpoint URL and ask it to test everything.

**Prompt:**

> http://localhost:3000/_introspect
>
> Try all endpoints and ensure it's bug free. Test every procedure listed in the introspection
> response, including happy paths, error cases (missing input, invalid types, unauthorized access),
> and all introspection prefix filters.


## Development

```bash
pnpm dev       # run the example server in watch mode
pnpm build     # build dist
pnpm lint      # lint
```

## Changelog

- 0.7.1: Fix TS2742 error for consumers by bundling DTS per entry point (no internal module
  references in declaration files).
- 0.7.0: Add `compactSchema` export that strips noise from JSON Schema output (removes
  `additionalProperties: false`, simplifies nullable `anyOf`, strips verbose date metadata,
  removes meaningless `maximum: 9007199254740991`). Input and output schemas are now
  automatically compacted in introspection responses.
- 0.6.0: Add `--summary` and `--full` CLI flags for output format control. Auto-summary for large
  routers (>10 procedures). Support comma-separated multi-prefix filtering (e.g., `user,post`).
  Refactor CLI internals to modular `src/cli/` directory.
- 0.5.4: CLI prefix filtering (e.g., `trpc-introspect <url> user` lists only `user.*`), procedure
  validation with helpful errors, and fix SuperJSON detection for envelopes without `meta`.
- 0.5.3: Add testing documentation with AI agent testing instructions.
- 0.5.2: Fix `callProcedure` to forward headers to `fetchIntrospection` for authenticated APIs.
  Add validation for invalid introspection responses.
- 0.5.0: Add client module (`trpc-introspect/client`) with `fetchIntrospection` and `callProcedure`
  for calling tRPC procedures from any JS runtime. Add CLI (`trpc-introspect`) for discovering and
  invoking procedures from the terminal.
- 0.4.0: **Breaking:** Remove `addIntrospectionEndpoint` (use `withIntrospection` instead). Fix
  `withIntrospection` return type to preserve the generic router type instead of returning `any`.
- 0.3.0: Strongly type `meta` option (`{ name?, description? }` instead of
  `Record<string, unknown>`). Omit `undefined` fields from endpoint info for cleaner SuperJSON
  output. Highlight procedure `description` via `.meta()` in docs and example.
- 0.2.0: Add `include` option to filter introspection to specific path prefixes.
- 0.1.0: Initial release with core functionality and example server.

## License

MIT
