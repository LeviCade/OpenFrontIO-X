# Upstream synchronization and GitHub safety

OpenFrontIO-X is intended to remain an independent GitHub repository, while periodically incorporating official OpenFront updates. Being outside GitHub's fork network **does not prevent Git fetch/merge**.

## Repository boundaries

- **Our writable repository:** \`https://github.com/LeviCade/OpenFrontIO-X.git\`
- **Official, read-only upstream:** \`https://github.com/openfrontio/OpenFrontIO.git\`
- **Default branch:** \`main\`
- **Current engineering branch:** \`feature/map-multiplier\`
- No push, pull request, issue or CI dispatch should be directed to official upstream.

## Recommended first-time local setup

\`\`\`bash
git clone https://github.com/LeviCade/OpenFrontIO-X.git
cd OpenFrontIO-X
git remote add upstream https://github.com/openfrontio/OpenFrontIO.git
git config remote.pushDefault origin
git config remote.pushDefault # should print origin
git remote -v
git fetch origin
git switch feature/map-multiplier
\`\`\`

The above command configures a read-only *intention*, not a security boundary: \`git push upstream\` is still possible for someone who has upstream write access. For hard protection on a local machine, set the upstream push URL to a deliberate invalid destination and verify it using \`git remote -v\`:

\`\`\`bash
git remote set-url --push upstream DISABLED_DO_NOT_PUSH
\`\`\`

\`origin\` remains our writable repository.

## Updating after official releases

Preferred: use a dedicated sync branch, compare changes, resolve conflicts, test, then open a PR to our own \`main\`.

\`\`\`bash
git fetch upstream main
git fetch origin main
git switch -c maintenance/upstream-sync-YYYYMMDD origin/main
git merge --no-ff upstream/main
# Resolve any conflicts, including code, manifests and map assets.
npm run inst
npm run typecheck
npm test
npm run lint
npm run format:check
npm run build-prod
git push -u origin maintenance/upstream-sync-YYYYMMDD
# Open PR: base LeviCade/OpenFrontIO-X:main; head same repository maintenance/... branch.
\`\`\`

If local branch already exists, use a new unique name. Never enable blind automated merges of upstream into \`main\`, never force-push \`main\`, and never create PRs into \`openfrontio/OpenFrontIO\`. Automatic checks/notifications are fine; merges require review.

### Why an isolated rider?

A pure map-resampling module and small integration hooks will minimize merge conflicts. Updating the game still requires regression tests when upstream changes map representation, configuration schemas, rendering or deterministic simulation.

### Licensing checkpoint

- OpenFront source: AGPL-3.0. Preserve original source notices and applicable attribution.
- \`/resources\` assets: separate CC BY-SA 4.0 terms.
- \`/proprietary\` assets: restricted per \`proprietary/LICENSE\`, **not** generally reusable or redistributable on the strength of the source code license.
- Audit and replace/remove restricted assets as required for independently distributed or publicly hosted builds. Document attribution and modifications accurately. Avoid implying OpenFront Inc. endorses OpenFrontIO-X.
