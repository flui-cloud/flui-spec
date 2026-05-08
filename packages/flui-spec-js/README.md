# @flui-cloud/spec

[![npm](https://img.shields.io/npm/v/@flui-cloud/spec.svg)](https://www.npmjs.com/package/@flui-cloud/spec)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=flui-cloud_flui-spec&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=flui-cloud_flui-spec)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=flui-cloud_flui-spec&metric=coverage)](https://sonarcloud.io/summary/new_code?id=flui-cloud_flui-spec)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](../../LICENSE)

Reference TypeScript implementation of the
[Flui `flui.yaml` manifest specification](https://github.com/flui-cloud/flui-spec).

Pure, dependency-light validator usable in Node, browsers (with a YAML
polyfill), CI pipelines and CLI tools. **Does not depend on NestJS or any
runtime framework.**

## Install

```bash
pnpm add @flui-cloud/spec
```

## Usage

```ts
import { parseYaml, validate } from '@flui-cloud/spec';

const manifest = parseYaml(rawYaml);     // throws on bad YAML
const result = validate(manifest);        // never throws

if (!result.valid) {
  for (const err of result.errors) {
    console.error(`${err.path} ${err.message}`);
  }
  process.exit(1);
}

console.log(`OK — kind=${result.manifest.kind} apiVersion=${result.manifest.apiVersion}`);
```

### CLI

```bash
npx @flui-cloud/spec validate ./flui.yaml
```

## What's validated

1. **Syntactic** — JSON Schema (Draft-07, validated with AJV).
2. **Semantic** — pure post-checks: dependency cycles in `kind: CatalogApp`
   `spec.components`, consistency of `metadata.clientFor` /
   `metadata.clientDefaultFor` / `spec.linkedBuildingBlocks`.

Anything that depends on runtime context (does the cluster exist? are the
credentials valid? is the DNS zone configured?) is **not** part of the spec —
it lives in the orchestrator that applies the manifest.

## License

[Apache-2.0](../../LICENSE).
