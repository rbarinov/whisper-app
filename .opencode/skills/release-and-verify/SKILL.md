---
name: release-and-verify
description: Push changes, create a SemVer git tag, and monitor the GitHub Actions release build until it succeeds or fails
---

## What I do

Automate the full release cycle for this project: push commits, create a version tag, and wait for the CI/CD pipeline to confirm a successful build.

## When to use me

Use this skill when the user asks to release, publish, ship, or deploy a new version.

## Prerequisites

- All changes must be committed (clean working tree, except untracked files).
- The `gh` CLI must be authenticated.
- The remote is `origin` on branch `main`.

## Versioning rules

This project follows [Semantic Versioning](https://semver.org/): `vMAJOR.MINOR.PATCH`.

| Bump  | When                                         | Example            |
|-------|----------------------------------------------|--------------------|
| MAJOR | Breaking changes (incompatible API/config)   | `v1.2.3` -> `v2.0.0` |
| MINOR | New backward-compatible features             | `v1.2.3` -> `v1.3.0` |
| PATCH | Bug fixes, small improvements, docs          | `v1.2.3` -> `v1.2.4` |

If the user specifies a bump level (patch, minor, major), use it. If not, infer from the changes and confirm with the user before tagging.

## Workflow

1. **Verify clean state**
   ```bash
   git status
   ```
   Abort if there are uncommitted staged changes. Warn about unstaged changes.

2. **Determine the next version**
   ```bash
   git tag --list 'v*' --sort=-v:refname | head -1
   ```
   Increment according to the chosen bump level.

3. **Push commits to main**
   ```bash
   git push origin main
   ```

4. **Create and push the tag**
   ```bash
   git tag <version>
   git push origin <version>
   ```

5. **Monitor the release build**
   Poll GitHub Actions until the Release workflow completes:
   ```bash
   gh run list --workflow=release.yml --limit 1 --repo rbarinov/whisper-app
   ```
   - If the run is not yet visible, wait a few seconds and retry.
   - Poll every 10-15 seconds, up to 5 minutes.
   - Report the final status (success/failure) to the user.
   - If failed, show the failing step:
     ```bash
     gh run view <run-id> --repo rbarinov/whisper-app
     ```

6. **Confirm release**
   On success, inform the user that the release is live at:
   `https://github.com/rbarinov/whisper-app/releases/tag/<version>`

## Error handling

- If `git push` fails (e.g. diverged branch), stop and inform the user.
- If the tag already exists, stop and ask the user for a different version.
- If the CI build fails, show the error output and ask how to proceed.
- Never force-push or delete tags without explicit user approval.
