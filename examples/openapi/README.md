# Example: OpenAPI Server

A plain Node `http` server that publishes its OpenAPI 3.0 spec at `/openapi.json` and implements the routes the spec describes.
Demonstrates pointing `api-introspect` at a third-party API spec rather than at one of our own SDK adapters.

## Run

```bash
# From monorepo root
pnpm --filter @api-introspect/example-openapi dev
```

Server starts on <http://localhost:3002>.
The spec is at <http://localhost:3002/openapi.json>.

## Endpoints

| Method | Path         | Description      |
| ------ | ------------ | ---------------- |
| GET    | `/pets`      | List all pets    |
| POST   | `/pets`      | Create a new pet |
| GET    | `/pets/{id}` | Get a pet by ID  |
| DELETE | `/pets/{id}` | Delete a pet     |

## Discover with the CLI

```bash
# List endpoints (auto-detects the OpenAPI document)
npx api-introspect list http://localhost:3002/openapi.json

# Inspect one endpoint's full schema
npx api-introspect info http://localhost:3002/openapi.json --path /pets/{id} --method GET

# Call an endpoint (baseUrl comes from spec.servers[0].url)
npx api-introspect call http://localhost:3002/openapi.json --path /pets --method POST --input '{"name":"Buddy"}'
npx api-introspect call http://localhost:3002/openapi.json --path /pets/{id} --method DELETE --input '{"id":1}'
```

## What This Demonstrates

- Auto-detection of OpenAPI / Swagger documents by `loadSource`
- `$ref` resolution against `components.schemas`
- Path-level parameters inherited into each operation
- Using `servers[0].url` from the spec as the call base URL
