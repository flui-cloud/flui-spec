import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { catalogAppSchema } from './schemas';
import type { CatalogAppManifest, CatalogComponent } from './types/catalog-app';
import type { ApplicationManifest } from './types/application';
import type { FluiManifest } from './types';

export interface FluiValidationError {
  path: string;
  message: string;
  params?: Record<string, unknown>;
}

export type FluiValidationResult =
  | { valid: true; manifest: FluiManifest; errors: [] }
  | { valid: false; manifest: null; errors: FluiValidationError[] };

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validateCatalogApp: ValidateFunction = ajv.compile(catalogAppSchema);

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
  return failed([
    {
      path: '/kind',
      message:
        'unsupported kind — expected "Application" or "CatalogApp"',
      params: { received: kind },
    },
  ]);
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
  return { valid: true, manifest, errors: [] };
}

function validateApplicationManifest(
  parsed: unknown,
): FluiValidationResult {
  // Application schema not yet published as standalone JSON Schema —
  // perform minimal hand-written checks here for v1beta1. A full schema
  // will land before the v1 promotion.
  const errors: FluiValidationError[] = [];
  const m = parsed as Partial<ApplicationManifest>;

  if (m.apiVersion !== 'flui.cloud/v1beta1' && m.apiVersion !== 'flui/v1') {
    errors.push({
      path: '/apiVersion',
      message:
        'must be "flui.cloud/v1beta1" (or legacy "flui/v1")',
      params: { received: m.apiVersion },
    });
  }
  if (!m.metadata || typeof m.metadata.name !== 'string') {
    errors.push({
      path: '/metadata/name',
      message: 'metadata.name is required and must be a string',
    });
  } else if (!/^[a-z][a-z0-9-]{0,62}$/.test(m.metadata.name)) {
    errors.push({
      path: '/metadata/name',
      message:
        'metadata.name must match ^[a-z][a-z0-9-]{0,62}$',
      params: { received: m.metadata.name },
    });
  }
  if (!m.deploy || typeof m.deploy !== 'object') {
    errors.push({
      path: '/deploy',
      message: 'deploy is required and must be an object',
    });
  } else if (typeof m.deploy.port !== 'number') {
    errors.push({
      path: '/deploy/port',
      message: 'deploy.port is required and must be a number',
    });
  }

  if (errors.length > 0) return failed(errors);
  return { valid: true, manifest: parsed as ApplicationManifest, errors: [] };
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
  return errors.map((e) => ({
    path: e.instancePath || '<root>',
    message: e.message ?? 'invalid',
    params: e.params as Record<string, unknown> | undefined,
  }));
}

function failed(errors: FluiValidationError[]): FluiValidationResult {
  return { valid: false, manifest: null, errors };
}
