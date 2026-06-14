export interface HookResult<T> {
  ok: boolean;
  value?: T;
  warnings?: string[];
}

export interface IssueTokenDraft {
  subject: string;
  scopes: string[];
}

// Customization seam: narrow scopes, attach claims, or reject issuance before
// the gateway mints. Default is pass-through.
export async function beforeIssueToken(input: IssueTokenDraft): Promise<HookResult<IssueTokenDraft>> {
  return { ok: true, value: input };
}

export async function afterTokenIssued(input: { subject: string; scopes: string[] }) {
  return input;
}
