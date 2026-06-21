import assert from "node:assert/strict";
import test from "node:test";
import { availableTemplateList, isPrivateTemplate, orderedTemplateList, REPO_TEMPLATES } from "../src/template-registry.js";

test("private repo templates are hidden from public lists but available for exact-id create", () => {
  assert.equal(REPO_TEMPLATES["dot-ai-os"].visibility, "private");
  assert.equal(REPO_TEMPLATES["dot-ai-os"].status, "private-pilot");
  assert.equal(isPrivateTemplate("dot-ai-os"), true);

  assert.equal(
    availableTemplateList().some((template) => template.id === "dot-ai-os"),
    false
  );
  assert.equal(
    availableTemplateList({ includePrivate: true }).some((template) => template.id === "dot-ai-os"),
    true
  );
});

test("guided template ordering puts the default template first", () => {
  const publicIds = availableTemplateList().map((template) => template.id);
  const orderedIds = orderedTemplateList("booking-sveltekit").map((template) => template.id);

  assert.equal(orderedIds[0], "booking-sveltekit");
  assert.deepEqual(new Set(orderedIds), new Set(publicIds));
});
