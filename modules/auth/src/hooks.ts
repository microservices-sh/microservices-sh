import type { MintTokenInput } from "./schemas";
import type { TokenClaims } from "./types";

// Customization seam: clamp or narrow requested scopes/ttl before signing.
// Default is pass-through. Override via config-hooks in a consuming app.
export async function beforeMintToken(input: MintTokenInput) {
  return input;
}

export async function afterTokenMinted(result: { claims: TokenClaims; token: string }) {
  return result;
}
