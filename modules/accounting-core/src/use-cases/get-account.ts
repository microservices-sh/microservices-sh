import { accountIdentitySchema } from "../schemas";
import { err, ok, type AccountingDeps } from "./shared";

export async function getAccount(input: unknown, deps: AccountingDeps) {
  const parsed = accountIdentitySchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounting-core.INVALID_ACCOUNT_IDENTITY", "Account lookup input is invalid.", parsed.error.issues);
  }

  const account = await deps.accountingCoreStore.getAccount(parsed.data.tenantId, parsed.data.accountId);
  if (!account) return err(404, "accounting-core.ACCOUNT_NOT_FOUND", "Account not found.");

  return ok(200, { account });
}
