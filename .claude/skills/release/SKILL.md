Release this package: update docs, then publish to npm.

## Steps

1. Run `npm whoami` to verify the user is logged in to npm. If not, stop and ask them to run `npm login` first, then retry.
2. Run `npm test` to make sure all tests pass. If tests fail, stop and report the failures.
3. Run `npm build` to build the package. If the build fails, stop and report the error.
4. Run `npm lint` to check for lint errors. If lint fails, stop and report the errors.
5. Find the latest version tag via `git tag --sort=-v:refname | head -1`. If no tags exist, use the initial commit as the base.
6. Run `git diff <tag>..HEAD -- src/` to see all source code changes since the last release.
7. Read the current `README.md`. If there are meaningful changes (new exports, API changes, new options, behavior changes, bug fixes), update the relevant sections. Do not rewrite sections unaffected by changes. If there are no meaningful changes, skip the update.
8. Check the current version in `package.json` and the latest published version on npm via `npm view trpc-introspect version --json 2>/dev/null || echo "not published"`.
9. Ask the user what version bump they want (patch, minor, or major), showing the current version, the latest published version, and what each bump would produce. Include an "as-is" option if the current version is not yet published.
10. If a bump was selected, update the `version` field in `package.json` to the new version.
11. If there are staged or unstaged changes (check via `git status`), create a git commit with the message `release: vX.Y.Z`. If the working tree is clean, skip the commit.
12. Create a git tag `vX.Y.Z`.
13. Run `npm publish --access public`. If it fails with EOTP (requires OTP), ask the user for their one-time password and retry with `--otp=<code>`.
14. Run `git push --follow-tags` to push the commit and tag to the remote.
15. Report success with the published version.
