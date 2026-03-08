# trpc-introspect

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
import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import { withIntrospection } from 'trpc-introspect'

const t = initTRPC.meta<{ description?: string }>().create()

const p = t.procedure

const userList = p
  .meta({ description: 'List all users' })
  .query(() => [])

const userCreate = p
  .meta({ description: 'Create a new user' })
  .input(z.object({ name: z.string() }))
  .mutation(({ input }) => input)

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
import { introspectRouter } from 'trpc-introspect'

const endpoints = introspectRouter(appRouter)
```

### `createIntrospectionRouter(t, appRouter, options?)`

Creates a tRPC router with an introspection query, ready to merge.

### `withIntrospection(t, appRouter, options?)`

Merges the introspection router into an existing router.

### `addIntrospectionEndpoint(appRouter, options?)`

Builds a compatible `t` instance from the router config and returns a router with `_introspect`
already attached.

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

## Example

```bash
pnpm dev
# Server running on http://localhost:3000
# curl http://localhost:3000/_introspect
```

The introspection payload is precomputed when the router is built, so the endpoint does not
regenerate schemas on every request.

See [example/server.ts](./example/server.ts) for a full example with queries and mutations.

## Development

```bash
pnpm dev       # run the example server in watch mode
pnpm test      # run tests
pnpm build     # build dist
pnpm lint      # lint
```

## Changelog

- 0.3.0: Strongly type `meta` option (`{ name?, description? }` instead of `Record<string, unknown>`). Omit `undefined` fields from endpoint info for cleaner SuperJSON output. Highlight procedure `description` via `.meta()` in docs and example.
- 0.2.0: Add `include` option to filter introspection to specific path prefixes.
- 0.1.0: Initial release with core functionality and example server.

## License

MIT
