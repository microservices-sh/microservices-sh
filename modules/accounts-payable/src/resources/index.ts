export const resources = [
  {
    type: "d1",
    binding: "DB",
    tables: [
      "accounts_payable_vendors",
      "accounts_payable_bills",
      "accounts_payable_bill_line_items",
      "accounts_payable_bill_payments",
      "accounts_payable_bill_payment_applications",
      "accounts_payable_recurring_bill_templates",
      "accounts_payable_recurring_bill_line_items",
      "domain_events"
    ]
  }
] as const;
