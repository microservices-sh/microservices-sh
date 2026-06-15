/* AUTO-GENERATED from content.schema.json — do not edit by hand.
   Regenerate: pnpm --filter create-microservices-app gen:template-types */

export interface SiteContent {
  hero: {
    eyebrow: string;
    headline: string;
    lead: string;
    primaryCta: Cta;
    secondaryCta: Cta1;
  };
  panel: {
    eyebrow: string;
    title: string;
    body: string;
    features: string[];
  };
}
export interface Cta {
  label: string;
  href: string;
}
export interface Cta1 {
  label: string;
  href: string;
}
