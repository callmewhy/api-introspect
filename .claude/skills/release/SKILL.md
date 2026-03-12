Release this package: update docs, tag, and push. Publishing is handled by GitHub Actions.

## Steps

1. Run `pnpm test`, `pnpm build`, and `pnpm lint` in parallel. If any fail, stop and report.
2. Find the latest version tag via `git tag --sort=-v:refname | head -1`. If no tags exist, use the initial commit as the base.
3. Run `git diff <tag>..HEAD -- src/` and `git log <tag>..HEAD --oneline` in parallel to see all changes since the last release.
4. Read `README.md`. If there are meaningful changes (new exports, API changes, new options, behavior changes, bug fixes), update the relevant sections and the Changelog. Do not rewrite sections unaffected by changes. If there are no meaningful changes, skip the update.
5. Check the current version in `package.json` and the latest published version on npm via `npm view trpc-introspect version --json 2>/dev/null || echo "not published"`.
6. Decide the version bump automatically:
   - **minor**: new features, new exports, new options, new CLI commands, new API surface
   - **patch**: bug fixes, refactors, internal changes, docs updates, CI changes
   - The user will explicitly say "major" in advance if a major bump is needed; never pick major on your own.
   - If the current version in `package.json` is already higher than the published version, use it as-is without bumping.
7. Update the `version` field in `package.json` to the new version.
8. If there are staged or unstaged changes (check via `git status`), create a git commit with the message `release: vX.Y.Z`. If the working tree is clean, skip the commit.
9. Create an **annotated** git tag: `git tag -a vX.Y.Z -m "vX.Y.Z"`.
10. Run `git push && git push origin vX.Y.Z` to push the commit and tag. This triggers the GitHub Actions workflow to publish to npm and create a GitHub Release.
11. Report success with the version and a link to the GitHub Actions run.
