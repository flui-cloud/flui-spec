# Contributing to Flui Spec

This repository defines the open `flui.yaml` manifest specification and
ships its reference TypeScript implementation
[`@flui-cloud/spec`](packages/flui-spec-js). It is published under
[Apache-2.0](LICENSE) and adopts the
[Flui Cloud organization-wide contribution guidelines](https://github.com/flui-cloud/.github/blob/main/CONTRIBUTING.md)
as the baseline. The sections below add what is specific to this repo.

## Quick start

```bash
git clone https://github.com/flui-cloud/flui-spec.git
cd flui-spec
pnpm install
pnpm -r test
pnpm -r build
```

## Repository layout

| Path | Purpose |
|---|---|
| `schemas/` | JSON Schema for each `kind` and `apiVersion` |
| `examples/` | Reference manifests used as documentation and tests |
| `docs/` | Narrative spec |
| `packages/flui-spec-js/` | Reference TypeScript implementation (npm: `@flui-cloud/spec`) |

## Three kinds of changes, three workflows

The cost of a change to a public spec scales with its blast radius. We
match the review workflow to that radius.

### 1. Editorial / examples / library bug fixes

Open a PR directly. Examples: typo in the docs, clarifying an existing
field's description, fixing a bug in the validator, adding a missing
test, improving an example.

No issue required. Reviewers focus on whether the change is correct and
whether tests cover it.

### 2. Additive, non-breaking spec changes

A new optional field, a new enum value, a new kind variant — anything
that an older parser would silently ignore without producing a wrong
result.

Open a PR with:

- The schema change in `schemas/`.
- The corresponding TypeScript types under
  `packages/flui-spec-js/src/types/`.
- An updated example demonstrating the new field, if it is user-facing.
- A `CHANGELOG.md` entry.
- A test that exercises the new behaviour.

Until the spec is promoted to `v1`, additive changes do **not** require
a separate RFC, but the PR description must explain the use case.

Mark fields whose semantics may still evolve with
`x-flui-experimental: true` in the JSON Schema. They can be tightened
or removed in any minor `0.x` release of `@flui-cloud/spec` without
counting as a breaking change.

### 3. Breaking spec changes (RFC)

Anything that changes the meaning of an existing field, removes a field,
narrows an accepted value, or changes default behaviour.

1. **Open an issue** prefixed `rfc:` describing the motivation, the
   proposed change, the migration story for existing manifests, and
   the impact on consumers (`flui.api`, dashboard, CLI tools).
2. Allow **at least seven days** for feedback before opening the PR.
3. The PR introduces the new behaviour under a new `apiVersion`
   (e.g. `flui.cloud/v2beta1`) and keeps the previous `apiVersion`
   accepted by the validator with a deprecation notice in
   `CHANGELOG.md`.

## Versioning policy

Three independent version axes. Get them straight before proposing
changes:

| Axis | Where it lives | Bumps when |
|---|---|---|
| `apiVersion` of the manifest | YAML files, JSON Schema `const` | Breaking change to the spec |
| `@flui-cloud/spec` npm version | `packages/flui-spec-js/package.json` | Any release of the library |
| Git tag of the spec docs | repo tags | Documentation releases |

Until the manifest is promoted from `flui.cloud/v1beta1` to
`flui.cloud/v1`, the npm package stays on `0.x.y`. The promotion to
`v1` happens when:

- At least six months have passed without a breaking change.
- No field carries `x-flui-experimental: true`.
- At least two independent implementations have used the spec in
  production.

## Quality bar

This repository runs **SonarCloud** on every pull request through the
`SonarCloud Code Analysis` GitHub status check. The PR cannot be merged
until the quality gate passes.

The active gate enforces, on **new code only**:

- Coverage **≥ 90%**.
- Zero new bugs, vulnerabilities and security hotspots.
- Maintainability, reliability and security ratings of **A**.
- Duplications **≤ 3%**.

The current overall metrics are visible from the SonarCloud badges in
the [README](README.md). When the gate fails, click through to
SonarCloud — the comment on your PR explains what changed and why.

Local pre-flight before pushing:

```bash
pnpm -r test          # all suites must pass
pnpm --filter @flui-cloud/spec exec vitest run --coverage
                      # generates coverage/lcov.info, mirrors what CI uploads
```

## Releasing `@flui-cloud/spec`

Release process is documented in
[`packages/flui-spec-js/RELEASING.md`](packages/flui-spec-js/RELEASING.md)
when present, and is restricted to repository maintainers.

## Questions

For design questions and open-ended discussion, use
[GitHub Discussions](https://github.com/flui-cloud/flui-spec/discussions)
on this repository rather than email.
