import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { catalogAppSchema, applicationSchema, accessPolicySchema } from './schemas';
import type { CatalogAppManifest, CatalogComponent } from './types/catalog-app';
import type { ApplicationManifest } from './types/application';
import type { AccessPolicyManifest } from './types/access-policy';
import type { FluiManifest } from './types';

export interface FluiValidationError {
  path: string;
  message: string;
  params?: Record<string, unknown>;
}

/**
 * A non-fatal advisory. Emitted when a manifest uses a field the spec accepts
 * but the runtime does not yet apply (`x-flui-status: planned`). Warnings never
 * make a manifest invalid — they tell the author (or an LLM) the field will
 * have no effect at runtime yet.
 */
export interface FluiValidationWarning {
  path: string;
  message: string;
}

export type FluiValidationResult =
  | {
      valid: true;
      manifest: FluiManifest;
      errors: [];
      warnings: FluiValidationWarning[];
    }
  | {
      valid: false;
      manifest: null;
      errors: FluiValidationError[];
      warnings: [];
    };

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validateCatalogApp: ValidateFunction = ajv.compile(catalogAppSchema);
const validateApplication: ValidateFunction = ajv.compile(applicationSchema);
const validateAccessPolicy: ValidateFunction = ajv.compile(accessPolicySchema);

export function validate(parsed: unknown): FluiValidationResult {
  if (!parsed || typeof parsed !== 'object') {
    return failed([
      { path: '<root>', message: 'manifest must be a YAML mapping' },
    ]);
  }

  const kind = (parsed as { kind?: unknown }).kind;

  if (kind === 'CatalogApp') {
    return validateCatalogAppManifest(parsed);
  }
  if (kind === 'Application') {
    return validateApplicationManifest(parsed);
  }
  if (kind === 'AccessPolicy') {
    return validateAccessPolicyManifest(parsed);
  }
  return failed([
    {
      path: '/kind',
      message:
        'unsupported kind — expected "Application", "CatalogApp", or "AccessPolicy"',
      params: { received: kind },
    },
  ]);
}

function validateAccessPolicyManifest(
  parsed: unknown,
): FluiValidationResult {
  if (!validateAccessPolicy(parsed)) {
    return failed(formatAjvErrors(validateAccessPolicy.errors ?? []));
  }
  return {
    valid: true,
    manifest: parsed as AccessPolicyManifest,
    errors: [],
    warnings: [],
  };
}

function validateCatalogAppManifest(
  parsed: unknown,
): FluiValidationResult {
  if (!validateCatalogApp(parsed)) {
    return failed(formatAjvErrors(validateCatalogApp.errors ?? []));
  }
  const manifest = parsed as CatalogAppManifest;
  const semantic = runCatalogSemanticChecks(manifest);
  if (semantic.length > 0) {
    return failed(semantic);
  }
  return { valid: true, manifest, errors: [], warnings: [] };
}

function validateApplicationManifest(
  parsed: unknown,
): FluiValidationResult {
  if (!validateApplication(parsed)) {
    return failed(formatAjvErrors(validateApplication.errors ?? []));
  }
  const manifest = parsed as ApplicationManifest;
  const semantic = runApplicationSemanticChecks(manifest);
  if (semantic.length > 0) {
    return failed(semantic);
  }
  return {
    valid: true,
    manifest,
    errors: [],
    warnings: collectApplicationWarnings(manifest),
  };
}

/**
 * Advisories for `x-flui-status: planned` fields present in a valid Application
 * manifest — kept in lockstep with the `planned` tags in
 * `schemas/application.v1beta1.json` (see application.test.ts, which asserts
 * every path here is tagged planned in the schema).
 */
function collectApplicationWarnings(
  manifest: ApplicationManifest,
): FluiValidationWarning[] {
  const warnings: FluiValidationWarning[] = [];
  if (manifest.build?.strategy === 'auto') {
    warnings.push({
      path: '/build/strategy',
      message:
        'build.strategy "auto" (framework detection) is deprecated — add a Dockerfile and use strategy "dockerfile". It is still accepted.',
    });
  }
  const deploy = manifest.deploy;
  if (!deploy) return warnings;

  const NOT_APPLIED = 'accepted by the spec but not yet applied on source deploys';

  if (deploy.resources?.profile !== undefined) {
    warnings.push({
      path: '/deploy/resources/profile',
      message: `resources.profile is ${NOT_APPLIED} — set resources.requests/limits instead (no effect at runtime yet).`,
    });
  }

  const env = deploy.env;
  if (Array.isArray(env)) {
    warnings.push(...legacyEnvWarnings(env, NOT_APPLIED));
  } else if (env && typeof env === 'object') {
    warnings.push(...mapEnvWarnings(env, NOT_APPLIED));
  }

  return warnings;
}

