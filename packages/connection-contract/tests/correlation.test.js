import { describe, it, expect } from "vitest";
import { newCorrelationId, CORRELATION_HEADER, withMeta } from "../src/correlation.js";

describe("correlation", () => {
  it("generates unique ids", () => {
    expect(newCorrelationId()).not.toBe(newCorrelationId());
  });
  it("exposes the propagation header name", () => {
    expect(CORRELATION_HEADER).toBe("x-msh-correlation-id");
  });
  it("withMeta keeps an existing correlationId", () => {
    const m = withMeta({ source: "auth", correlationId: "c1", requestId: "r1", ts: "t" });
    expect(m.correlationId).toBe("c1");
  });
  it("withMeta mints a correlationId when absent", () => {
    const m = withMeta({ source: "auth", requestId: "r2", ts: "t" });
    expect(typeof m.correlationId).toBe("string");
    expect(m.correlationId.length).toBeGreaterThan(0);
  });
});
