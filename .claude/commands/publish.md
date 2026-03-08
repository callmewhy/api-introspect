Publish this package to npm with a version bump.

## Steps

1. Run `pnpm test` to make sure all tests pass. If tests fail, stop and report the failures.
2. Run `pnpm build` to build the package. If the build fails, stop and report the error.
3. Run `pnpm lint` to check for lint errors. If lint fails, stop and report the errors.
4. Check the current version in `package.json` and the latest published version on npm via `npm view trpc-introspect version --json 2>/dev/null || echo "not published"`.
5. Ask the user what version bump they want (patch, minor, or major), showing the current version and what each bump would produce.
6. Update the `version` field in `package.json` to the new version.
7. Create a git commit with the message `release: vX.Y.Z`.
8. Create a git tag `vX.Y.Z`.
9. Run `npm publish --access public` to publish to npm.
10. Report success with the published version and remind the user to `git push --follow-tags` to push the commit and tag to the remote.
