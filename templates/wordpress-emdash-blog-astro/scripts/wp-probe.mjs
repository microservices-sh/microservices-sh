#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const DEFAULT_TYPES = new Set([
  "post",
  "page",
  "attachment",
  "nav_menu_item",
  "wp_block",
  "wp_template",
  "wp_template_part",
  "wp_navigation",
  "wp_font_family",
  "wp_font_face",
]);

const args = parseArgs(process.argv.slice(2));
const sourceUrl = normalizeBase(args.source || process.env.WP_SOURCE_URL);
const username = args.username || process.env.WP_USERNAME;
const appPassword = process.env.WP_APP_PASSWORD;
const json = args.json || Boolean(args.out);

if (!sourceUrl) {
  exitWithError("Set WP_SOURCE_URL or pass --source <url>.");
}

const authHeaders = username && appPassword
  ? { Authorization: `Basic ${Buffer.from(`${username}:${appPassword}`).toString("base64")}` }
  : {};

const headers = {
  Accept: "application/json",
  ...authHeaders,
};

const report = await probe();

if (args.out) {
  const outPath = resolve(args.out);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

if (json) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  process.stdout.write(formatReport(report));
}

async function probe() {
  const startedAt = new Date().toISOString();
  const root = await requestJson("/wp-json/", { auth: false });
  const exporterProbe = await requestJson("/wp-json/emdash/v1/probe", { auth: false });
  const authenticated = Boolean(username && appPassword);
  const me = authenticated ? await requestJson("/wp-json/wp/v2/users/me?context=edit") : null;
  const settings = authenticated ? await requestJson("/wp-json/wp/v2/settings") : null;
  const postTypes = authenticated ? await requestJson("/wp-json/wp/v2/types?context=edit") : null;

  const counts = {
    posts: await count("/wp-json/wp/v2/posts?context=edit&status=any&per_page=1&_fields=id,status"),
    pages: await count("/wp-json/wp/v2/pages?context=edit&status=any&per_page=1&_fields=id,status"),
    media: await count("/wp-json/wp/v2/media?context=edit&per_page=1&_fields=id,status"),
    categories: await count("/wp-json/wp/v2/categories?per_page=1&_fields=id,count"),
    tags: await count("/wp-json/wp/v2/tags?per_page=1&_fields=id,count"),
    comments: await count("/wp-json/wp/v2/comments?context=edit&per_page=1&_fields=id,status"),
  };

  const typeEntries = postTypes?.ok && postTypes.data && typeof postTypes.data === "object"
    ? Object.entries(postTypes.data)
    : [];

  const customPostTypes = [];
  for (const [id, value] of typeEntries) {
    if (DEFAULT_TYPES.has(id)) continue;
    const restBase = value?.rest_base;
    const typeCount = restBase
      ? await count(`/wp-json/wp/v2/${restBase}?context=edit&status=any&per_page=1&_fields=id,status`)
      : { status: 0, total: 0, totalPages: 0 };
    customPostTypes.push({
      id,
      name: value?.name || id,
      restBase,
      total: typeCount.total,
      status: typeCount.status,
    });
  }

  const theme = authenticated
    ? await requestJson("/wp-json/wp/v2/themes?status=active&_fields=stylesheet,name,status")
    : null;
  const plugins = authenticated
    ? await requestJson("/wp-json/wp/v2/plugins?context=edit&status=active&_fields=plugin,name,status")
    : null;
  const menus = authenticated
    ? await requestJson("/wp-json/wp/v2/menu-locations?context=edit")
    : null;
  const sitemap = await head("/wp-sitemap.xml");

  const namespaces = Array.isArray(root.data?.namespaces) ? root.data.namespaces : [];
  const exporterInstalled = exporterProbe.status === 200 || namespaces.includes("emdash/v1");
  const exporterPostTypes = exporterProbe.status === 200 ? extractExporterPostTypes(exporterProbe.data) : [];
  const mergedCustomPostTypes = mergeCustomPostTypes(customPostTypes, exporterPostTypes);
  const pluginItems = Array.isArray(plugins?.data) ? plugins.data : [];
  const hasWooCommerce = namespaces.some((ns) => ns.startsWith("wc/") || ns.startsWith("wc-"))
    || pluginItems.some((plugin) => String(plugin.plugin || "").includes("woocommerce"))
    || mergedCustomPostTypes.some((type) => type.id === "product" && (type.total === null || type.total > 0));

  const unsupportedTypes = mergedCustomPostTypes.filter((type) => type.total === null || type.total > 0);
  const warnings = [];
  if (!authenticated) warnings.push("No WordPress Application Password was provided; private/draft/admin-only metadata may be missing.");
  if (me?.status === 401) warnings.push("Application Password authentication failed.");
  if (!exporterInstalled) warnings.push("EmDash Exporter plugin was not detected; standard migrations should install it before export.");
  if (hasWooCommerce) warnings.push("WooCommerce detected. This template migrates blog/content only.");
  if (unsupportedTypes.length) warnings.push(`Custom post types detected: ${unsupportedTypes.map((type) => type.id).join(", ")}.`);
  if (sitemap.status !== 200) warnings.push(`Default WordPress sitemap returned HTTP ${sitemap.status}.`);

  return {
    sourceUrl,
    generatedAt: startedAt,
    auth: {
      attempted: authenticated,
      ok: me?.status === 200,
      user: me?.status === 200 ? {
        id: me.data?.id,
        name: me.data?.name,
        slug: me.data?.slug,
        roles: me.data?.roles || [],
        capabilities: summarizeCapabilities(me.data?.capabilities),
      } : null,
    },
    site: {
      name: root.data?.name,
      description: root.data?.description,
      url: root.data?.url,
      home: root.data?.home,
      namespaces,
      settings: settings?.status === 200 ? {
        title: settings.data?.title,
        description: settings.data?.description,
        showOnFront: settings.data?.show_on_front,
        pageOnFront: settings.data?.page_on_front,
        pageForPosts: settings.data?.page_for_posts,
        postsPerPage: settings.data?.posts_per_page,
      } : null,
    },
    counts,
    activeTheme: Array.isArray(theme?.data) ? theme.data.map((item) => ({
      stylesheet: item.stylesheet,
      name: item.name?.raw || item.name,
      status: item.status,
    })) : [],
    activePlugins: pluginItems.map((item) => ({
      plugin: item.plugin,
      name: item.name,
      status: item.status,
    })),
    emdashExporter: {
      installed: exporterInstalled,
      probeStatus: exporterProbe.status,
      namespaceDetected: namespaces.includes("emdash/v1"),
      probe: exporterProbe.status === 200 ? exporterProbe.data : null,
    },
    menuLocations: menus?.status === 200 ? Object.keys(menus.data || {}) : [],
    customPostTypes: mergedCustomPostTypes,
    restCustomPostTypes: customPostTypes,
    exporterPostTypes,
    detection: {
      hasWooCommerce,
      unsupportedTypes: unsupportedTypes.map((type) => type.id),
      defaultSitemapStatus: sitemap.status,
      classification: classify({ hasWooCommerce, unsupportedTypes, counts }),
    },
    warnings,
    next: [
      "Install/verify the official EmDash Exporter plugin for structured content export.",
      "Provide active theme.zip for standard design-preserved migration, or choose content-only mode.",
      "Run npm run microservices -- wp migrate --source <url> --theme ./theme.zip.",
      "Keep WooCommerce/products/payments/orders out of this blog template.",
    ],
  };
}

