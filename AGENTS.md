# Repository CI routing policy

**Current repository visibility: PUBLIC (audited November 10, 2026).**

**PUBLIC repository → GitHub-hosted CI ONLY for every job**, including PRs, all branches, tests, builds, releases, deployments and matrices. Do not use `skybot-ci-ephemeral` or any owner-operated Skybot self-hosted runner while this repository is public. The public workflows inspected on November 10 already used GitHub-hosted `ubuntu-latest` and matched this rule. Preserve existing application tests and publish semantics.

For **any LeviCade repository that becomes PRIVATE**, the owner's opposite rule applies immediately: **private CI runs only on owned Skybot-CI hardware for all jobs and events, including normal pull requests**, never on GitHub-hosted machines. Do not treat private PRs as a special paid-hosted exception. Native Mac availability is an implementation feature gate, not a global CI routing policy. Do not silently change execution providers on a visibility transition; review/migrate workflow YAML accordingly.

Canonical policy: [Skybot-CI visibility-only routing](https://github.com/LeviCade/Skybot-CI/blob/main/docs/PRIVATE_PUBLIC_CI_POLICY.md).

## Engineering efficiency — local first

**BE EFFICIENT. SPEED UP ENGINEERING, NOT BY REMOVING REAL TESTS.** Run syntax/lint, fast unit tests, deterministic simulations, and basic fixes on available ChatGPT local compute **before** asking GitHub CI to repeat them. Keep authoritative PR/merge checks, required integration/platform/release checks, and any unique acceptance gates; avoid redundant push+PR full suites and cancel superseded non-release runs safely. Reuse immutable inputs; don't launch predictable no-op jobs or blind retries. **Preserve this repository's existing public GitHub-hosted runner policy.**

Owner-wide efficiency policy: https://github.com/LeviCade/Skybot-CI/issues/247.
