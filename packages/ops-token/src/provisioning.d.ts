import type { mintOpsToken } from "./index";

export type OpsGrant = { ownerId: string; scopes: string[]; secret: string; expiresAt: number };

export type OpsProvisioningPlan = {
  opsToken: string;
  expiresAt: number;
  hermesSecretCommand: string;
  operateSecretCommand: string;
};

export function planOpsProvisioning(
  input: { grant: OpsGrant; hermesApp: string; operateApp: string },
  deps?: { mint?: typeof mintOpsToken }
): Promise<OpsProvisioningPlan>;
