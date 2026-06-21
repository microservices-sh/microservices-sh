import { describe, expect, it } from "vitest";

import { runAccountingScheduled } from "../../templates/accounting-erp-sveltekit/src/lib/server/scheduled.ts";

describe("accounting scheduled runtime", () => {
  it("runs schedule catch-up and due job execution through shared module handlers", async () => {
    const result = await runAccountingScheduled(
      { cron: "*/5 * * * *", scheduledTime: Date.parse("2026-06-21T00:00:00.000Z") },
      undefined
    );

    expect(result.scheduled.ok).toBe(true);
    expect(result.ran.ok).toBe(true);
    if (result.scheduled.ok) expect(result.scheduled.data.enqueued).toBeGreaterThanOrEqual(0);
    if (result.ran.ok) expect(result.ran.data.ran).toBeGreaterThanOrEqual(0);
  });
});
