import { accountFilterSchema } from "../schemas";
import { err, ok, type AccountingDeps } from "./shared";

export async function listAccounts(input: unknown, deps: AccountingDeps) {
  const parsed = accountFilterSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounting-core.INVALID_ACCOUNT_FILTER", "Account filter is invalid.", parsed.error.issues);
  }

  const accounts = await deps.accountingCoreStore.listAccounts(parsed.data);
  return ok(200, { accounts });
}
