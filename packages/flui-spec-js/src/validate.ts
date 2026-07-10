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
  const deploy = manifest.deploy;
  if (!deploy) return warnings;

  const NOT_APPLIED = 'accepted by the spec but not yet applied on source deploys';

  if (deploy.resources?.profile !== undefined) {
    warnings.push({
      path: '/deploy/resources/profile',
      message: `resources.profile is ${NOT_APPLIED} — set resources.requests/limits instead (no effect at runtime yet).`,
    });
  }
  if (deploy.scaling !== undefined) {
    warnings.push({
      path: '/deploy/scaling',
      message: `deploy.scaling is ${NOT_APPLIED} — autoscaling is not configured from the manifest yet; the app runs at a single replica.`,
    });
  }
  (deploy.env ?? []).forEach((e, i) => {
    if (e.valueFrom !== undefined) {
      warnings.push({
        path: `/deploy/env/${i}/valueFrom`,
        message: `env "${e.name}".valueFrom is ${NOT_APPLIED} — only env vars with a literal value are injected today; this one will be dropped.`,
      });
    }
    if (e.secret !== undefined) {
      warnings.push({
        path: `/deploy/env/${i}/secret`,
        message: `env "${e.name}".secret is ${NOT_APPLIED} (no effect at runtime yet).`,
      });
    }
    if (e.userEditable !== undefined) {
      warnings.push({
        path: `/deploy/env/${i}/userEditable`,
        message: `env "${e.name}".userEditable is ${NOT_APPLIED} (no effect at runtime yet).`,
      });
    }
    if (e.value === undefined && e.valueFrom === undefined) {
      warnings.push({
        path: `/deploy/env/${i}`,
        message: `env "${e.name}" has neither value nor valueFrom — it will not be injected.`,
      });
    }
  });

  return warnings;
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

function formatAjvErrors(errors: ErrorObject[]): FluiValidationError[] {
  return errors.map((e) => {
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
    return {
      path,
      message: e.message ?? 'invalid',
      params: e.params as Record<string, unknown> | undefined,
    };
  });
}

function failed(errors: FluiValidationError[]): FluiValidationResult {
  return { valid: false, manifest: null, errors, warnings: [] };
}
