# Changelog

All notable changes to the Flui Spec are documented here. The format is based
on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial extraction of the `flui.yaml` manifest specification from
  [`flui.api`](https://github.com/flui-cloud/flui.api).
- `apiVersion: flui.cloud/v1beta1` introduced; legacy `flui/v1` accepted by
  the validator for backwards compatibility.
- JSON Schema for `kind: CatalogApp` (`schemas/catalog-app.v1beta1.json`).
- TypeScript types and pure validator under `@flui-cloud/spec`.

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
