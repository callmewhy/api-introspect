# trpc-introspect

tRPC router introspection SDK. Adds a query endpoint that lists all procedures with types and JSON Schema inputs.

## Tech Stack

- TypeScript, built with tsdown (ESM + CJS dual output)
- Zod v4 (peer dependency, uses `z.toJSONSchema`)
- Vitest for tests
- pnpm as package manager

## Project Structure

- `src/index.ts` - All SDK code (single file)
- `test/index.test.ts` - Unit tests
- `example/server.ts` - Example tRPC server using the SDK

## Key Design Decisions

- No `@trpc/server` dependency. Uses duck-typed interfaces (`RouterLike`, `TRPCBuilderLike`) to accept tRPC objects without importing tRPC types.
- Accesses tRPC internals (`router._def.procedures`, `procedure._def`) which are untyped. Using `any` here is intentional.
- Input schemas are converted to JSON Schema via `z.toJSONSchema` with `unrepresentable: 'any'` to handle edge cases like `z.coerce.date()`.

## Exported API

- `introspectRouter(router, options?)` - Low-level: extracts `EndpointInfo[]` from a router
- `createIntrospectionRouter(t, appRouter, options?)` - High-level: returns a tRPC router with an introspection query procedure, to be used with `t.mergeRouters()`

## Commands

```bash
pnpm test       # vitest run
pnpm build      # tsdown
pnpm lint       # eslint
pnpm example    # tsx example/server.ts (starts on port 3000)
```
