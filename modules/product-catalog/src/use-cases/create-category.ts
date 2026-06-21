import { categoryInputSchema } from "../schemas";
import { catalogId, isoNow } from "../service";
import type { Actor, CatalogCategory } from "../types";
import { err, hooks, ok, type CatalogDeps } from "./shared";

export async function createCategory(input: unknown, deps: CatalogDeps & { actor?: Actor | null }) {
  const filtered = await hooks(deps).beforeCategoryCreate(input);
  const parsed = categoryInputSchema.safeParse(filtered);
  if (!parsed.success) {
    return err(400, "product-catalog.INVALID_CATEGORY_INPUT", "Category input is invalid.", parsed.error.issues);
  }

  const now = isoNow(deps.now);
  const category: CatalogCategory = {
    id: catalogId("cat"),
    tenantId: parsed.data.tenantId,
    name: parsed.data.name.trim(),
    description: parsed.data.description ?? null,
    color: parsed.data.color,
    active: true,
    createdAt: now,
    updatedAt: now
  };

  await deps.productCatalogStore.insertCategory(category);
  await deps.productCatalogStore.writeEvent({
    eventName: "product-catalog.category_created",
    entityType: "category",
    entityId: category.id,
    tenantId: category.tenantId,
    payload: { actorId: deps.actor?.id ?? null, name: category.name }
  });
  await hooks(deps).afterCategoryUpdated(category);

  return ok(201, { category });
}