function summarizeCapabilities(caps = {}) {
  return {
    read: Boolean(caps.read),
    editPosts: Boolean(caps.edit_posts),
    editPages: Boolean(caps.edit_pages),
    uploadFiles: Boolean(caps.upload_files),
    export: Boolean(caps.export),
    manageOptions: Boolean(caps.manage_options),
  };
}

function extractExporterPostTypes(data) {
  const candidates = [
    data?.post_types,
    data?.postTypes,
    data?.data?.post_types,
    data?.data?.postTypes,
    data?.site?.post_types,
    data?.site?.postTypes,
  ].filter(Boolean);

  const normalized = [];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const value = normalizeExporterPostType(item);
        if (value) normalized.push(value);
      }
    } else if (typeof candidate === "object") {
      for (const [id, item] of Object.entries(candidate)) {
        const value = normalizeExporterPostType(item, id);
        if (value) normalized.push(value);
      }
    }
  }

  return dedupeById(normalized)
    .filter((type) => !DEFAULT_TYPES.has(type.id));
}

function normalizeExporterPostType(value, fallbackId = null) {
  if (typeof value === "string") {
    return {
      id: value,
      name: value,
      restBase: null,
      total: null,
      status: null,
      source: "emdash-exporter",
    };
  }

  if (!value || typeof value !== "object") return null;

  const id = value.id || value.slug || value.name || value.post_type || fallbackId;
  if (!id) return null;

  const rawTotal = value.total ?? value.count ?? value.published ?? value.items ?? null;
  const total = rawTotal === null || rawTotal === undefined || rawTotal === "" ? null : Number(rawTotal);

  return {
    id: String(id),
    name: value.label || value.labels?.name || value.name || String(id),
    restBase: value.rest_base || value.restBase || null,
    total: Number.isFinite(total) ? total : null,
    status: value.status || null,
    source: "emdash-exporter",
  };
}

