# api-introspect

API introspection SDK monorepo.
Adds introspection endpoints that list all procedures with types plus input and output schemas as JSON Schema.
Designed for AI agents to autonomously discover and use APIs.

## Tech Stack

- TypeScript, built with tsdown (ESM + CJS dual output)
- pnpm workspaces (monorepo)
- Vitest for tests
- ESLint with eslint-config-hyoban

## Project Structure

```
packages/
  core/       @api-introspect/core     - Framework-agnostic types, compactSchema, path filters
  trpc/       @api-introspect/trpc     - tRPC router introspection (peer deps: @trpc/server, zod)
  fastify/    @api-introspect/fastify  - Fastify route introspection (peer dep: fastify)
  cli/        api-introspect           - CLI binary and HTTP client
examples/
  trpc/       Example tRPC server using @api-introspect/trpc
  fastify/    Example Fastify server using @api-introspect/fastify
```

## Key Design Decisions

- `@api-introspect/core` is framework-agnostic with zero dependencies.
  It defines its own `ProcedureType` instead of importing from `@trpc/server`.
- `@api-introspect/trpc` uses `@trpc/server` and `zod` as peer dependencies.
  Accesses tRPC internals (`router._def.procedures`, `procedure._def`) which are untyped.
  Using `any` here is intentional.
- Input and output schemas are converted to JSON Schema via `z.toJSONSchema` with `unrepresentable: 'any'`.
  Results are cached in a `WeakMap`.
- `z.coerce.date()` is mapped to `{ type: "string", format: "date-time", deprecated: true }` via a custom `override`.
- Introspection payload is precomputed at router creation time, not per-request.
- CLI (`api-introspect`) and client module live in the `cli` package.
  The client talks plain HTTP and is framework-agnostic.

## Exported API

### @api-introspect/core

- `compactSchema(schema)` - Strips noise from JSON Schema
- `isIncludedPath(path, prefixes)` / `isExcludedPath(path, prefixes)` - Path filtering
- Types: `EndpointInfo`, `IntrospectionResult`, `IntrospectOptions`, `Serializer`, `ProcedureType`, `JSONSchema`

### @api-introspect/trpc

- `introspectRouter(router, options?)` - Extract `EndpointInfo[]` from a tRPC router
- `createIntrospectionRouter(t, appRouter, options?)` - Returns a tRPC router with introspection query
- `withIntrospection(t, appRouter, options?)` - Merges introspection into app router
- Re-exports all core types

### api-introspect (CLI)

- `fetchIntrospection(baseUrl, options?)` - Fetch introspection data via HTTP
- `callProcedure(baseUrl, procedure, options?)` - Call a procedure via HTTP
- CLI binary: `api-introspect <base-url> [procedure] [input]` (no procedure = list all, with procedure = call it)

## Commands

```bash
pnpm dev        # tsx examples/trpc/server.ts (starts on port 3000)
pnpm test       # vitest run (all packages)
pnpm build      # pnpm -r build (all packages)
pnpm lint       # eslint
pnpm lint:fix   # eslint --fix
```

## Guidance

NEVER modify change logs in-place.
The changelog is append-only.
It will be generated automatically from git commit history when release is published.
