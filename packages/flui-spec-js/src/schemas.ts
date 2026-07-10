import catalogAppSchemaJson from '../schemas/catalog-app.v1beta1.json';
import applicationSchemaJson from '../schemas/application.v1beta1.json';
import accessPolicySchemaJson from '../schemas/access-policy.v1beta1.json';

export const catalogAppSchema: Record<string, unknown> =
  catalogAppSchemaJson as Record<string, unknown>;

export const applicationSchema: Record<string, unknown> =
  applicationSchemaJson as Record<string, unknown>;

export const accessPolicySchema: Record<string, unknown> =
  accessPolicySchemaJson as Record<string, unknown>;
