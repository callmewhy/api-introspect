# api-introspect

CLI and HTTP client for discovering and calling API endpoints.
Works against any tRPC, Fastify, or OpenAPI/Swagger service that exposes its schema.

## Install

```bash
# One-off
npx api-introspect <command> <url> [options]

# Or globally
npm install -g api-introspect
```

## CLI Usage

The CLI has three subcommands.
The `<url>` argument can be:

- a tRPC/Fastify `_introspect` endpoint (e.g. `http://localhost:3000/_introspect`),
- a base URL to probe (e.g. `http://localhost:3000` — `_introspect` is appended automatically), or
- an OpenAPI / Swagger spec URL (e.g. `https://api.example.com/openapi.json` — auto-detected).

```bash
# List every endpoint with method/type and description
api-introspect list http://localhost:3000
api-introspect list https://api.example.com/openapi.json

# Show a single endpoint's full schema (input/output as JSON Schema)
api-introspect info http://localhost:3000 --path user.getById
api-introspect info https://api.example.com/openapi.json --path /users/{id} --method GET

# Call an endpoint
api-introspect call http://localhost:3000 --path user.create --input '{"name":"Alice"}'
api-introspect call http://localhost:3001 --path /user/{id} --method DELETE --input '{"id":1}'

# With auth header
api-introspect call http://localhost:3000 --path user.create \
  --input '{"name":"Alice"}' \
  -H "Authorization:Bearer token"

# Override the base URL when the spec lives apart from the API
# (e.g. spec on a docs site, dev server on localhost)
api-introspect call https://docs.example.com/openapi.json --path /pets --method GET \
  --base-url http://localhost:3002
```

### Options

| Flag                     | Description                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| `--path <p>`             | Endpoint path. tRPC: e.g. `user.getById`. HTTP: e.g. `/users/{id}`. Required for `info` and `call`. |
| `--method <M>`, `-X <M>` | HTTP method to disambiguate same-path endpoints (e.g. `GET /users` vs `POST /users`).               |
| `--input <json>`         | JSON input for `call`. Path params (e.g. `{id}`) are substituted from the input object.             |
| `--base-url <url>`       | Override the base URL used for `call`. Useful when an OpenAPI spec is hosted apart from the API.    |
| `--header <k:v>`, `-H`   | Custom request header. Repeatable.                                                                  |
| `-h`, `--help`           | Show help.                                                                                          |

### Auto-detection

`loadSource` (and therefore the CLI) figures out what kind of source you gave it:

- **OpenAPI / Swagger** — recognized by the top-level `openapi` or `swagger` field.
  The base URL for `call` comes from `servers[0].url`.
  Relative server URLs (e.g. `"/v2"`) are resolved against the spec URL per the OpenAPI spec.
- **tRPC introspection envelope** — recognized by the `procedures` array (and unwrapped from tRPC's `result.data` envelope automatically).
- **Fastify introspection envelope** — recognized by the `endpoints` array.

If the URL you gave isn't a direct introspection/spec URL, the CLI also probes `<url>/_introspect` as a fallback.

## Programmatic API

```typescript
import { callProcedure, fetchIntrospection, loadSource } from 'api-introspect'
```

### `loadSource(url, options?)`

Unified loader that handles tRPC introspection, Fastify introspection, and OpenAPI/Swagger specs.
Returns a normalized envelope plus the base URL to use for subsequent `callProcedure` calls.

```typescript
const { introspection, baseUrl, kind } = await loadSource(
  'https://api.example.com/openapi.json',
  { headers: { Authorization: 'Bearer ...' } },
)
// kind: 'introspect' | 'openapi'
```

| Option           | Type                     | Description                                          |
| ---------------- | ------------------------ | ---------------------------------------------------- |
| `introspectPath` | `string`                 | Probe path for base URLs (default: `'/_introspect'`) |
| `headers`        | `Record<string, string>` | Custom HTTP headers                                  |

### `fetchIntrospection(baseUrl, options?)`

Lower-level: fetches an introspection envelope from a tRPC/Fastify server.
Use `loadSource` if you also need OpenAPI support.

| Option    | Type                     | Description                                             |
| --------- | ------------------------ | ------------------------------------------------------- |
| `path`    | `string`                 | Introspection endpoint path (default: `'/_introspect'`) |
| `headers` | `Record<string, string>` | Custom HTTP headers                                     |

### `callProcedure(baseUrl, procedure, options?)`

Calls a tRPC procedure or HTTP endpoint.
When `introspection` is supplied, `type`, HTTP `method`, and the wire `transformer` are inferred from it.

```typescript
const data = await callProcedure(baseUrl, 'user.getById', {
  input: { id: 1 },
  introspection,
})

const user = await callProcedure(baseUrl, '/user/{id}', {
  input: { id: 1 },
  method: 'GET',
  introspection,
})
```

| Option          | Type                                       | Description                                                              |
| --------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| `type`          | `'query' \| 'mutation'`                    | Procedure type (auto-detected if `introspection` is given)               |
| `method`        | `string`                                   | HTTP method to disambiguate same-path endpoints                          |
| `input`         | `unknown`                                  | Input data; path params (`{id}`, `:id`) are substituted from object keys |
| `transformer`   | `'json' \| 'superjson' \| TransformerLike` | Wire format (auto-detected from introspection)                           |
| `headers`       | `Record<string, string>`                   | Custom HTTP headers                                                      |
| `introspection` | `IntrospectionResult`                      | Pre-fetched introspection (avoids extra round-trip)                      |

## License

MIT
