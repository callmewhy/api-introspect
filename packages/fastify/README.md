# @api-introspect/fastify

Fastify route introspection.
Discover endpoints and input/output schemas.

## Install

```bash
npm install @api-introspect/fastify
```

Peer dependency: `fastify` (>=4)

## Quick Start

```typescript
import { introspection } from '@api-introspect/fastify'
import Fastify from 'fastify'

const app = Fastify()

await app.register(introspection, {
  meta: { name: 'My API' },
})

app.get('/user', {
  schema: {
    description: 'List all users',
    response: { 200: UserArraySchema },
  },
}, handler)

await app.listen({ port: 3001 })
```

Then query `/_introspect` to get all endpoints with their schemas:

```bash
curl http://localhost:3001/_introspect
```

## API

### `introspection`

Fastify plugin that registers an introspection endpoint.
Uses Fastify's `onRoute` hook to automatically collect all routes.

```ts
app.register(introspection, options)
```

### `introspectRoutes(routes, options?)`

Low-level function that converts an array of route info into `EndpointInfo[]`.

### Options

```typescript
interface IntrospectionPluginOptions {
  enabled?: boolean // Default: true
  path?: string // Default: '/_introspect'
  serializer?: Serializer // Default: 'json'
  include?: string[] // Include only these path prefixes
  exclude?: string[] // Exclude these path prefixes
  meta?: {
    name?: string // API name
    description?: string // Appended to generated description
  }
}
```

## Features

- **Automatic route collection**: Uses Fastify's `onRoute` hook, no manual registration needed
- **Lazy evaluation**: Introspection payload computed on first request, then cached
- **HTTP method mapping**: GET/HEAD/OPTIONS become `query`, POST/PUT/PATCH/DELETE become `mutation`
- **Schema extraction**: Reads from Fastify's native `schema` system (body, querystring, params, response)
- **Unified input**: All input schemas use `input` array with `in` field (`'params'`, `'query'`, `'body'`)
- **Response priority**: Picks response schema by status code (200 > 201 > 202 > 204)
- **Schema compaction**: Strips noise from JSON Schema for cleaner output

## License

MIT