type LegacyEnv = Extract<NonNullable<NonNullable<ApplicationManifest['deploy']>['env']>, unknown[]>;
type MapEnv = Exclude<NonNullable<NonNullable<ApplicationManifest['deploy']>['env']>, unknown[]>;

function legacyEnvWarnings(env: LegacyEnv, notApplied: string): FluiValidationWarning[] {
  return [
    {
      path: '/deploy/env',
      message:
        'the array form of deploy.env is deprecated — prefer the map form { NAME: value }. The array is still accepted and applied.',
    },
    ...env.flatMap((e, i) => [
      ...(e.userEditable === undefined
        ? []
        : [{ path: `/deploy/env/${i}/userEditable`, message: `env "${e.name}".userEditable is ${notApplied} (no effect at runtime yet).` }]),
      ...(e.value === undefined && e.valueFrom === undefined
        ? [{ path: `/deploy/env/${i}`, message: `env "${e.name}" has neither value nor valueFrom — it will not be injected.` }]
        : []),
    ]),
  ];
}

function mapEnvWarnings(env: MapEnv, notApplied: string): FluiValidationWarning[] {
  return Object.entries(env).flatMap(([name, entry]) => {
    if (typeof entry === 'string') return []; // literal shorthand — applied today
    return [
      // `runtime` is the default and is applied; `build` is refused as an error, not warned about.
      ...(entry.delivery === 'browser'
        ? [{ path: `/deploy/env/${name}/delivery`, message: `env "${name}".delivery: browser is ${notApplied} — the value is delivered as a runtime container env var instead. vOps does apply it, rendering the value into deploy.browserConfig.path.` }]
        : []),
      ...(entry.value === undefined && entry.valueFrom === undefined
        ? [{ path: `/deploy/env/${name}`, message: `env "${name}" has neither value nor valueFrom — it will not be injected.` }]
        : []),
    ];
  });
}

/**
 * The one thing a manifest may declare that is refused rather than warned about.
 *
 * A build argument is baked into the image, so it is invariant across environments by
 * construction; under `deploy.env` it would look like a runtime value that can vary per
 * environment, and nothing in this block could make that true. Warning about it would let a
 * caller believe a value reached the build when it never did.
 */
function runApplicationSemanticChecks(
  manifest: ApplicationManifest,
): FluiValidationError[] {
  const env = manifest.deploy?.env;
  if (!env || Array.isArray(env)) return [];
  return Object.entries(env).flatMap(([name, entry]) =>
    typeof entry !== 'string' && entry.delivery === 'build'
      ? [{
          path: `/deploy/env/${name}/delivery`,
          message: `env "${name}" uses delivery: build. A build argument is baked into the image and cannot vary by environment, so it belongs in build.args — declare it as build.args.${name} and remove it from deploy.env.`,
        }]
      : [],
  );
}

function runCatalogSemanticChecks(
  manifest: CatalogAppManifest,
): FluiValidationError[] {
  const errors: FluiValidationError[] = [];

  if (manifest.spec.type === 'composed') {
    const cycleErr = detectCycles(manifest.spec.components);
    if (cycleErr) errors.push(cycleErr);
  }

  errors.push(...validateClientLinking(manifest));
  return errors;
}

function validateClientLinking(
  manifest: CatalogAppManifest,
): FluiValidationError[] {
  const errors: FluiValidationError[] = [];
  const clientFor = manifest.metadata.clientFor ?? [];
  const clientDefaultFor = manifest.metadata.clientDefaultFor ?? [];
  const clientForSet = new Set(clientFor);

  for (const slug of clientDefaultFor) {
    if (!clientForSet.has(slug)) {
      errors.push({
        path: '/metadata/clientDefaultFor',
        message: `entry "${slug}" must also appear in metadata.clientFor`,
        params: { ref: slug },
      });
    }
  }

  if (manifest.spec.type !== 'standalone') return errors;
  const linked = manifest.spec.linkedBuildingBlocks ?? [];
  const seenRefs = new Set<string>();
  for (const link of linked) {
    if (seenRefs.has(link.ref)) {
      errors.push({
        path: '/spec/linkedBuildingBlocks',
        message: `duplicate ref "${link.ref}"`,
        params: { ref: link.ref },
      });
      continue;
    }
    seenRefs.add(link.ref);
    if (!clientForSet.has(link.ref)) {
      errors.push({
        path: '/spec/linkedBuildingBlocks',
        message: `ref "${link.ref}" must appear in metadata.clientFor`,
        params: { ref: link.ref },
      });
    }
  }
  return errors;
}

