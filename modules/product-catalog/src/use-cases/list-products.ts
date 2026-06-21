import { productFilterSchema } from "../schemas";
import { enrichProduct, err, ok, type CatalogDeps } from "./shared";

export async function listProducts(input: unknown, deps: CatalogDeps) {
  const parsed = productFilterSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "product-catalog.INVALID_PRODUCT_FILTER", "Product filter is invalid.", parsed.error.issues);
  }
  const products = await deps.productCatalogStore.listProducts(parsed.data);
  return ok(200, {
    products: await Promise.all(products.map((product) => enrichProduct(deps.productCatalogStore, product)))
  });
}
