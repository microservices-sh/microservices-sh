// Company settings loader (Drizzle). Falls back to defaults when D1 isn't bound
// (local in-memory dev), so pages render without a database.
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { companySettings, type CompanySettings } from "./db/schema";

export const DEFAULT_SETTINGS: CompanySettings = {
  id: "company",
  name: "Booking",
  timezone: "UTC",
  currency: "USD",
  cancellationAllowed: true,
  cancellationNoticeHours: 24,
  reminderHours: 24,
  depositPercent: 0,
  holdMinutes: 15,
  createdAt: "",
  updatedAt: "",
};

export async function getCompanySettings(d1: D1Database | undefined): Promise<CompanySettings> {
  if (!d1) return DEFAULT_SETTINGS;
  try {
    const row = await getDb(d1).select().from(companySettings).where(eq(companySettings.id, "company")).get();
    return row ?? DEFAULT_SETTINGS;
  } catch {
    // Settings table not migrated yet, or DB unavailable — degrade gracefully.
    return DEFAULT_SETTINGS;
  }
}
