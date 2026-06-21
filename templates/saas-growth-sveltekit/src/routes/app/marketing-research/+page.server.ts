import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { runResearch } from "@microservices-sh/marketing-research";
import { marketingStore, demoListen, demoSynth } from "$lib/server/marketing-research";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, "/login");
  return {};
};

export const actions: Actions = {
  run: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { error: "Sign in to run research." });
    const fd = await request.formData();
    const topic = String(fd.get("topic") ?? "").trim();
    const channels = String(fd.get("channels") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Demo grants the marketing scopes directly; production derives them from RBAC.
    const actor = { id: locals.user.id, scopes: ["marketing.run", "marketing.read"] };
    const res = await runResearch(
      { topic, channels: channels.length ? channels : undefined },
      { store: marketingStore, listen: demoListen(), synthesizer: demoSynth(), now: () => Date.now(), actor }
    );

    if (res.ok) return { brief: res.data.brief };
    // Bad input is a form error; cite-or-refuse (422) is a first-class rendered state.
    if (res.status === 400) return fail(400, { error: "Enter a topic." });
    return { refused: res.error };
  }
};
