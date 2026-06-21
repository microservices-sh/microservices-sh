import { categoryFilterSchema } from "../schemas";
import { err, ok, type CatalogDeps } from "./shared";

export async function listCategories(input: unknown, deps: CatalogDeps) {
  const parsed = categoryFilterSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "product-catalog.INVALID_CATEGORY_FILTER", "Category filter is invalid.", parsed.error.issues);
  }
  const categories = await deps.productCatalogStore.listCategories(parsed.data);
  return ok(200, { categories });
}
