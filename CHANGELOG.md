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
