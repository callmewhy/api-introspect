Integration test the CLI by starting both example servers (tRPC and Fastify) and exercising every CLI feature against each.

## Steps

1. Build all packages (required for workspace imports to resolve), then start both example servers in the background and wait for readiness:
   ```bash
   pnpm build
   npx tsx examples/trpc/server.ts &
   npx tsx examples/fastify/server.ts &
   # poll until both are ready
   for i in 1 2 3 4 5; do curl -s http://localhost:3000/_introspect > /dev/null && break; sleep 1; done
   for i in 1 2 3 4 5; do curl -s http://localhost:3001/_introspect > /dev/null && break; sleep 1; done
   ```

2. Run the CLI against **both** servers (no procedure argument) to list all procedures:
   ```bash
   npx tsx packages/cli/src/cli/index.ts http://localhost:3000   # tRPC
   npx tsx packages/cli/src/cli/index.ts http://localhost:3001   # Fastify
   ```
   Parse each output to learn:
   - The available procedure paths, types, and input schemas
   - Which fields are required for each procedure

3. Read `examples/trpc/context.ts` and `examples/fastify/routes.ts` to learn the auth header format (e.g. `Bearer <token>`).

4. Execute ALL the following tests **in parallel** (they are independent).
   Use the introspection output from step 2 to construct correct inputs -- do not guess or hardcode inputs.

   **Important:** When capturing CLI JSON output for parsing, always redirect to a temp file (`> /tmp/out.json`) and read it back with `node -e "...require('fs').readFileSync('/tmp/out.json')..."`.
   Do NOT use `$()` command substitution -- it strips backslashes, corrupting regex patterns in JSON Schema output.

   Run each test category against **both** servers (port 3000 for tRPC, port 3001 for Fastify).
   Procedure paths differ by framework -- use the introspection output from step 2 for each server.

   **List & Format (test on both servers):**
   - List all procedures (no procedure argument) -- verify returns all procedures as full JSON
   - `--summary` flag -- run with `--summary` and verify output is in summary format (compact, no full JSON schemas)
   - `--full` flag -- run with `--full` and verify output includes full JSON Schema details for all procedures

   **Calling procedures (test on both servers):**
   - Call a query with correct input (use introspection to find a query that accepts input)
   - Call a mutation with correct input AND correct auth header (`-H "Authorization:Bearer token"`)
     - For Fastify, if the mutation path is shared with a GET endpoint (e.g. `/user` has both GET and POST), use `-X POST` to disambiguate

   **Error cases (test on both servers):**
   - Unknown procedure -- verify non-zero exit code and error message
   - Invalid JSON input -- verify non-zero exit code and error message
   - Missing auth on protected mutation -- verify non-zero exit code and error (tRPC returns 401, Fastify may return 500 depending on server error handling)

   **Method disambiguation (Fastify only):**
   - `-X <METHOD>` flag -- verify that calling a POST endpoint with `-X POST` succeeds when the path overlaps with a GET endpoint

5. Stop both servers:
   ```bash
   kill $(lsof -ti:3000) 2>/dev/null
   kill $(lsof -ti:3001) 2>/dev/null
   ```

6. Generate an HTML test report at `test/results/integration-report.html` with:
   - Summary header: total tests, passed, failed, timestamp
   - Test results table grouped by category **and by server** (tRPC / Fastify) with pass/fail badges
   - Styled with inline CSS (no external dependencies)
   - Color-coded: green for pass, red for fail
   - If any test failed, include error details

7. Print a summary of the results to the console.

8. **Self-improvement (only when all tests pass):** If every test passed, review how the skill execution went -- were there wasted round-trips, incorrect assumptions, or unnecessary steps?
   If so, edit this SKILL.md to prevent the issue next time.

9. **Coverage check:** Run `npx tsx packages/cli/src/cli/index.ts -h` and compare the help output against the tests in step 4.
   If any CLI flags or features are listed in help but not covered by a test, update this SKILL.md to add the missing test cases.
