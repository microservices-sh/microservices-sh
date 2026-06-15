/* ─────────────────────────────────────────────────────────────────────────
   Site content — the ONE file you edit to make this your company's site.
   Markup reads from here; you should rarely need to touch the components.
   ───────────────────────────────────────────────────────────────────────── */

export interface Link {
  label: string;
  href: string;
}

export interface Feature {
  title: string;
  body: string;
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

export const site = {
  company: "Northwind",
  domain: "https://northwind.example",
  description:
    "Northwind builds calm, dependable software for teams that would rather ship than fuss. Refined tools, fair pricing, no theatrics.",

  nav: {
    links: [
      { label: "Work", href: "#features" },
      { label: "Process", href: "#process" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ] as Link[],
    cta: { label: "Start a project", href: "#pricing" } as Link,
  },

  hero: {
    eyebrow: "Studio · est. 2026",
    titleLead: "Software with",
    titleEmphasis: "good manners",
    titleTail: "— and a sharp edge.",
    lead: "We design and build the unglamorous parts of your product so they don't break when it matters. Considered, tested, and quietly excellent.",
    primary: { label: "Start a project", href: "#pricing" } as Link,
    secondary: { label: "See the process", href: "#process" } as Link,
    note: "Trusted by teams who hate surprises.",
  },

  logos: {
    label: "Working with",
    items: ["Atlas Foods", "Meridian", "Halcyon", "Quill & Co.", "Tidewater"],
  },

  features: {
    eyebrow: "What we do",
    title: "Three things, done properly.",
    items: [
      {
        title: "Product engineering",
        body: "Auth, payments, and the boring 30% that decides whether a product survives — built once, built right.",
      },
      {
        title: "Design systems",
        body: "A typographic, token-driven foundation your whole team can build on without it drifting into chaos.",
      },
      {
        title: "Performance & care",
        body: "Fast by default, accessible by default, observed in production. We sweat the details you'll never see.",
      },
    ] as Feature[],
  },

  process: {
    eyebrow: "How it works",
    title: "A short, honest process.",
    intro:
      "No 40-page decks. We move in clear, reviewable steps so you always know where things stand and what's next.",
    steps: [
      { title: "Scope", body: "We pin down the real problem and the smallest thing that solves it." },
      { title: "Build", body: "Tight loops, working software each week, nothing hidden behind a curtain." },
      { title: "Ship & tend", body: "We launch, watch it in the wild, and fix the rough edges before you notice them." },
    ] as Step[],
  },

  testimonial: {
    quote:
      "They shipped in three weeks what our last vendor couldn't in three months — and it actually held up under load.",
    author: "Dana Whitlock",
    role: "VP Product, Meridian",
  },

  pricing: {
    eyebrow: "Engagements",
    title: "Simple, fair pricing.",
    intro: "Pick a shape that fits. No lock-in, no surprise invoices.",
    plans: [
      {
        name: "Sprint",
        price: "$6k",
        unit: "/ 2 weeks",
        bestFor: "A focused build or fix",
        features: ["One clear outcome", "Working software weekly", "Async updates", "Source-visible"],
        cta: { label: "Book a sprint", href: "#" } as Link,
        featured: false,
      },
      {
        name: "Partner",
        price: "$12k",
        unit: "/ month",
        bestFor: "Ongoing product work",
        features: ["Dedicated team", "Roadmap + delivery", "Weekly reviews", "Priority support"],
        cta: { label: "Start partnership", href: "#" } as Link,
        featured: true,
      },
      {
        name: "Custom",
        price: "Let's talk",
        unit: "",
        bestFor: "Larger or unusual work",
        features: ["Scoped to you", "SLA available", "Security review", "On your infrastructure"],
        cta: { label: "Get in touch", href: "#" } as Link,
        featured: false,
      },
    ],
  },

  faq: {
    eyebrow: "Questions",
    title: "Before you ask.",
    items: [
      { q: "How fast can you start?", a: "Usually within a week. We keep one slot open for new work at all times." },
      { q: "Do we own the code?", a: "Always. Everything is source-visible and yours — no lock-in, ever." },
      { q: "What stack do you use?", a: "Whatever fits the job. We're opinionated about quality, not about logos." },
      { q: "Can you work with our team?", a: "Yes. We embed, pair, and hand things off cleanly when we're done." },
    ] as Faq[],
  },

  cta: {
    title: "Let's build something that lasts.",
    body: "Tell us what's on your plate. We'll tell you honestly whether we can help.",
    primary: { label: "Start a project", href: "mailto:hello@northwind.example" } as Link,
    secondary: { label: "Read the FAQ", href: "#faq" } as Link,
  },

  footer: {
    groups: [
      {
        title: "Studio",
        links: [
          { label: "Work", href: "#features" },
          { label: "Process", href: "#process" },
          { label: "Pricing", href: "#pricing" },
        ],
      },
      {
        title: "Company",
        links: [
          { label: "About", href: "#" },
          { label: "Careers", href: "#" },
          { label: "Contact", href: "mailto:hello@northwind.example" },
        ],
      },
      {
        title: "Legal",
        links: [
          { label: "Privacy", href: "#" },
          { label: "Terms", href: "#" },
        ],
      },
    ] as FooterGroup[],
    copyright: "Northwind Studio",
  },
};

export type Site = typeof site;
