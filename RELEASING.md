# Releasing dungeonmaker-js

**Rule:** when the `version` in `packages/dungeonmaker-js/package.json` on `master` rises above
the highest version on npm, `.github/workflows/release.yml` builds and tests the package,
publishes it to npm, tags `v<version>` and creates a GitHub release. The version bump _is_ the
release button. Publishing uses npm Trusted Publishing (OIDC): no `NPM_TOKEN` exists anywhere,
and every release gets a provenance attestation.

## One-time setup (in this order)

### A — npmjs.com: prepare the account

1. Log in to npmjs.com and enable **two-factor authentication** for "Authorization and writes".

### B — locally: publish `0.0.1` once, _before_ pushing `release.yml`

Trusted Publishing can only be configured for a package that already exists, so the first
version is published by hand.

> **Order matters.** If the commit that introduces `release.yml` reaches GitHub while `0.0.1` is
> not yet on npm, the workflow tries to publish without a trusted publisher and fails. Publish
> locally first, then push.

2. `npm login` (pnpm uses the same `~/.npmrc`).
3. On a clean `master`: `pnpm --filter dungeonmaker-js publish --access public`. npm asks for
   the 2FA code; pnpm checks that the branch is `master` and the tree is clean. (`prepack`
   builds the package and copies `LICENSE`/`NOTICE` into it.)
4. Check: `pnpm view dungeonmaker-js version` prints `0.0.1`.
5. Tag the published commit — its tag is the corresponding source the package README points
   to (GPLv3 §6(d)), and a hand-published version carries no `gitHead` the workflow could
   verify: `git tag v0.0.1 && git push origin master v0.0.1`. The `release` workflow then
   finds `0.0.1` on npm with its tag and does nothing.

### C — npmjs.com: register the trusted publisher (right after B)

6. npmjs.com → package `dungeonmaker-js` → **Settings** → **Trusted Publisher** → **GitHub Actions**.
7. Fields (case-sensitive; npm does _not_ validate them, typos only show at the next release):
   - Organization or user: `spearwolf`
   - Repository: `dungeonmaker.js`
   - Workflow filename: `release.yml` (file name only, no path)
   - Environment name: `npm`
   - Allowed actions: tick **`npm publish`**. Without it only "staged publish" is allowed, which
     needs a manual approval on npmjs.com.
8. Save. **Deadline:** a new trusted-publisher configuration expires if it is not used
   successfully within **2 days** — push the `0.0.2` bump right afterwards.

### D — GitHub: repository settings (`github.com/spearwolf/dungeonmaker.js/settings`)

9. **Environments** → _New environment_ `npm` → _Deployment branches and tags_: "Selected
   branches and tags" → rule `master`. Do **not** add required reviewers, or every release waits
   for a click.
10. **Actions → General → Workflow permissions:** keep the default (read). The release job
    requests `contents: write` and `id-token: write` itself.
11. **Pages:** leave as is until the site workflow exists; the 2014 demo keeps running from the
    `gh-pages` branch.
12. Recommended: **Rules → Rulesets** for `master` requiring the status check `ci`.
13. The repository must stay **public**, otherwise there is no provenance.
14. **Secrets: none.** Do not create an `NPM_TOKEN`.

### E — npmjs.com: disable tokens (after the first successful CI release, `0.0.2`)

15. Package → **Settings → Publishing access** → "Require two-factor authentication and
    **disallow tokens**". Trusted Publishing is not affected (OIDC is not a token).
16. Optionally `npm logout` locally.

## A release, day to day

```sh
# patch | minor | major | prerelease --preid beta
pnpm --filter dungeonmaker-js exec npm version patch --no-git-tag-version
git commit -am "release: dungeonmaker-js 0.0.3" && git push
```

CI does the rest: _Actions → release_, npmjs.com (with provenance badge), _Releases_ in the
repository (with the package tarball and `source.tar.gz` as the corresponding source).
Prerelease versions (`1.2.0-beta.1`) are published with the dist-tag `next`. If a push touches
`package.json` without raising the version, the `check` job ends quietly.

## Pitfalls

- `repository.url` in `packages/dungeonmaker-js/package.json` must be exactly
  `git+https://github.com/spearwolf/dungeonmaker.js.git` (plus `"directory":
  "packages/dungeonmaker-js"`), or npm rejects the provenance.
- Never rename `release.yml` without updating the trusted-publisher settings (step 7).
- Self-hosted runners do not work with Trusted Publishing.
- A version that is lower than or equal to an already published one stops the release with a
  clear error. npm never allows reusing a version, not even after `unpublish`.
- `publish` only runs after the full `ci` workflow (tests, native golden cross-check, wasm
  drift check) has passed for the same commit.
- If `npm publish` fails, no tag and no GitHub release exist; fix the cause and re-run the
  workflow via _Run workflow_ (`workflow_dispatch`).
- If tagging or the GitHub release fails _after_ a successful publish, re-run the workflow on
  the same commit: `release-check` sees the version on npm with this commit as `gitHead` but
  without tag, skips `publish` and runs only the `tag` job (which fetches the published tarball
  from npm). A version published from a different commit is never tagged automatically.
