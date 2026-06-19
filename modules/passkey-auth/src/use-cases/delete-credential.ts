import { ok, err } from "@microservices-sh/connection-contract";
import { passkeyMeta } from "../meta";
import type { PasskeyStore } from "../ports";
import type { EmitFn } from "./emit";

export interface DeleteCredentialDeps {
  store: PasskeyStore;
  emit?: EmitFn;
  now?: () => number;
  correlationId?: string;
}

export interface DeleteCredentialInput {
  userId: string;
  credentialId: string;
}

// Session-gated. Delete one of the requesting user's passkeys. Delete is scoped to the
// owner: a request for a credential the user does not own is a 404, never a deletion.
export async function deleteCredential(input: DeleteCredentialInput, deps: DeleteCredentialDeps) {
  const meta = passkeyMeta(deps);
  const userId = String(input?.userId ?? "").trim();
  const credentialId = String(input?.credentialId ?? "").trim();
  if (!userId || !credentialId) {
    return err(400, { code: "passkey.INVALID_INPUT", message: "userId and credentialId are required." }, meta);
  }

  const deleted = await deps.store.deleteCredential(credentialId, userId);
  if (!deleted) {
    return err(404, { code: "passkey.NOT_FOUND", message: "Passkey not found." }, meta);
  }

  deps.emit?.("passkey.credential_deleted", { userId, credentialId });
  return ok(200, { deleted: true, credentialId }, meta);
}