function mergeCustomPostTypes(restTypes, exporterTypes) {
  const map = new Map();

  for (const type of restTypes) {
    map.set(type.id, {
      ...type,
      source: "wp-rest",
    });
  }

  for (const type of exporterTypes) {
    const existing = map.get(type.id);
    if (!existing) {
      map.set(type.id, type);
      continue;
    }

    map.set(type.id, {
      ...existing,
      name: existing.name || type.name,
      restBase: existing.restBase || type.restBase,
      total: Math.max(Number(existing.total || 0), Number(type.total || 0)),
      exporterTotal: type.total,
      source: "wp-rest+emdash-exporter",
    });
  }

  return [...map.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function dedupeById(values) {
  const map = new Map();
  for (const value of values) {
    if (!map.has(value.id)) map.set(value.id, value);
  }
  return [...map.values()];
}

async function count(path) {
  const result = await requestJson(path);
  return {
    status: result.status,
    total: Number(result.headers.get("x-wp-total") || 0),
    totalPages: Number(result.headers.get("x-wp-totalpages") || 0),
  };
}

async function requestJson(path, options = {}) {
  const useAuth = options.auth !== false;
  const response = await fetch(`${sourceUrl}${path}`, {
    headers: useAuth ? headers : { Accept: "application/json" },
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { ok: response.ok, status: response.status, headers: response.headers, data };
}

async function head(path) {
  const response = await fetch(`${sourceUrl}${path}`, { method: "HEAD" });
  return { ok: response.ok, status: response.status };
}

function classify({ hasWooCommerce, unsupportedTypes, counts }) {
  if (hasWooCommerce && unsupportedTypes.length > 1) return "content-site-with-commerce-and-custom-post-types";
  if (hasWooCommerce) return "content-site-with-commerce";
  if (unsupportedTypes.length) return "content-site-with-custom-post-types";
  if (counts.posts.total > 0 || counts.pages.total > 0) return "blog-or-content-site";
  return "empty-or-private-wordpress";
}

function formatReport(value) {
  const lines = [
    `WordPress source: ${value.sourceUrl}`,
    `Auth: ${value.auth.ok ? "ok" : value.auth.attempted ? "failed" : "not provided"}`,
    `Classification: ${value.detection.classification}`,
    "",
    "Counts:",
    `  posts: ${value.counts.posts.total}`,
    `  pages: ${value.counts.pages.total}`,
    `  media: ${value.counts.media.total}`,
    `  categories: ${value.counts.categories.total}`,
    `  tags: ${value.counts.tags.total}`,
    `  comments: ${value.counts.comments.total}`,
    "",
    `WooCommerce: ${value.detection.hasWooCommerce ? "detected" : "not detected"}`,
    `EmDash Exporter: ${value.emdashExporter.installed ? "detected" : "not detected"} (HTTP ${value.emdashExporter.probeStatus})`,
    `Custom post types: ${value.customPostTypes.length ? value.customPostTypes.map((type) => `${type.id}=${type.total ?? "unknown"}`).join(", ") : "none"}`,
    `Default sitemap: HTTP ${value.detection.defaultSitemapStatus}`,
  ];

  if (value.warnings.length) {
    lines.push("", "Warnings:", ...value.warnings.map((warning) => `  - ${warning}`));
  }

  return `${lines.join("\n")}\n`;
}

function parseArgs(values) {
  const out = {
    source: null,
    username: null,
    out: null,
    json: false,
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--source") {
      out.source = values[index + 1] || null;
      index += 1;
    } else if (value === "--username") {
      out.username = values[index + 1] || null;
      index += 1;
    } else if (value === "--out") {
      out.out = values[index + 1] || null;
      index += 1;
    } else if (value === "--json") {
      out.json = true;
    }
  }

  return out;
}

function normalizeBase(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return null;
  }
}

function exitWithError(message) {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}
