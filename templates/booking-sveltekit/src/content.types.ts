/* AUTO-GENERATED from content.schema.json — do not edit by hand.
   Regenerate: pnpm --filter create-microservices-app gen:template-types */

export interface SiteContent {
  hero: {
    eyebrow: string;
    headline: string;
    lead: string;
    primaryCta: Cta;
    secondaryCta: Cta;
  };
  panel: {
    eyebrow: string;
    title: string;
    body: string;
    features: string[];
  };
}
/**
 * A call-to-action button. By convention hero.primaryCta links to /book and hero.secondaryCta to /admin.
 */
export interface Cta {
  label: string;
  href: string;
}
