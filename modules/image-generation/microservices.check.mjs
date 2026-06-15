export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_image_generation.sql",
    "CREATE TABLE IF NOT EXISTS image_generations",
    "Image Generation migration owns the image_generations table."
  );
  assertFileIncludes(
    "src/keys.ts",
    "buildImageKey",
    "Image object keys are built through a single tenant-scoped helper."
  );
  assertFileIncludes(
    "src/service/index.ts",
    "generateWithFallback",
    "Generation selects a provider with fallback when the default fails."
  );
  assertFileIncludes(
    "src/use-cases/delete-image.ts",
    "keyBelongsToTenant",
    "Deletes verify the object belongs to the caller's tenant before removing it."
  );
}
