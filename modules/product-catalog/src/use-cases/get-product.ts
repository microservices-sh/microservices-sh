import { z } from "zod";
import { enrichProduct, err, ok, type CatalogDeps } from "./shared";

const getProductSchema = z.object({
  tenantId: z.string().min(1),
  productId: z.string().min(1)
});

export async function getProduct(input: unknown, deps: CatalogDeps) {
  const parsed = getProductSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "product-catalog.INVALID_GET_PRODUCT_INPUT", "Get product input is invalid.", parsed.error.issues);
  }
  const product = await deps.productCatalogStore.getProduct(parsed.data.tenantId, parsed.data.productId);
  if (!product) return err(404, "product-catalog.PRODUCT_NOT_FOUND", "Product not found.");
  return ok(200, { product: await enrichProduct(deps.productCatalogStore, product) });
}
