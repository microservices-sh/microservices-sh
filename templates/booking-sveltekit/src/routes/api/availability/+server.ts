import type { RequestHandler } from "./$types";
import { getAvailability } from "@microservices-sh/booking";
import { toSvelteKitResponse } from "$lib/server/adapters/sveltekit-response";

export const GET: RequestHandler = async ({ url, locals }) => {
  const result = await getAvailability(
    {
      serviceId: url.searchParams.get("serviceId") ?? "",
      date: url.searchParams.get("date") ?? ""
    },
    { bookingRepository: locals.bookingRepository }
  );
  return toSvelteKitResponse(result);
};
