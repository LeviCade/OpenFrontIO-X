# Repository CI routing policy

**Current repository visibility: PUBLIC. Owner policy updated November 17, 2026.**

- **Standard free-compatible public workloads:** GitHub-hosted runners.
- **Public workloads requiring paid hosted capacity or a specialized capability/resource class unavailable on the free offering:** an explicitly authorized Skybot profile may be used after exact-repository public admission and arbitrary-code isolation acceptance.
- **Private visibility:** all jobs use owner-operated Skybot compute only.

This is per-job routing, not an automatic fallback. GitHub Actions does not transfer a queued or failed hosted job to Skybot; the workflow must explicitly select an approved runner profile.

The current Skybot controller does NOT yet implement public-repository admission. Do not add self-hosted Skybot labels or enable public Skybot jobs until the controller, hardware/capability, and public-code isolation gates in [Skybot-CI #238](https://github.com/LeviCade/Skybot-CI/issues/238) and [#239](https://github.com/LeviCade/Skybot-CI/issues/239) pass.

Keep existing free-compatible public workflows on GitHub-hosted runners. Do not move the whole repository to Skybot for uniformity. Public code, including fork PR code, is untrusted; never run it on the persistent development runner or expose host mounts, host sockets, controller credentials, signing keys or private secrets.

Canonical policy: [Skybot-CI compute routing](https://github.com/LeviCade/Skybot-CI/blob/main/docs/PRIVATE_PUBLIC_CI_POLICY.md).
Practical guide: [Skybot-CI runner choices](https://github.com/LeviCade/Skybot-CI/blob/main/docs/CI_RUNNER_CHOICES.md).
