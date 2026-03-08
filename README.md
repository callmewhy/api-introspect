# trpc-introspect

Introspection for tRPC routers. Adds a query endpoint that returns all available API procedures with
their types and input schemas (as JSON Schema).

## Install

```bash
pnpm add @repo/trpc-introspect
```

Peer dependencies: `zod >= 4`

## Usage

```ts
import {initTRPC} from '@trpc/server'
import {createIntrospectionRouter} from '@repo/trpc-introspect'

const t = initTRPC.create()

const appRouter = t.router({
  user: t.router({
    list: t.procedure.query(() => []),
    create: t.procedure
      .input(z.object({name: z.string()}))
      .mutation(({input}) => input),
  }),
})

const rootRouter = t.mergeRouters(
  appRouter,
  createIntrospectionRouter(t, appRouter),
)
```

This adds a `_introspect` query that returns:

```json
[
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
```

## API

### `introspectRouter(router, options?)`

Low-level function. Extracts endpoint info from a tRPC router directly.

```ts
import {introspectRouter} from '@repo/trpc-introspect'

const endpoints = introspectRouter(appRouter)
```

### `createIntrospectionRouter(t, appRouter, options?)`

Creates a tRPC router with an introspection query, ready to merge.

### Options

| Option    | Type       | Default         | Description                                |
|-----------|------------|-----------------|--------------------------------------------|
| `exclude` | `string[]` | `[]`            | Path prefixes to exclude (e.g. `admin.`)   |
| `path`    | `string`   | `'_introspect'` | Procedure path for the introspection query |

## EndpointInfo

Each endpoint returns:

| Field         | Type                                   | Description                                    |
|---------------|----------------------------------------|------------------------------------------------|
| `path`        | `string`                               | Dot-separated procedure path                   |
| `type`        | `'query' \| 'mutation'`                | Procedure type                                 |
| `description` | `string \| undefined`                  | From procedure meta, if set                    |
| `input`       | `Record<string, unknown> \| undefined` | JSON Schema of the input, via `z.toJSONSchema` |

## Example

```bash
pnpm example
# Server running on http://localhost:3000
# curl http://localhost:3000/_introspect
```

See [example/server.ts](./example/server.ts) for a full example with queries and mutations.

## Development

```bash
pnpm test      # run tests
pnpm build     # build dist
pnpm lint      # lint
```

## License

MIT
