Integration test the CLI by starting all three example servers (tRPC, Fastify, OpenAPI) and exercising every CLI subcommand against each.

## Steps

1. Build all packages (required for workspace imports to resolve), then ensure the example servers are running.

   First check if anything is already bound to 3000 / 3001 / 3002 — a prior `/test` run may have left them up.
   If so, just probe and skip the start step:

   ```bash
   pnpm build
   for p in 3000 3001 3002; do lsof -ti:$p > /dev/null && echo ":$p already running" || echo ":$p free"; done
   ```

   If a port is free, start that server (use the Bash tool's `run_in_background: true` — bare `&` from foreground commands won't survive).
   Start the matching server only:

   ```bash
   npx tsx examples/trpc/server.ts       # if :3000 free
   npx tsx examples/fastify/server.ts    # if :3001 free
   npx tsx examples/openapi/server.ts    # if :3002 free
   ```

   Then poll for readiness:

   ```bash
   for i in 1 2 3 4 5; do curl -s http://localhost:3000/_introspect > /dev/null && break; sleep 1; done
   for i in 1 2 3 4 5; do curl -s http://localhost:3001/_introspect > /dev/null && break; sleep 1; done
   for i in 1 2 3 4 5; do curl -s http://localhost:3002/openapi.json > /dev/null && break; sleep 1; done
   ```

2. Run `list` against **all three** servers to discover endpoints:
   ```bash
   npx tsx packages/cli/src/cli/index.ts list http://localhost:3000                       # tRPC      (auto-probes /_introspect)
   npx tsx packages/cli/src/cli/index.ts list http://localhost:3001                       # Fastify   (auto-probes /_introspect)
   npx tsx packages/cli/src/cli/index.ts list http://localhost:3002/openapi.json          # OpenAPI   (auto-detects spec)
   ```
   Parse each output to learn the available endpoint paths, methods, and descriptions.

3. Read `examples/trpc/context.ts` and `examples/fastify/routes.ts` to learn the auth header format (e.g. `Bearer <token>`).
   The OpenAPI example has no auth.

4. Execute ALL the following tests **in parallel** (they are independent).
   Use the `info` output to learn each endpoint's input schema -- do not guess inputs.

   **Important:** When capturing CLI JSON output for parsing, always redirect to a temp file (`> /tmp/out.json`) and read it back with `node -e "...require('fs').readFileSync('/tmp/out.json')..."`.
   Do NOT use `$()` command substitution -- it strips backslashes, corrupting regex patterns in JSON Schema output.

   Run each test category against **all three** servers (3000 = tRPC, 3001 = Fastify, 3002 = OpenAPI).
   Endpoint paths differ per server -- use the `list` output from step 2.

   **list (all three servers):**
   - `list <url>` returns a collapsed listing: name header, total count, one line per endpoint with method/type and optional description.
   - The output must NOT include full JSON Schemas (those belong to `info`).

   **info (all three servers):**
   - `info <url> --path <p>` for an unambiguous endpoint -- verify output is a single JSON object with `path`, `type`, optionally `method`, optional `description`, and (when present) `input` / `output` JSON Schemas.
   - For an HTTP endpoint whose path is shared (e.g. `GET /users` and `POST /users`), `info <url> --path <p>` without `--method` should error and suggest `--method`.
     Then re-run with `--method <M>` and verify it returns the right operation.

   **call (all three servers):**
   - Call a query / GET endpoint with correct input.
   - Call a mutation / POST endpoint with correct input.
     For tRPC and Fastify mutations that require auth, include `-H "Authorization:Bearer token"`.
     For Fastify, when path overlaps with a GET (e.g. `/user`), pass `--method POST`.
     For OpenAPI, when path overlaps (e.g. `/pets`), pass `--method POST`.
   - Call an endpoint with a path parameter (e.g. `--path /users/{id} --input '{"id":1}'`) and verify the param is substituted into the URL.
   - Verify the `-X` short alias works equivalently to `--method` (e.g. `call --path /user -X GET`).

   **Auto-detection (OpenAPI specifically):**
   - Confirm `list http://localhost:3002/openapi.json` succeeds without any `--openapi`-style flag.
   - Confirm the `baseUrl` used for `call` is `spec.servers[0].url` -- a successful POST to `/pets` proves this.

   **Error cases (all three where applicable):**
   - Unknown endpoint: `info <url> --path /missing` -- verify non-zero exit and "Endpoint not found" message.
   - Invalid JSON input: `call <url> --path <p> --input 'not-json'` -- verify non-zero exit and "Invalid JSON input" message.
   - Missing auth on protected mutation (tRPC, Fastify): verify non-zero exit (tRPC returns 401, Fastify may return 500).
   - Method ambiguity: `call <url> --path <shared-path> --input ...` without `--method` -- verify non-zero exit and "Multiple endpoints match" message.

5. Stop all servers:
   ```bash
   kill $(lsof -ti:3000) 2>/dev/null
   kill $(lsof -ti:3001) 2>/dev/null
   kill $(lsof -ti:3002) 2>/dev/null
   ```

6. Generate an HTML test report at `test/results/integration-report.html` with:
   - Summary header: total tests, passed, failed, timestamp
   - Test results table grouped by category **and by server** (tRPC / Fastify / OpenAPI) with pass/fail badges
   - Styled with inline CSS (no external dependencies)
   - Color-coded: green for pass, red for fail
   - If any test failed, include error details

7. Print a summary of the results to the console.

8. **Self-improvement (only when all tests pass):** If every test passed, review how the skill execution went -- were there wasted round-trips, incorrect assumptions, or unnecessary steps?
   If so, edit this SKILL.md to prevent the issue next time.

9. **Coverage check:** Run `npx tsx packages/cli/src/cli/index.ts -h` and compare the help output against the tests in step 4.
   If any subcommand or flag is listed in help but not covered by a test, update this SKILL.md to add the missing test cases.
