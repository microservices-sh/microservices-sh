export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "src/authz.ts",
    "hasPermission",
    "Admin actions are gated by an explicit permission check."
  );
  assertFileIncludes(
    "src/use-cases/list-records.ts",
    "FORBIDDEN",
    "List enforces the resource read permission before returning data."
  );
  assertFileIncludes(
    "src/use-cases/delete-record.ts",
    "softDelete",
    "Delete respects a resource's soft-delete configuration instead of always hard-deleting."
  );
  assertFileIncludes(
    "src/adapters/d1-table-gateway.ts",
    "Unsafe identifier",
    "The generic SQL builder whitelists identifiers from the definition (injection-safe)."
  );
}
