import { json } from "@sveltejs/kit";

export function toSvelteKitResponse(result: {
  ok: boolean;
  status: number;
  data?: unknown;
  error?: unknown;
}) {
  if (!result.ok) {
    return json({ ok: false, error: result.error }, { status: result.status });
  }

  return json({ ok: true, data: result.data }, { status: result.status });
}
