Integration test the CLI by starting the example server and exercising every CLI feature.

## Steps

1. Run `npx tsx src/cli/index.ts -h` to see all CLI usage, options, and examples. Use this output to design a test plan covering every feature shown in the help text.

2. Start the example server in the background:
   ```bash
   npx tsx example/server.ts &
   ```
   Wait for it to be ready by polling `http://localhost:3000/_introspect` (retry a few times with short delays).

3. Execute the test plan by running CLI commands via `npx tsx src/cli/index.ts`. For each test, record the test name, category, pass/fail status, and any error details. Cover at minimum:
   - **List all procedures**: run without procedure argument
   - **Summary vs full mode**: verify output format depends on procedure count (>10 shows summary with paths only, <=10 shows full JSON)
   - **Single prefix filter**: e.g., `user` shows only `user.*` procedures
   - **Multi-prefix filter (OR)**: e.g., `user,health` shows procedures from both prefixes
   - **Call a query**: with correct input
   - **Call a mutation**: with correct input and auth header
   - **Custom headers**: `-H` flag
   - **Error cases**: unknown procedure, invalid JSON input, missing auth on protected mutation

4. Stop the server process.

5. Generate an HTML test report at `test/results/integration-report.html` with:
   - Summary header: total tests, passed, failed, timestamp
   - Test results table grouped by category with pass/fail badges
   - Styled with inline CSS (no external dependencies)
   - Color-coded: green for pass, red for fail
   - If any test failed, include error details

6. Print a summary of the results to the console.

7. What do you think can be optimized in this skill execution? For example, the use of the CLI itself, whether efficiency can be improved in the skills, etc. You can directly edit the skill files to optimize the experience for the next test skill execution.
