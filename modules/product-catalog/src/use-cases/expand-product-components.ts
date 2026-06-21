import { z } from "zod";
import { err, ok, type CatalogDeps } from "./shared";

const expandSchema = z.object({
  tenantId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.number().positive().default(1)
});

export async function expandProductComponents(input: unknown, deps: CatalogDeps) {
  const parsed = expandSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "product-catalog.INVALID_EXPAND_INPUT", "Expand input is invalid.", parsed.error.issues);
  }

  const product = await deps.productCatalogStore.getProduct(parsed.data.tenantId, parsed.data.productId);
  if (!product) return err(404, "product-catalog.PRODUCT_NOT_FOUND", "Product not found.");
  if (product.productType === "simple") {
    return ok(200, { components: [{ productId: product.id, quantity: parsed.data.quantity }] });
  }

  const components = await deps.productCatalogStore.listComboComponents(product.tenantId, product.id);
  return ok(200, {
    components: components.map((component) => ({
      productId: component.productId,
      quantity: component.quantity * parsed.data.quantity
    }))
  });
}
