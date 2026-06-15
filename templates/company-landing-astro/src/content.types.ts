/* AUTO-GENERATED from content.schema.json — do not edit by hand.
   Regenerate: pnpm --filter create-microservices-app gen:template-types */

export interface SiteContent {
  company: string;
  domain: string;
  description: string;
  theme?: {
    accent?: string;
  };
  nav: {
    links: Link[];
    cta: Link;
  };
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
  logos?: {
    label: string;
    items: string[];
  };
  features: {
    eyebrow: string;
    title: string;
    items: {
      title: string;
      body: string;
      icon: "engineering" | "design" | "performance";
    }[];
  };
  process?: {
    eyebrow: string;
    title: string;
    intro: string;
    steps: TitleBody[];
  };
  testimonial?: {
    quote: string;
    author: string;
    role: string;
  };
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
  faq: {
    eyebrow: string;
    title: string;
    items: {
      q: string;
      a: string;
    }[];
  };
  cta: {
    title: string;
    body: string;
    primary: Link;
    secondary: Link;
  };
  footer: {
    groups: {
      title: string;
      links: Link[];
    }[];
    copyright: string;
  };
}
export interface Link {
  label: string;
  href: string;
}
export interface TitleBody {
  title: string;
  body: string;
}
