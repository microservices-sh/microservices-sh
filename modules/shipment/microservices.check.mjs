export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS shipment_batches",
    "Shipment module migration owns shipment batches."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS shipment_items",
    "Shipment module migration owns shipment items."
  );
  assertFileIncludes(
    "migrations/0002_status_transitions.sql",
    "CREATE TABLE IF NOT EXISTS shipment_status_transitions",
    "Shipment module migration owns status transition history."
  );
  assertFileIncludes(
    "src/index.ts",
    "startShipmentProcessing",
    "Shipment module exports the processing transition use case."
  );
  assertFileIncludes(
    "src/index.ts",
    "listShipmentStatusTransitions",
    "Shipment module exports the transition history read use case."
  );
}
