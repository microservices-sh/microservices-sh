export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS membership_credit_tiers",
    "Membership Credits module migration owns tiers."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "CREATE TABLE IF NOT EXISTS customer_credit_balances",
    "Membership Credits module migration owns credit balances."
  );
  assertFileIncludes(
    "migrations/0001_initial.sql",
    "balance_cents",
    "Membership Credits stores money as integer cents."
  );
  assertFileIncludes(
    "src/service/index.ts",
    "insufficient_credit_balance",
    "Membership Credits prevents overdrawing credits."
  );
}