function detectCycles(
  components: CatalogComponent[],
): FluiValidationError | null {
  const graph = new Map<string, string[]>();
  for (const c of components) graph.set(c.name, c.dependsOn ?? []);

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const name of graph.keys()) color.set(name, WHITE);

  let result: FluiValidationError | null = null;

  const visit = (node: string, path: string[]): void => {
    if (result) return;
    if (color.get(node) === GRAY) {
      result = {
        path: '/spec/components',
        message: `cycle detected in components.dependsOn: ${[...path, node].join(' -> ')}`,
      };
      return;
    }
    if (color.get(node) === BLACK) return;
    color.set(node, GRAY);
    for (const dep of graph.get(node) ?? []) {
      if (!graph.has(dep)) {
        result = {
          path: '/spec/components',
          message: `component "${node}" dependsOn unknown component "${dep}"`,
          params: { component: node, missing: dep },
        };
        return;
      }
      visit(dep, [...path, node]);
      if (result) return;
    }
    color.set(node, BLACK);
  };

  for (const name of graph.keys()) {
    visit(name, []);
    if (result) return result;
  }
  return null;
}

/**
 * `#/definitions/exposureRules` in `application.v1beta1.json` says which of `port`, `domain` and
 * `healthcheck.path` a given `deploy.exposure` allows. Ajv can enforce that; it cannot say it. A
 * refused `port` comes back as `boolean schema is false`, and the `if` keyword adds a second,
 * emptier line — a reader learns that something is wrong at `/deploy/port` and nothing about why,
 * on a rule whose whole point is a distinction between two shapes.
 *
 * So each branch of that one subschema gets its sentence here, keyed by `schemaPath` (stable
 * because the rules live in a named definition, not inline), and the bare `if` line is dropped.
 * Nothing else in this file rewrites an ajv message: this is the one rule the schema states
 * structurally and the author has to read in prose.
 */
const EXPOSURE_RULES = '#/definitions/exposureRules';

const EXPOSURE_RULE_MESSAGES: Record<string, string> = {
  '#/definitions/exposureRules/then/properties/port/false schema':
    'deploy.port must not be set when exposure is none: a workload with no exposure listens on nothing, so there is no port to publish. Remove deploy.port, or choose exposure: public or internal.',
  '#/definitions/exposureRules/then/properties/domain/false schema':
    'deploy.domain must not be set when exposure is none: a domain names a way in, and none is the declaration that there is no way in. Remove deploy.domain, or choose exposure: public.',
  '#/definitions/exposureRules/then/properties/healthcheck/properties/path/false schema':
    'deploy.healthcheck.path must not be set when exposure is none: an HTTP probe needs a port to reach and none has none. Use an exec probe (healthcheck.type: exec with command) or remove the probe.',
  '#/definitions/exposureRules/else/required':
    "must have required property 'port' — declare the port the application listens on inside the container. A workload that listens on nothing (a worker, a queue consumer) declares exposure: none instead, and then has no port.",
};

function exposureRuleError(e: ErrorObject): FluiValidationError | null {
  // `must match "then"/"else" schema`: true, and it says nothing the branch error below does not
  // say better. Dropped so the author reads one sentence, not two.
  if (e.keyword === 'if') return null;

  const message = EXPOSURE_RULE_MESSAGES[e.schemaPath];
  if (!message) return null;

  const missing =
    e.keyword === 'required'
      ? (e.params as { missingProperty?: string }).missingProperty
      : undefined;
  return {
    path: missing ? `${e.instancePath}/${missing}` : e.instancePath || '<root>',
    message,
    params: { exposureRule: true, ...(e.params as Record<string, unknown>) },
  };
}

function formatAjvErrors(errors: ErrorObject[]): FluiValidationError[] {
  return errors.flatMap((e) => {
    if (e.schemaPath.startsWith(EXPOSURE_RULES)) {
      const rewritten = exposureRuleError(e);
      return rewritten ? [rewritten] : [];
    }
    // For `required`, ajv reports the parent object's path with the missing key
    // in params. Point the error at the missing field itself — friendlier for
    // humans and for LLMs consuming the error list.
    const missing =
      e.keyword === 'required'
        ? (e.params as { missingProperty?: string }).missingProperty
        : undefined;
    const path = missing
      ? `${e.instancePath}/${missing}`
      : e.instancePath || '<root>';
    return [
      {
        path,
        message: e.message ?? 'invalid',
        params: e.params as Record<string, unknown> | undefined,
      },
    ];
  });
}

function failed(errors: FluiValidationError[]): FluiValidationResult {
  return { valid: false, manifest: null, errors, warnings: [] };
}
