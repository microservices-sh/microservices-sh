export const manifest = {
  id: "booking",
  name: "Booking",
  version: "0.1.0",
  status: "available",
  class: "vertical",
  summary: "Service booking, availability, booking records, domain events, and booking admin data access.",
  runtime: {
    language: "typescript",
    platform: "cloudflare-workers",
    frameworkNeutral: true
  }
} as const;

export const moduleDefinition = {
  manifest,
  entrypoint: "src/index.ts",
  customization: {
    default: "config-hooks",
    supported: ["config", "hooks", "overlay", "fork"]
  }
} as const;
