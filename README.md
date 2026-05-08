# Flui Spec

[![CI](https://github.com/flui-cloud/flui-spec/actions/workflows/ci.yml/badge.svg)](https://github.com/flui-cloud/flui-spec/actions/workflows/ci.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=flui-cloud_flui-spec&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=flui-cloud_flui-spec)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=flui-cloud_flui-spec&metric=coverage)](https://sonarcloud.io/summary/new_code?id=flui-cloud_flui-spec)
[![Maintainability](https://sonarcloud.io/api/project_badges/measure?project=flui-cloud_flui-spec&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=flui-cloud_flui-spec)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

Open specification of the **`flui.yaml`** application manifest — the declarative
format describing how an application is built, deployed, scaled, exposed and
linked to other building blocks on the [Flui Cloud](https://flui.cloud)
platform.

This repository contains:

- The narrative specification (under [`docs/`](./docs))
- JSON Schema definitions (under [`schemas/`](./schemas))
- Reference TypeScript types and a pure validator library
  (under [`packages/flui-spec-js/`](./packages/flui-spec-js)),
  published to npm as [`@flui-cloud/spec`](https://www.npmjs.com/package/@flui-cloud/spec)
- Example manifests (under [`examples/`](./examples))

The [`flui.api`](https://github.com/flui-cloud/flui.api) reference
implementation consumes this library; the spec itself is intentionally free
of any runtime dependency on it.

## Status

**`apiVersion: flui.cloud/v1beta1`** — the spec is published as `v1beta1`
following Kubernetes-style versioning. Breaking changes are still possible
during the beta phase; promotion to `v1` will happen once at least two
independent implementations have used the spec for six months without
breaking changes and no fields remain marked `x-flui-experimental`.

For backwards compatibility the validator currently also accepts the legacy
`apiVersion: flui/v1`.

## Two manifest kinds

A single `flui.yaml` file describes one of two kinds:

| `kind`        | Purpose                                                   |
|---------------|-----------------------------------------------------------|
| `Application` | An app built from source (e.g. a Next.js / NestJS repo)   |
| `CatalogApp`  | A pre-packaged catalog entry (e.g. PostgreSQL, Wordpress) |

```yaml
apiVersion: flui.cloud/v1beta1
kind: Application
metadata:
  name: my-api
deploy:
  port: 3000
  env:
    - name: NODE_ENV
      value: production
```

## Quickstart

```bash
pnpm add @flui-cloud/spec
```

```ts
import { parseYaml, validate } from '@flui-cloud/spec';

const manifest = parseYaml(rawYaml);
const result = validate(manifest);
if (!result.valid) {
  console.error(result.errors);
}
```

Or validate a `flui.yaml` from the command line without installing anything:

```bash
npx @flui-cloud/spec validate ./flui.yaml
```

## License

[Apache License 2.0](./LICENSE).
