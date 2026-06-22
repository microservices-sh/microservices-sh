import assert from "node:assert/strict";
import test from "node:test";
import { availableTemplateList, filterTemplateList, isPrivateTemplate, orderedTemplateList, REPO_TEMPLATES } from "../src/template-registry.js";

const VISIBILITIES = new Set(["public", "private", "internal"]);
const DISTRIBUTIONS = new Set(["bundled", "registry", "private", "local"]);
const WEIGHTS = new Set(["light", "standard", "heavy"]);

test("private repo templates are hidden from public lists but available for exact-id create", () => {
  assert.equal(REPO_TEMPLATES["dot-ai-os"].visibility, "private");
  assert.equal(REPO_TEMPLATES["dot-ai-os"].status, "private-pilot");
  assert.equal(REPO_TEMPLATES["dot-ai-os"].distribution, "bundled");
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

test("repo templates declare distribution metadata for scale planning", () => {
  for (const template of Object.values(REPO_TEMPLATES)) {
    assert.ok(VISIBILITIES.has(template.visibility), `${template.id} has valid visibility`);
    assert.ok(DISTRIBUTIONS.has(template.distribution), `${template.id} has valid distribution`);
    assert.equal(typeof template.category, "string", `${template.id} has category`);
    assert.ok(template.category.length > 0, `${template.id} has non-empty category`);
    assert.ok(WEIGHTS.has(template.weight), `${template.id} has valid weight`);
  }
});

test("template filters support category and free-text discovery", () => {
  const templates = availableTemplateList();
  const saasIds = filterTemplateList(templates, { category: "saas" }).map((template) => template.id);
  const portalIds = filterTemplateList(templates, { search: "portal" }).map((template) => template.id);
  const frameworkIds = filterTemplateList(templates, { category: "framework" }).map((template) => template.id);

  assert.deepEqual(saasIds, ["saas-starter-sveltekit", "saas-growth-sveltekit"]);
  assert.ok(portalIds.includes("client-portal-sveltekit"));
  assert.ok(frameworkIds.includes("nextjs"));
});
