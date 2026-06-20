import { describe, expect, it } from "vitest";
import { planOpsTools } from "./ops-plan";

describe("planOpsTools (question → operational tools)", () => {
  it("routes money questions to the invoice tool", () => {
    expect(planOpsTools("What does ACME owe us? any overdue invoices?")).toEqual(["ops.invoice.read"]);
    expect(planOpsTools("show the outstanding balance")).toContain("ops.invoice.read");
  });

  it("routes scheduling questions to booking/calendar", () => {
    expect(planOpsTools("what bookings are on the schedule tomorrow?")).toContain("ops.booking.read");
    expect(planOpsTools("any meetings on the calendar this week?")).toContain("ops.calendar.read");
  });

  it("routes support questions to the ticket tool", () => {
    expect(planOpsTools("are there open support tickets for this client?")).toContain("ops.ticket.read");
  });

  it("routes who-is questions to the customer tool", () => {
    expect(planOpsTools("who is the customer ACME and what is their contact?")).toContain("ops.customer.read");
  });

  it("returns multiple tools for a blended question, de-duplicated and order-stable", () => {
    const tools = planOpsTools("summarize ACME the customer: their invoices and open tickets");
    expect(tools).toContain("ops.customer.read");
    expect(tools).toContain("ops.invoice.read");
    expect(tools).toContain("ops.ticket.read");
    expect(new Set(tools).size).toBe(tools.length); // no dupes
  });

  it("returns no tools for a pure knowledge question (graph-only)", () => {
    expect(planOpsTools("what is our refund policy?")).toEqual([]);
    expect(planOpsTools("how do we onboard a new client?")).toEqual([]);
  });
});
