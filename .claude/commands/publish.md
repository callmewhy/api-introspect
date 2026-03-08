Publish this package to npm with a version bump.

## Steps

1. Run `npm whoami` to verify the user is logged in to npm. If not, stop and ask them to run `npm login` first, then retry.
2. Run `pnpm test` to make sure all tests pass. If tests fail, stop and report the failures.
3. Run `pnpm build` to build the package. If the build fails, stop and report the error.
4. Run `pnpm lint` to check for lint errors. If lint fails, stop and report the errors.
5. Check the current version in `package.json` and the latest published version on npm via `npm view trpc-introspect version --json 2>/dev/null || echo "not published"`.
6. Ask the user what version bump they want (patch, minor, or major), showing the current version, the latest published version, and what each bump would produce. Include an "as-is" option if the current version is not yet published.
7. If a bump was selected, update the `version` field in `package.json` to the new version.
8. If there are staged or unstaged changes (check via `git status`), create a git commit with the message `release: vX.Y.Z`. If the working tree is clean, skip the commit.
9. Create a git tag `vX.Y.Z`.
10. Run `npm publish --access public`. If it fails with EOTP (requires OTP), ask the user for their one-time password and retry with `--otp=<code>`.
11. Report success with the published version and remind the user to `git push --follow-tags` to push the commit and tag to the remote.
