# trpc-introspect

Introspection for tRPC routers. Adds a query endpoint that returns all available API procedures with
their types plus input and output schemas as JSON Schema.

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

const t = initTRPC.create()

const appRouter = t.router({
  user: t.router({
    list: t.procedure.query(() => []),
    create: t.procedure
      .input(z.object({name: z.string()}))
      .mutation(({input}) => input),
  }),
})

const rootRouter = withIntrospection(t, appRouter)
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
  "description": "tRPC API with 2 queries, 1 mutations. Encoding: standard JSON. ...",
  "serializer": "json",
  "procedures": [
    {
      "path": "user.list",
      "type": "query"
    },
    {
      "path": "user.create",
      "type": "mutation",
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

- 0.1.0: Initial release with core functionality and example server.

## License

MIT
