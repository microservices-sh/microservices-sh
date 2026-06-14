import type { PageServerLoad } from "./$types";
import { listCustomers } from "@microservices-sh/customer";

export const load: PageServerLoad = async ({ locals }) => {
  const result = await listCustomers({ customerRepository: locals.customerRepository });
  return {
    customers: result.data.customers
  };
};
