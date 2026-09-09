import applicationSchemaJson from '../schemas/application.v1beta1.json';
import type { ApplicationExposure } from './types/application';

/**
 * The value a runtime must assume when a manifest omits `deploy.exposure`.
 *
 * Read from the schema rather than written again here, because `default` in JSON Schema is an
 * annotation: ajv does not fill it in (this package validates with `useDefaults` off, so a parsed
 * manifest carries `exposure: undefined` exactly as the author left it), and every consumer that
 * needs the resolved value has so far rebuilt it with its own literal. Two copies of a default is
 * two places for it to drift, and this particular default decides whether an application gets a
 * hostname, a certificate and a DNS record — a drift here is an application that runs and cannot
 * be reached.
 *
 * `application.test.ts` asserts this constant is the schema's own `default` and a member of its
 * own `enum`, so the schema stays the single source and this stays a read of it.
 */
export const APPLICATION_EXPOSURE_DEFAULT = (
  applicationSchemaJson as {
    properties: {
      deploy: { properties: { exposure: { default: string } } };
    };
  }
).properties.deploy.properties.exposure.default as ApplicationExposure;
