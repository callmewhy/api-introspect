# @api-introspect/core

Framework-agnostic types and utilities for API introspection.
Zero dependencies.

## Install

```bash
npm install @api-introspect/core
```

## API

### `compactSchema(schema)`

Strips noise from JSON Schema while preserving structure:

- Removes `additionalProperties: false`
- Simplifies nullable `anyOf` patterns to `type: [X, "null"]`
- Strips verbose date metadata from `z.coerce.date()` patterns
- Removes `maximum: 9007199254740991` (MAX_SAFE_INTEGER)
- Recursively cleans nested objects, arrays, and `allOf`/`anyOf`

```typescript
import { compactSchema } from '@api-introspect/core'

const cleaned = compactSchema({
  type: 'object',
  properties: { name: { type: 'string' } },
  additionalProperties: false,
})
// { type: 'object', properties: { name: { type: 'string' } } }
```

### `isIncludedPath(path, prefixes)` / `isExcludedPath(path, prefixes)`

Path prefix matching for filtering endpoints.

```typescript
import { isExcludedPath, isIncludedPath } from '@api-introspect/core'

isIncludedPath('user.getById', ['user']) // true
isExcludedPath('health.check', ['health']) // true
```

### Types

```typescript
type ProcedureType = 'query' | 'mutation' | 'subscription'
type Serializer = 'json' | 'superjson' | 'custom'
type JSONSchema = Record<string, unknown>

interface EndpointInfo {
  path: string
  type: ProcedureType
  description?: string
  input?: JSONSchema
  output?: JSONSchema
}

interface IntrospectOptions {
  include?: readonly string[]
  exclude?: readonly string[]
}

interface IntrospectionResult {
  name?: string
  description: string
  serializer: Serializer
  procedures: EndpointInfo[]
}
```

## License

MIT
