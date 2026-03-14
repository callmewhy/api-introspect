Integration test the CLI by starting the example server and exercising every CLI feature.

## Steps

1. Start the example server in the background and wait for readiness:
   ```bash
   npx tsx example/server.ts &
   # poll until ready
   for i in 1 2 3 4 5; do curl -s http://localhost:3000/_introspect > /dev/null && break; sleep 1; done
   ```

2. Run `npx tsx src/cli/index.ts http://localhost:3000` (no procedure argument) to list all procedures. Parse this output to learn:
   - The available procedure paths, types, and input schemas
   - Which fields are required for each procedure

3. Read `example/context.ts` to learn the auth header format (e.g. `Bearer <token>`).

4. Execute ALL the following tests **in parallel** (they are independent). Use the introspection output from step 2 to construct correct inputs -- do not guess or hardcode inputs.

   **List & Format:**
   - List all procedures (no procedure argument) -- verify returns all procedures as full JSON
   - Summary vs full mode -- verify via code review that `SUMMARY_THRESHOLD` in `src/cli/output.ts` controls the cutoff

   **Filtering:**
   - Single prefix filter: e.g., `user` -- verify only `user.*` procedures returned
   - Multi-prefix filter: e.g., `user,health` -- verify procedures from both prefixes returned

   **Calling procedures:**
   - Call a query with correct input (e.g., `user.getById '{"id":1}'`)
   - Call a mutation with correct input AND correct auth header from step 3

   **Error cases:**
   - Unknown procedure -- verify non-zero exit code and error message
   - Invalid JSON input -- verify non-zero exit code and error message
   - Missing auth on protected mutation -- verify 401 error

5. Stop the server: `kill $(lsof -ti:3000) 2>/dev/null`

6. Generate an HTML test report at `test/results/integration-report.html` with:
   - Summary header: total tests, passed, failed, timestamp
   - Test results table grouped by category with pass/fail badges
   - Styled with inline CSS (no external dependencies)
   - Color-coded: green for pass, red for fail
   - If any test failed, include error details

7. Print a summary of the results to the console.

8. **Self-improvement (only when all tests pass):** If every test passed, review how the skill execution went -- were there wasted round-trips, incorrect assumptions, or unnecessary steps? If so, edit this SKILL.md to prevent the issue next time.
