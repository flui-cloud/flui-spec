# Changelog

All notable changes to the Flui Spec are documented here. The format is based
on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.0] - 2026-09-09

`deploy.exposure: none` — a manifest can finally say that a workload does not
listen, instead of having to invent a port for it.

### Added

- **`deploy.exposure: none`** — the third exposure: no port, no Service, no
  endpoint. For a worker, a queue consumer, anything whose job is not to answer
  requests. With `none`, `deploy.port`, `deploy.domain` and
  `deploy.healthcheck.path` are **refused** rather than ignored: a port with
  nothing to publish it, a domain naming a way in that will not exist, and an
  HTTP probe with no port to reach are each a mistake worth a message. An `exec`
  probe (`healthcheck.type: exec` with `command`) still works, because it needs
  no port.
- **`APPLICATION_EXPOSURE_DEFAULT`** — the package now exports the default
  `deploy.exposure` read from the schema itself. `default` in JSON Schema is an
  annotation and this validator does not materialise it (a parsed manifest keeps
  `exposure: undefined` exactly as written), so every consumer that needed the
  resolved value had been rebuilding it with its own `'public'` literal. The
  schema is the one source; this export is a read of it.

### Changed

- **`deploy.port` is required unless `exposure: none`.** It was unconditionally
  required. Every manifest valid before this release declares `port` and none
  declares `none`, so every one of them lands in the branch that requires exactly
  what it already had — measured, not assumed: 25 real `flui.yaml` in the engine
  corpus and 58 machine-rendered manifests, zero changes of verdict.
- **`exposure` is declared, never inferred.** A missing `deploy.port` is refused
  with a message that names `exposure: none` as the alternative; it is never read
  as "this must be a worker". Inferring one from the other would turn a forgotten
  port into a silently unreachable application, which is the failure this release
  exists to remove — not a new spelling for it.
- **`none` does not cover a scheduled job.** The spec has no field for a
  schedule. A cron deployed as a long-running workload restarts in a loop and
  reports healthy; `exposure: none` says nothing about that and must not be read
  as if it did.
- **TypeScript: `deploy` is now a union discriminated on `exposure`.** The
  `none` branch types `port`, `domain` and `healthcheck.path` as absent, so
  reading `manifest.deploy.port` needs a narrowing (`if (deploy.exposure ===
  'none')`) it did not need before. This is deliberate: a type that accepts what
  the validator rejects is worse than no type.

### Before publishing this version

This working tree carries more than the published `0.9.0` tarball does, from
work that landed after `0.9.0` was released without a version bump. Measured
against `@flui-cloud/spec@0.9.0` on npm, `deploy` gains `services`, `files`,
`smokeTest`, `replaceAtStart` and `browserConfig`; `build` gains `prepare`;
`healthcheck` gains its timing and `type`/`command` fields; `domain` gains
`httpsRequirement`. **None of those is implemented by flui-core**, and none is
tagged `x-flui-status: planned`, so publishing them as-is makes the validator
accept a manifest whose attached database will never exist, without a warning.
Decide that before tagging — it is not part of this entry's change.

## [Unreleased]

### Added

- Initial extraction of the `flui.yaml` manifest specification from
  [`flui.api`](https://github.com/flui-cloud/flui.api).
- `apiVersion: flui.cloud/v1beta1` introduced; legacy `flui/v1` accepted by
  the validator for backwards compatibility.
- JSON Schema for `kind: CatalogApp` (`schemas/catalog-app.v1beta1.json`).
- TypeScript types and pure validator under `@flui-cloud/spec`.

## [0.8.1] - 2026-07-17

`valueFrom.service` and `environments` are implemented — reflecting what the
runtime now resolves.

### Changed

- **`environments` is implemented** — a push (or `flui deploy`) on a branch bound
  to an environment overlays that profile onto the base manifest: its literal
  `env` values and the whitelisted `deploy` overrides (resources, scaling,
  domain). `build` is never overridden, so the same image is promoted across
  environments. Resolution is branch-scoped; a plain validate (no branch) reports
  the base spec. The `planned` tag and the `/environments` warning are removed.
- **`valueFrom.service` is implemented** — a `service` reference now resolves on
  source deploys to the sibling app's in-cluster Service address
  (`http://<slug>-svc.<namespace>.svc.cluster.local:<port>`, or `host`/`port`
  alone). App-to-app traffic stays inside the cluster; it does not round-trip the
  public ingress. Matched by slug within the same cluster and — when both apps are
  assigned to one — the same project. The `planned` tag moved off the `valueFrom`
  property onto the still-planned `generate` and `userInput` branches.
- **Validation no longer warns about `valueFrom.secretRef` or `valueFrom.service`**
  — both are applied. The "will be dropped" advisory now fires only for
  `generate` / `userInput`, which the runtime still ignores.

### Fixed

- The `valueFrom.service` `key: url` default is documented as the in-cluster URL
  (it was described as a public URL, which was never the resolution target).

## [0.8.0] - 2026-07-17

Configuration & environments redesign for `kind: Application`. The
`apiVersion` stays `flui.cloud/v1beta1`: every 0.7.0 manifest keeps validating,
so the bump is additive at the wire level even though the recommended shape
changes.

### Added

- **`deploy.env` map form** — `deploy.env` now accepts a map
  `{ ENV_NAME: <value | spec> }`, where a bare string is shorthand for
  `{ value: … }`. This is the preferred form; it removes the merge-key ambiguity
  of the list form and reads as one config matrix in a diff.
- **`deploy.env[].delivery`** (`runtime` | `browser` | `build`) — declares how a
  value reaches the app: a container env var (server-side), rendered to
  `/flui-env.js` for static/SPA builds, or a Docker build ARG. `planned`.
- **`build.args`** — Docker build ARGs (`--build-arg`), env-independent and baked
  into the image. Implemented (the build already reads them); previously the
  schema rejected the field.
- **`valueFrom.service`** — reference another Flui app in the same project;
  resolved to its endpoint in the current environment's scope. `planned`.
- **`environments`** (top-level) — named per-environment profiles with a `branch`
  binding, a whitelisted `deploy` override (no `build` → artifact promotion is
  preserved) and literal-only `env` overrides. `planned`.

### Changed

- The **array form of `deploy.env` is deprecated** (still accepted and applied
  unchanged; validation emits a deprecation warning). Migrate to the map form.

## [0.7.0] - 2026-07-10

### Added

- JSON Schema for `kind: Application`
  (`schemas/application.v1beta1.json`) — the source-code deploy manifest, now
  ajv-validated like `CatalogApp`. Resolves the previously-dangling
  `./schemas/application.v1beta1.json` package export.
- JSON Schema, TypeScript types and validator for `kind: AccessPolicy`
  (`schemas/access-policy.v1beta1.json`) — management-plane access grants.
- Validation warnings channel: `FluiValidationResult.warnings[]` and the
  `FluiValidationWarning` type. Fields the spec accepts but the runtime does not
  yet apply are tagged `x-flui-status: "planned"` in the schema and surfaced as
  warnings (not errors) — a deliberately broad forward contract.
- `applicationSchema` exported alongside `catalogAppSchema` /
  `accessPolicySchema`.
- `ApplicationManifest` `deploy.domain.fqdn` (explicit apex/cross-zone FQDN).

### Changed

- `kind: Application` is now validated against the JSON Schema instead of
  minimal hand-written checks (all errors reported at once).
- `required`-field errors now point at the missing field
  (e.g. `/deploy/port`) rather than the parent object.
