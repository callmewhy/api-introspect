# @api-introspect/trpc

tRPC router introspection.
Discover procedures, input/output schemas as JSON Schema.

## Install

```bash
npm install @api-introspect/trpc
```

Peer dependencies: `@trpc/server` (>=11), `zod` (>=4)

## Quick Start

```typescript
import { withIntrospection } from '@api-introspect/trpc'
import { initTRPC } from '@trpc/server'

const t = initTRPC.create()

const appRouter = t.router({
  user: t.router({
    list: t.procedure.query(() => users),
    create: t.procedure
      .input(z.object({ name: z.string() }))
      .mutation(({ input }) => createUser(input)),
  }),
})

// Add introspection - that's it
const router = withIntrospection(t, appRouter, {
  meta: { name: 'My API' },
})
```

Then query `/_introspect` to get all procedures with their schemas:

```bash
curl http://localhost:3000/_introspect
```

## API

### `withIntrospection(t, appRouter, options?)`

Merges an introspection router into your app router.
This is the recommended approach.

### `createIntrospectionRouter(t, appRouter, options?)`

Creates a standalone introspection router you can merge manually.

### `introspectRouter(router, options?)`

Low-level function that extracts `EndpointInfo[]` from a tRPC router.

### Options

```typescript
interface IntrospectionRouterOptions {
  enabled?: boolean // Default: true
  path?: string // Default: '_introspect'
  serializer?: Serializer // Auto-detected if omitted
  include?: string[] // Include only these path prefixes
  exclude?: string[] // Exclude these path prefixes
  meta?: {
    name?: string // API name
    description?: string // Appended to generated description
  }
}
```

## Features

- **Precomputed**: Introspection payload is built at router creation time, not per-request
- **Schema conversion**: Zod schemas converted to JSON Schema via `z.toJSONSchema()`
- **Stacked inputs**: Combines middleware input parsers using `z.intersection()`
- **Serializer detection**: Auto-detects JSON, SuperJSON, or custom transformers
- **Schema compaction**: Strips noise from JSON Schema for cleaner output

## License

MIT
