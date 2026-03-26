# api-introspect

[![CI](https://github.com/callmewhy/api-introspect/actions/workflows/ci.yml/badge.svg)](https://github.com/callmewhy/api-introspect/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/npm/l/api-introspect)](https://github.com/callmewhy/api-introspect/blob/main/LICENSE)

API introspection SDK. Adds endpoints that return all available API procedures with their types, descriptions, and input/output schemas as JSON Schema. Designed for AI agents to autonomously discover and learn how to use your API.

## Packages

| Package                                         | Description                            |
|-------------------------------------------------|----------------------------------------|
| [`@api-introspect/core`](./packages/core)       | Framework-agnostic types and utilities |
| [`@api-introspect/trpc`](./packages/trpc)       | tRPC router introspection              |
| [`@api-introspect/fastify`](./packages/fastify) | Fastify route introspection            |
| [`api-introspect`](./packages/cli)              | CLI and HTTP client                    |

## Quick Start

### tRPC

```bash
pnpm add @api-introspect/trpc
```

```ts
import {withIntrospection} from '@api-introspect/trpc'

const rootRouter = withIntrospection(t, appRouter, {
  meta: {name: 'My API'},
})
```

### Fastify

```bash
pnpm add @api-introspect/fastify
```

```ts
import {introspection} from '@api-introspect/fastify'

await app.register(introspection, {
  meta: {name: 'My API'},
})
```

### Discover

```bash
# List all procedures
npx api-introspect http://localhost:3000

# Call a procedure
npx api-introspect http://localhost:3000 user.getById '{"id":1}'
```

The introspection endpoint returns:

```json
{
  "name": "My API",
  "baseUrl": "http://localhost:3000",
  "description": "tRPC API...",
  "auth": {
    "type": "header",
    "name": "x-api-key"
  },
  "serializer": "json",
  "endpoints": [
    {
      "path": "user.list",
      "type": "query",
      "description": "List all users"
    },
    {
      "path": "user.create",
      "type": "mutation",
      "description": "Create a new user",
      "meta": {
        "auth": true
      },
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
    },
    {
      "path": "/users/:id",
      "type": "http",
      "method": "PATCH",
      "params": {
        "type": "object",
        "properties": {
          "id": {
            "type": "number"
          }
        },
        "required": [
          "id"
        ]
      },
      "body": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          }
        }
      }
    }
  ]
}
```

## Examples

```bash
pnpm dev:trpc      # tRPC server on http://localhost:3000
pnpm dev:fastify   # Fastify server on http://localhost:3001
```

- [examples/trpc](./examples/trpc) - tRPC server with queries, mutations, and auth middleware
- [examples/fastify](./examples/fastify) - Fastify HTTP server with TypeBox schemas

## Development

```bash
pnpm dev:trpc    # run tRPC example in watch mode
pnpm dev:fastify # run Fastify example in watch mode
pnpm build       # build all packages
pnpm test        # run all tests
pnpm lint:fix    # lint
```

## Changelog

- 0.11.0: Fastify plugin now returns `endpoints` instead of
  `procedures` in the introspection payload. Add `baseUrl` and `auth` to the
  `meta` option for both tRPC and Fastify plugins, included in the introspection response when provided. CLI client supports both
  `endpoints` and
  `procedures` fields for backward compatibility. Fix default introspection path and URL joining with leading slashes. Fastify plugin uses config marker for self-exclusion, fixing edge cases when registered under a prefix.
- 0.10.0: Fastify introspection now returns separate `params`, `query`, and
  `body` fields instead of a merged `input` field, matching HTTP semantics more precisely.
  `compactSchema` now strips additional noise keys (`pattern`, `format`, `title`, `default`,
  `examples`, `$id`) and simplifies `anyOf` with `const` values into `enum`. Core
  `EndpointInfo` type updated: `HttpEndpointInfo` uses `params`/`query`/`body`,
  `RpcEndpointInfo` retains `input`.
- 0.9.0: Add `meta` field support to route and procedure introspection. Custom metadata (e.g.
  `auth`, `tags`) from tRPC `.meta()` and Fastify route `config.meta`
  is now included in the introspection payload.
- 0.8.0: **Breaking:** Restructure as monorepo with `@api-introspect/core`, `@api-introspect/trpc`,
  `@api-introspect/fastify`, and
  `api-introspect` (CLI). Add Fastify introspection plugin with route and schema extraction. Preserve HTTP methods in endpoint info for REST APIs. Remove
  `filter` option from introspection (use CLI procedure argument instead). Rename CLI from
  `trpc-introspect` to `api-introspect`. The old `trpc-introspect` npm package is deprecated.
- 0.7.1: Fix TS2742 error for consumers by bundling DTS per entry point.
- 0.7.0: Add `compactSchema` export that strips noise from JSON Schema output.
- 0.6.0: Add `--summary` and `--full` CLI flags for output format control.
- 0.5.0: Add client module and CLI for discovering and invoking procedures from the terminal.
- 0.4.0: **Breaking:** Remove `addIntrospectionEndpoint` (use `withIntrospection` instead).
- 0.3.0: Strongly type `meta` option. Highlight procedure `description` via `.meta()`.
- 0.2.0: Add `include` option to filter introspection to specific path prefixes.
- 0.1.0: Initial release with core functionality and example server.

## License

MIT
