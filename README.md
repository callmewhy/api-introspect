# api-introspect

[![CI](https://github.com/callmewhy/api-introspect/actions/workflows/ci.yml/badge.svg)](https://github.com/callmewhy/api-introspect/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/npm/l/api-introspect)](https://github.com/callmewhy/api-introspect/blob/main/LICENSE)

API introspection SDK.
Adds endpoints that return all available API procedures with their types, descriptions, and input/output schemas as JSON Schema.
Designed for AI agents to autonomously discover and learn how to use your API.

## Packages

| Package                                         | Description                                      |
| ----------------------------------------------- | ------------------------------------------------ |
| [`@api-introspect/core`](./packages/core)       | Framework-agnostic types and utilities           |
| [`@api-introspect/trpc`](./packages/trpc)       | tRPC router introspection                        |
| [`@api-introspect/fastify`](./packages/fastify) | Fastify route introspection                      |
| [`@api-introspect/openapi`](./packages/openapi) | OpenAPI / Swagger spec to introspection envelope |
| [`api-introspect`](./packages/cli)              | CLI and HTTP client                              |

## Quick Start

### tRPC

```bash
pnpm add @api-introspect/trpc
```

```ts
import { withIntrospection } from '@api-introspect/trpc'

const rootRouter = withIntrospection(t, appRouter, {
  meta: { name: 'My API' },
})
```

### Fastify

```bash
pnpm add @api-introspect/fastify
```

```ts
import { introspection } from '@api-introspect/fastify'

await app.register(introspection, {
  meta: { name: 'My API' },
})
```

### OpenAPI / Swagger

Already have an OpenAPI 3.x or Swagger 2.0 spec?
Point the CLI at the spec URL — no SDK integration required.
The spec is auto-detected and converted to the same introspection envelope as tRPC and Fastify.

```bash
npx api-introspect list https://api.example.com/openapi.json
```

The `@api-introspect/openapi` package exposes the conversion as a function for programmatic use:

```ts
import { openAPIToIntrospection } from '@api-introspect/openapi'

const introspection = openAPIToIntrospection(spec)
```

### Discover

The CLI is subcommand-based.
The `<url>` is auto-detected: introspection envelope (tRPC / Fastify) or OpenAPI document.

```bash
# List all endpoints (always collapsed: path + method/type + description)
npx api-introspect list http://localhost:3000

# Show full schema for a single endpoint
npx api-introspect info http://localhost:3000 --path user.getById
npx api-introspect info https://api.example.com/openapi.json --path /users/{id} --method GET

# Call an endpoint
npx api-introspect call http://localhost:3000 --path user.getById --input '{"id":1}'
npx api-introspect call http://localhost:3000 --path /users/{id} --method DELETE --input '{"id":1}'
```

When a path is reused across HTTP methods (e.g. `GET /users` and `POST /users`), pass `--method` to disambiguate.

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
      "auth": true,
      "input": [
        {
          "in": "body",
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
      ]
    },
    {
      "path": "/users/{id}",
      "type": "http",
      "method": "PATCH",
      "input": [
        {
          "in": "path",
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
        {
          "in": "body",
          "type": "object",
          "properties": {
            "name": {
              "type": "string"
            }
          }
        }
      ]
    }
  ]
}
```

## Examples

```bash
pnpm --filter @api-introspect/example-trpc dev      # tRPC server on http://localhost:3000
pnpm --filter @api-introspect/example-fastify dev   # Fastify server on http://localhost:3001
pnpm --filter @api-introspect/example-openapi dev   # OpenAPI server on http://localhost:3002
```

- [examples/trpc](./examples/trpc) - tRPC server with queries, mutations, and auth middleware
- [examples/fastify](./examples/fastify) - Fastify HTTP server with TypeBox schemas
- [examples/openapi](./examples/openapi) - Plain Node `http` server publishing an OpenAPI 3.0 spec at `/openapi.json`

## Development

```bash
pnpm build       # build all packages
pnpm test        # run all tests
pnpm lint:fix    # lint
```

## Changelog

- 0.15.0: CLI gains a `--base-url <url>` option that overrides the base URL used by `call`, useful when an OpenAPI spec is hosted apart from the API it describes.
- 0.14.0: Add `@api-introspect/openapi` package that converts OpenAPI 3.x / Swagger 2.0 specs into the unified introspection envelope.
  CLI restructured around subcommands `list`, `info`, and `call`, with explicit `--path`, `--method`, and `--input` flags (replacing positional procedure / input arguments and the `--summary` / `--full` toggles).
  CLI auto-detects the `<url>` argument as either an introspection endpoint or an OpenAPI / Swagger spec.
  CLI HTTP client now substitutes both `:name` and `{name}` style path parameters.
  New `loadSource` export from `api-introspect` for programmatic source detection.
- 0.13.3: Fastify introspection now normalizes `:param` path parameters to `{param}` format for consistency with OpenAPI conventions.
- 0.13.2: `compactSchema` now preserves nullable object/array `anyOf` instead of flattening to `type: [X, "null"]` for better toolchain compatibility.
- 0.13.1: Rename `InputLocation` value from `'params'` to `'path'` for consistency with OpenAPI conventions.
- 0.13.0: Unify input schemas into a single `input` array with `in` field (`'path'`, `'query'`, `'body'`).
  New `InputSchema` and `InputLocation` types exported from core.
  Meta fields flattened directly into endpoint objects (no more `meta` wrapper).
  `compactSchema` now retains `default` values.
  CLI client routes input by `in` location (path, query, body) when calling HTTP endpoints.
- 0.12.0: Add `IntrospectionMeta` type with required `name` and extensible fields.
  Meta fields are now flattened directly into the introspection response instead of cherry-picking known keys.
  `IntrospectionResult` uses an index signature for arbitrary top-level fields.
- 0.11.2: Custom `meta.description` now replaces the default description instead of appending to it.
- 0.11.1: Improve default descriptions: tRPC uses "procedures", Fastify uses "endpoints".
  CLI help text uses generic "endpoint" terminology covering both tRPC procedures and HTTP routes.
  CLI summary output uses correct noun ("endpoints" vs "procedures") based on introspection payload.
  Fix Fastify plugin excluding its own introspection route when using a custom path.
- 0.11.0: Fastify plugin now returns `endpoints` instead of
  `procedures` in the introspection payload.
  Add `baseUrl` and `auth` to the
  `meta` option for both tRPC and Fastify plugins, included in the introspection response when provided.
  CLI client supports both
  `endpoints` and
  `procedures` fields for backward compatibility.
  Fix default introspection path and URL joining with leading slashes.
- 0.10.0: Fastify introspection now returns separate `params`, `query`, and
  `body` fields instead of a merged `input` field, matching HTTP semantics more precisely.
  `compactSchema` now strips additional noise keys (`pattern`, `format`, `title`, `default`,
  `examples`, `$id`) and simplifies `anyOf` with `const` values into `enum`.
  Core
  `EndpointInfo` type updated: `HttpEndpointInfo` uses `params`/`query`/`body`,
  `RpcEndpointInfo` retains `input`.
- 0.9.0: Add `meta` field support to route and procedure introspection.
  Custom metadata (e.g.
  `auth`, `tags`) from tRPC `.meta()` and Fastify route `config.meta`
  is now included in the introspection payload.
- 0.8.0: **Breaking:** Restructure as monorepo with `@api-introspect/core`, `@api-introspect/trpc`,
  `@api-introspect/fastify`, and
  `api-introspect` (CLI).
  Add Fastify introspection plugin with route and schema extraction.
  Preserve HTTP methods in endpoint info for REST APIs.
  Remove
  `filter` option from introspection (use CLI procedure argument instead).
  Rename CLI from
  `trpc-introspect` to `api-introspect`.
  The old `trpc-introspect` npm package is deprecated.
- 0.7.1: Fix TS2742 error for consumers by bundling DTS per entry point.
- 0.7.0: Add `compactSchema` export that strips noise from JSON Schema output.
- 0.6.0: Add `--summary` and `--full` CLI flags for output format control.
- 0.5.0: Add client module and CLI for discovering and invoking procedures from the terminal.
- 0.4.0: **Breaking:** Remove `addIntrospectionEndpoint` (use `withIntrospection` instead).
- 0.3.0: Strongly type `meta` option.
  Highlight procedure `description` via `.meta()`.
- 0.2.0: Add `include` option to filter introspection to specific path prefixes.
- 0.1.0: Initial release with core functionality and example server.

## License

MIT
