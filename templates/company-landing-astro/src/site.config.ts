/* ─────────────────────────────────────────────────────────────────────────
   Site content is data, not code. Edit src/content.json to make this your
   company's site — see content.schema.json for the contract (fields, limits,
   hints) and CLAUDE.md for the agent customization playbook.
   This file only types that data; you should not need to touch it.
   ───────────────────────────────────────────────────────────────────────── */

import content from "./content.json";

export interface Link {
  label: string;
  href: string;
}

export interface Feature {
  title: string;
  body: string;
  icon: string;
}

export interface Step {
  title: string;
  body: string;
}

export interface Faq {
  q: string;
  a: string;
}

export interface FooterGroup {
  title: string;
  links: Link[];
}

export interface Theme {
  /** Brand accent as a #rrggbb hex; --accent-ink and --accent-wash derive from it. */
  accent?: string;
}

export interface SiteContent {
  company: string;
  domain: string;
  description: string;
  theme?: Theme;
  nav: { links: Link[]; cta: Link };
  hero: {
    eyebrow: string;
    titleLead: string;
    titleEmphasis: string;
    titleTail: string;
    lead: string;
    primary: Link;
    secondary: Link;
    note: string;
  };
  logos: { label: string; items: string[] };
  features: { eyebrow: string; title: string; items: Feature[] };
  process: { eyebrow: string; title: string; intro: string; steps: Step[] };
  testimonial: { quote: string; author: string; role: string };
  pricing: {
    eyebrow: string;
    title: string;
    intro: string;
    plans: {
      name: string;
      price: string;
      unit: string;
      bestFor: string;
      features: string[];
      cta: Link;
      featured: boolean;
    }[];
  };
  faq: { eyebrow: string; title: string; items: Faq[] };
  cta: { title: string; body: string; primary: Link; secondary: Link };
  footer: { groups: FooterGroup[]; copyright: string };
}

export const site = content as SiteContent;
export const theme: Theme = site.theme ?? {};

export type Site = SiteContent;
