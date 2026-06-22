const CONTRACT_VERSION = "2026-06-13";
const MODULE_SOURCE_REPO = "microservices-sh/microservices-sh";
const MODULE_SOURCE_URL = `https://github.com/${MODULE_SOURCE_REPO}.git`;

function moduleSurfaces({
  admin = null,
  visitor = null,
  agentic = null,
} = {}) {
  return {
    admin: admin ?? { applicable: false },
    visitor: visitor ?? { applicable: false },
    agentic: agentic ?? { applicable: false },
  };
}

function hookTiming(name) {
  if (name.startsWith("before")) return "pre";
  if (name.startsWith("calculate")) return "compute";
  return "post";
}

function catalogHook(name) {
  return {
    name,
    timing: hookTiming(name),
    purpose: `Extension point for ${name}.`,
  };
}

function standardQuality() {
  return {
    tests: { unit: true, integration: true, fixtures: true },
    agentDocs: true,
    migrations: true,
    upgradeNotes: true,
  };
}

function catalogModule({
  id,
  name,
  status,
  category = "core",
  approvalRisk = "medium",
  summary,
  requires = [],
  optional = [],
  storage = ["d1"],
  mount,
  bindings = ["DB"],
  surfaces = {},
  eventsEmitted = [],
  eventsConsumed = [],
  permissions,
  secrets = [],
  rpc = [],
  hooks = [],
  config = [],
  interactive = null,
  skills = [],
}) {
  const hookNames = hooks.map((hook) => (typeof hook === "string" ? hook : hook.name));
  return {
    id,
    name,
    version: "0.1.0",
    status,
    category,
    approvalRisk,
    summary,
    requires,
    optional,
    storage,
    runtime: {
      framework: "hono",
      mount,
      bindings,
    },
    surfaces: moduleSurfaces(surfaces),
    eventsEmitted,
    eventsConsumed,
    permissions,
    secrets,
    rpc,
    hooks: hooks.map((hook) => (typeof hook === "string" ? catalogHook(hook) : hook)),
    ...(interactive ? { interactive } : {}),
    ...(skills.length ? { skills } : {}),
    customization: {
      config,
      hooks: hookNames,
      forkable: true,
    },
    quality: standardQuality(),
  };
}

const INTERNAL_CATALOG_MODULES = Object.freeze([
  catalogModule({
    id: "org-team-rbac",
    name: "Org, Team & RBAC",
    status: "available",
    category: "platform",
    approvalRisk: "high",
    summary:
      "Multi-tenant organizations, memberships, roles, and invitations with permission resolution for tenant-scoped B2B applications.",
    mount: "/orgs",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Team", path: "/settings/team", permission: "org.read", icon: "UsersRound" }],
        referenceUi: ["reference-ui/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "org-team-rbac.createOrganization",
          "org-team-rbac.updateOrganization",
          "org-team-rbac.inviteMember",
          "org-team-rbac.acceptInvitation",
          "org-team-rbac.updateMemberRole",
          "org-team-rbac.removeMember",
          "org-team-rbac.listMembers",
          "org-team-rbac.createRole",
          "org-team-rbac.authorize",
          "org-team-rbac.resolvePermissions",
        ],
        approvalRequired: [
          "org-team-rbac.createOrganization",
          "org-team-rbac.updateOrganization",
          "org-team-rbac.inviteMember",
          "org-team-rbac.updateMemberRole",
          "org-team-rbac.removeMember",
          "org-team-rbac.createRole",
        ],
      },
    },
    eventsEmitted: ["org.created", "org.updated", "member.invited", "member.joined", "member.removed", "role.updated"],
    permissions: ["org.read", "org.manage", "member.manage", "org-team-rbac.extend", "org-team-rbac.observe"],
    rpc: [
      { method: "createOrganization", scope: "org.manage", public: false },
      { method: "updateOrganization", scope: "org.manage", public: false },
      { method: "inviteMember", scope: "member.manage", public: false },
      { method: "acceptInvitation", scope: "org.read", public: false },
      { method: "updateMemberRole", scope: "member.manage", public: false },
      { method: "removeMember", scope: "member.manage", public: false },
      { method: "listMembers", scope: "org.read", public: false },
      { method: "createRole", scope: "org.manage", public: false },
      { method: "authorize", scope: "org.read", public: false },
      { method: "resolvePermissions", scope: "org.read", public: false },
    ],
    hooks: ["beforeInvite", "onMembershipChanged"],
  }),
  catalogModule({
    id: "admin-shell",
    name: "Admin Shell",
    status: "available",
    category: "platform",
    approvalRisk: "high",
    summary:
      "Schema-driven admin CRUD over host D1 tables with a resource registry, RBAC checks, soft-delete, search, pagination, and audit hooks.",
    storage: [],
    mount: "/admin",
    bindings: ["DB"],
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Admin", path: "/admin", permission: "admin.access", icon: "ShieldCheck" }],
        referenceUi: ["reference-ui/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "admin-shell.listRecords",
          "admin-shell.getRecord",
          "admin-shell.createRecord",
          "admin-shell.updateRecord",
          "admin-shell.deleteRecord",
        ],
        approvalRequired: [
          "admin-shell.createRecord",
          "admin-shell.updateRecord",
          "admin-shell.deleteRecord",
        ],
      },
    },
    eventsEmitted: ["admin.record_created", "admin.record_updated", "admin.record_deleted"],
    permissions: ["admin.access", "admin.read", "admin.write", "admin-shell.extend"],
    rpc: [
      { method: "listRecords", scope: "admin.read", public: false },
      { method: "getRecord", scope: "admin.read", public: false },
      { method: "createRecord", scope: "admin.write", public: false },
      { method: "updateRecord", scope: "admin.write", public: false },
      { method: "deleteRecord", scope: "admin.write", public: false },
    ],
    hooks: ["beforeWrite", "onAdminAction"],
  }),
  catalogModule({
    id: "file-media",
    name: "File & Media",
    status: "available",
    category: "provider",
    approvalRisk: "high",
    summary:
      "R2-backed file uploads with tenant-scoped keys, upload tickets, owner-scoped listing, orphan cleanup, soft-deletes, and async variant hooks.",
    optional: ["auth", "audit-log", "jobs-workflows"],
    storage: ["d1", "r2"],
    mount: "/files",
    bindings: ["DB", "MEDIA_BUCKET"],
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Files", path: "/files", permission: "media.read", icon: "FolderOpen" }],
        referenceUi: ["reference-ui/README.md"],
      },
      visitor: {
        applicable: true,
        featureKey: "uploads",
      },
      agentic: {
        applicable: true,
        tools: [
          "file-media.createUploadTicket",
          "file-media.completeUpload",
          "file-media.listFiles",
          "file-media.deleteFile",
        ],
        approvalRequired: [
          "file-media.createUploadTicket",
          "file-media.completeUpload",
          "file-media.deleteFile",
        ],
      },
    },
    eventsEmitted: ["media.upload_requested", "media.uploaded", "media.deleted", "media.ticket_expired"],
    permissions: ["media.upload", "media.read", "media.admin", "media.extend", "media.observe"],
    rpc: [
      { method: "createUploadTicket", scope: "media.upload", public: false },
      { method: "completeUpload", scope: "media.upload", public: false },
      { method: "listFiles", scope: "media.read", public: false },
      { method: "deleteFile", scope: "media.admin", public: false },
    ],
    hooks: [
      "beforeUpload",
      { name: "allowContentType", timing: "compute", purpose: "Decide whether an upload content type is allowed." },
      "onFileUploaded",
    ],
  }),
  catalogModule({
    id: "jobs-workflows",
    name: "Jobs & Workflows",
    status: "available",
    category: "platform",
    approvalRisk: "high",
    summary:
      "Durable background jobs and deterministic workflows with typed step dispatch, waiting/resume gates, retries, schedules, artifacts, and dead-letter handling.",
    optional: ["audit-log", "notifications-inapp"],
    storage: ["d1", "queue"],
    mount: "/jobs",
    bindings: ["DB", "JOBS_QUEUE"],
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Jobs", path: "/jobs", permission: "jobs.read", icon: "Workflow" }],
        referenceUi: ["reference-ui/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "jobs-workflows.enqueueJob",
          "jobs-workflows.runJob",
          "jobs-workflows.runDueJobs",
          "jobs-workflows.upsertSchedule",
          "jobs-workflows.listJobs",
          "jobs-workflows.listSchedules",
          "jobs-workflows.defineWorkflow",
          "jobs-workflows.startWorkflowRun",
          "jobs-workflows.runNextWorkflowStep",
          "jobs-workflows.resumeWorkflowStep",
          "jobs-workflows.recordWorkflowArtifact",
        ],
        approvalRequired: [
          "jobs-workflows.enqueueJob",
          "jobs-workflows.runJob",
          "jobs-workflows.runDueJobs",
          "jobs-workflows.upsertSchedule",
          "jobs-workflows.defineWorkflow",
          "jobs-workflows.startWorkflowRun",
          "jobs-workflows.resumeWorkflowStep",
        ],
      },
    },
    eventsEmitted: [
      "job.enqueued",
      "job.succeeded",
      "job.retried",
      "job.dead",
      "job.scheduled",
      "workflow.defined",
      "workflow.started",
      "workflow.step.succeeded",
      "workflow.step.failed",
      "workflow.waiting",
      "workflow.succeeded",
      "workflow.failed",
      "workflow.artifact.recorded",
      "workflow.step.event_recorded",
    ],
    permissions: [
      "jobs.enqueue",
      "jobs.read",
      "jobs.admin",
      "workflows.define",
      "workflows.run",
      "workflows.read",
      "workflows.artifacts",
      "workflows.admin",
      "jobs-workflows.extend",
    ],
    rpc: [
      { method: "enqueueJob", scope: "jobs.enqueue", public: false },
      { method: "runJob", scope: "jobs.admin", public: false },
      { method: "runDueJobs", scope: "jobs.admin", public: false },
      { method: "dueScheduledJobs", scope: "jobs.read", public: false },
      { method: "upsertSchedule", scope: "jobs.admin", public: false },
      { method: "listJobs", scope: "jobs.read", public: false },
      { method: "listSchedules", scope: "jobs.read", public: false },
      { method: "defineWorkflow", scope: "workflows.define", public: false },
      { method: "startWorkflowRun", scope: "workflows.run", public: false },
      { method: "runNextWorkflowStep", scope: "workflows.run", public: false },
      { method: "resumeWorkflowStep", scope: "workflows.run", public: false },
      { method: "recordWorkflowArtifact", scope: "workflows.artifacts", public: false },
      { method: "listWorkflowArtifacts", scope: "workflows.read", public: false },
      { method: "appendWorkflowStepEvent", scope: "workflows.run", public: false },
      { method: "listWorkflowStepEvents", scope: "workflows.read", public: false },
    ],
    hooks: [
      "beforeJobEnqueue",
      { name: "computeBackoffMs", timing: "compute", purpose: "Override retry backoff calculations." },
      "onJobDead",
    ],
  }),
  catalogModule({
    id: "notifications-inapp",
    name: "In-App Notifications",
    status: "available",
    category: "provider",
    summary:
      "Per-user in-app notification feed with user-scoped list/count reads, read/unread state, typed payloads, reconnect catch-up, and deduplicated delivery.",
    optional: ["auth", "org-team-rbac", "audit-log"],
    mount: "/notifications",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Notifications", path: "/notifications", permission: "notifications.read", icon: "Bell" }],
        referenceUi: ["reference-ui/README.md"],
      },
      visitor: {
        applicable: true,
        featureKey: "notifications",
      },
      agentic: {
        applicable: true,
        tools: [
          "notifications-inapp.notify",
          "notifications-inapp.listNotifications",
          "notifications-inapp.markRead",
          "notifications-inapp.markAllRead",
          "notifications-inapp.getUnreadCount",
        ],
        approvalRequired: [
          "notifications-inapp.notify",
          "notifications-inapp.markRead",
          "notifications-inapp.markAllRead",
        ],
      },
    },
    eventsEmitted: ["notification.created", "notification.read"],
    permissions: ["notifications.read", "notifications.write", "notifications.admin", "notifications-inapp.extend"],
    rpc: [
      { method: "notify", scope: "notifications.write", public: false },
      { method: "listNotifications", scope: "notifications.read", public: false },
      { method: "markRead", scope: "notifications.write", public: false },
      { method: "markAllRead", scope: "notifications.write", public: false },
      { method: "getUnreadCount", scope: "notifications.read", public: false },
    ],
    hooks: [
      "beforeNotify",
      { name: "renderNotification", timing: "compute", purpose: "Derive presentation fields from typed notification payloads." },
    ],
  }),
  catalogModule({
    id: "support-ticket",
    name: "Support Ticket",
    status: "available",
    category: "core",
    summary:
      "Tenant-scoped support tickets with sequence numbers, lifecycle state, priority, assignment, comments, attachments, and public follow-up links.",
    optional: ["auth", "customer", "file-media", "notifications-inapp", "audit-log", "jobs-workflows"],
    mount: "/support",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Support", path: "/support", permission: "support.read", icon: "LifeBuoy" }],
        referenceUi: ["reference-ui/README.md"],
      },
      visitor: {
        applicable: true,
        featureKey: "support",
      },
      agentic: {
        applicable: true,
        tools: [
          "support-ticket.createTicket",
          "support-ticket.getTicket",
          "support-ticket.listTickets",
          "support-ticket.updateTicket",
          "support-ticket.addTicketComment",
          "support-ticket.listTicketThread",
          "support-ticket.attachTicketFile",
          "support-ticket.createTicketShareToken",
          "support-ticket.resolveTicketShareToken",
        ],
        approvalRequired: [
          "support-ticket.createTicket",
          "support-ticket.updateTicket",
          "support-ticket.addTicketComment",
          "support-ticket.attachTicketFile",
          "support-ticket.createTicketShareToken",
          "support-ticket.revokeTicketShareToken",
        ],
      },
    },
    eventsEmitted: [
      "support-ticket.created",
      "support-ticket.updated",
      "support-ticket.status_changed",
      "support-ticket.comment.created",
      "support-ticket.attachment.attached",
      "support-ticket.share-token.created",
      "support-ticket.share-token.revoked",
    ],
    permissions: ["support.read", "support.manage"],
    rpc: [
      { method: "createTicket", scope: "support.manage", public: false },
      { method: "getTicket", scope: "support.read", public: false },
      { method: "listTickets", scope: "support.read", public: false },
      { method: "updateTicket", scope: "support.manage", public: false },
      { method: "addTicketComment", scope: "support.manage", public: false },
      { method: "listTicketThread", scope: "support.read", public: false },
      { method: "attachTicketFile", scope: "support.manage", public: false },
      { method: "createTicketShareToken", scope: "support.manage", public: false },
      { method: "listTicketShareTokens", scope: "support.read", public: false },
      { method: "revokeTicketShareToken", scope: "support.manage", public: false },
      { method: "resolveTicketShareToken", scope: "public-token", public: true },
    ],
    hooks: ["beforeTicketCreate", "afterTicketUpdated"],
  }),
  catalogModule({
    id: "ads-manager",
    name: "Ads Manager",
    status: "available",
    category: "provider",
    approvalRisk: "high",
    summary:
      "Cross-platform ad monitoring over an upstream ads service with D1 insight snapshots, anomaly alerts, normalized campaign views, and entitlement-gated connector access.",
    optional: ["auth", "audit-log", "billing-subscriptions", "jobs-workflows", "notifications-inapp"],
    mount: "/ads",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Ads", path: "/ads", permission: "ads.read", icon: "ChartNoAxesCombined" }],
      },
      agentic: {
        applicable: true,
        tools: [
          "ads-manager.connectAccount",
          "ads-manager.listConnections",
          "ads-manager.disconnectAccount",
          "ads-manager.listCampaigns",
          "ads-manager.getInsights",
          "ads-manager.syncInsights",
          "ads-manager.detectAnomalies",
          "ads-manager.listAlerts",
        ],
        approvalRequired: [
          "ads-manager.connectAccount",
          "ads-manager.disconnectAccount",
          "ads-manager.syncInsights",
          "ads-manager.detectAnomalies",
        ],
      },
    },
    eventsEmitted: ["ad.account_connected", "ad.account_disconnected", "ad.insights_synced", "ad.alert_raised"],
    permissions: ["ads.connect", "ads.read", "ads.manage", "ads.admin", "ads.observe"],
    secrets: ["ADS_SERVICE_KEY"],
    rpc: [
      { method: "connectAccount", scope: "ads.connect", public: false },
      { method: "listConnections", scope: "ads.read", public: false },
      { method: "disconnectAccount", scope: "ads.manage", public: false },
      { method: "listCampaigns", scope: "ads.read", public: false },
      { method: "getInsights", scope: "ads.read", public: false },
      { method: "syncInsights", scope: "ads.manage", public: false },
      { method: "detectAnomalies", scope: "ads.manage", public: false },
      { method: "listAlerts", scope: "ads.read", public: false },
    ],
    hooks: ["beforeSync", "onAlertRaised"],
  }),
  catalogModule({
    id: "forms-intake",
    name: "Forms & Intake",
    status: "available",
    category: "vertical",
    summary:
      "Dynamic form builder and intake with serializable field schemas, validation rules, conditional visibility, idempotent submissions, Turnstile support, and attachment references.",
    optional: ["auth", "audit-log", "file-media", "jobs-workflows"],
    mount: "/forms",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Forms", path: "/forms", permission: "forms-intake.read", icon: "ClipboardList" }],
      },
      visitor: {
        applicable: true,
        featureKey: "forms",
      },
      agentic: {
        applicable: true,
        tools: [
          "forms-intake.createForm",
          "forms-intake.getForm",
          "forms-intake.updateForm",
          "forms-intake.listForms",
          "forms-intake.submitForm",
          "forms-intake.listSubmissions",
          "forms-intake.reviewSubmission",
        ],
        approvalRequired: [
          "forms-intake.createForm",
          "forms-intake.updateForm",
          "forms-intake.reviewSubmission",
        ],
      },
    },
    eventsEmitted: [
      "forms-intake.form_created",
      "forms-intake.form_updated",
      "forms-intake.submission_received",
      "forms-intake.submission_reviewed",
    ],
    permissions: [
      "forms-intake.read",
      "forms-intake.write",
      "forms-intake.admin",
      "forms-intake.extend",
      "forms-intake.observe",
    ],
    secrets: ["TURNSTILE_SECRET"],
    rpc: [
      { method: "createForm", scope: "forms-intake.write", public: false },
      { method: "getForm", scope: "forms-intake.read", public: false },
      { method: "updateForm", scope: "forms-intake.write", public: false },
      { method: "listForms", scope: "forms-intake.read", public: false },
      { method: "submitForm", scope: null, public: true },
      { method: "listSubmissions", scope: "forms-intake.read", public: false },
      { method: "reviewSubmission", scope: "forms-intake.write", public: false },
    ],
    hooks: ["beforeFormPublish", "onSubmissionReceived"],
  }),
  catalogModule({
    id: "image-generation",
    name: "Image Generation",
    status: "available",
    category: "provider",
    approvalRisk: "high",
    summary:
      "Text-to-image generation and editing across pluggable providers with R2-backed image bytes, tenant-scoped keys, D1 gallery metadata, and provider fallback.",
    optional: ["auth", "audit-log"],
    storage: ["d1", "r2"],
    mount: "/images",
    bindings: ["DB", "IMAGE_BUCKET"],
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Images", path: "/images", permission: "image.read", icon: "Images" }],
      },
      agentic: {
        applicable: true,
        tools: [
          "image-generation.generateImage",
          "image-generation.editImage",
          "image-generation.listImages",
          "image-generation.getImage",
          "image-generation.deleteImage",
        ],
        approvalRequired: [
          "image-generation.generateImage",
          "image-generation.editImage",
          "image-generation.deleteImage",
        ],
      },
    },
    eventsEmitted: ["image.generated", "image.edited", "image.deleted"],
    permissions: ["image.generate", "image.read", "image.admin", "image.extend", "image.observe"],
    secrets: ["KIEAI_API_KEY", "GEMINI_AUTH_TOKEN", "OPENAI_API_KEY"],
    rpc: [
      { method: "generateImage", scope: "image.generate", public: false },
      { method: "editImage", scope: "image.generate", public: false },
      { method: "listImages", scope: "image.read", public: false },
      { method: "getImage", scope: "image.read", public: false },
      { method: "deleteImage", scope: "image.admin", public: false },
    ],
    hooks: ["beforeGenerate", "onImageGenerated"],
  }),
  catalogModule({
    id: "knowledge-base-rag",
    name: "Knowledge Base RAG",
    status: "draft",
    category: "core",
    summary:
      "Tenant-scoped knowledge base with articles, attachments, sources, ingestion jobs, semantic search, and cite-or-refuse grounded answers for support.",
    optional: ["org-team-rbac", "file-media", "support-ticket", "jobs-workflows", "audit-log"],
    mount: "/knowledge",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Knowledge", path: "/knowledge", permission: "knowledge-base-rag.read", icon: "BookOpen" }],
      },
      agentic: {
        applicable: true,
        tools: [
          "knowledge-base-rag.createArticle",
          "knowledge-base-rag.listArticles",
          "knowledge-base-rag.searchKnowledge",
          "knowledge-base-rag.answerQuestion",
          "knowledge-base-rag.draftSupportReply",
        ],
        approvalRequired: [
          "knowledge-base-rag.createArticle",
          "knowledge-base-rag.updateArticle",
          "knowledge-base-rag.recordSource",
          "knowledge-base-rag.attachArticleFile",
          "knowledge-base-rag.draftSupportReply",
        ],
      },
    },
    eventsEmitted: [
      "knowledge-base-rag.article_created",
      "knowledge-base-rag.article_updated",
      "knowledge-base-rag.source_recorded",
      "knowledge-base-rag.attachment_added",
      "knowledge-base-rag.web_scan_job_created",
      "knowledge-base-rag.web_scan_job_updated",
      "knowledge-base-rag.feed_created",
      "knowledge-base-rag.feed_updated",
    ],
    permissions: [
      "knowledge-base-rag.read",
      "knowledge-base-rag.write",
      "knowledge-base-rag.admin",
      "knowledge-base-rag.extend",
      "knowledge-base-rag.observe",
    ],
    rpc: [
      { method: "createArticle", scope: "knowledge-base-rag.write", public: false },
      { method: "getArticle", scope: "knowledge-base-rag.read", public: false },
      { method: "listArticles", scope: "knowledge-base-rag.read", public: false },
      { method: "updateArticle", scope: "knowledge-base-rag.write", public: false },
      { method: "recordSource", scope: "knowledge-base-rag.write", public: false },
      { method: "listSources", scope: "knowledge-base-rag.read", public: false },
      { method: "attachArticleFile", scope: "knowledge-base-rag.write", public: false },
      { method: "listAttachments", scope: "knowledge-base-rag.read", public: false },
      { method: "createWebScanJob", scope: "knowledge-base-rag.write", public: false },
      { method: "listWebScanJobs", scope: "knowledge-base-rag.read", public: false },
      { method: "updateWebScanJob", scope: "knowledge-base-rag.write", public: false },
      { method: "createKnowledgeFeed", scope: "knowledge-base-rag.write", public: false },
      { method: "listKnowledgeFeeds", scope: "knowledge-base-rag.read", public: false },
      { method: "updateKnowledgeFeed", scope: "knowledge-base-rag.write", public: false },
      { method: "searchKnowledge", scope: "knowledge-base-rag.read", public: false },
      { method: "answerQuestion", scope: "knowledge-base-rag.read", public: false },
      { method: "draftSupportReply", scope: "knowledge-base-rag.write", public: false },
    ],
    hooks: [
      "beforeArticleCreate",
      "beforeArticleUpdate",
      "afterAttachmentAdded",
      "afterGroundedAnswerDrafted",
    ],
  }),
  catalogModule({
    id: "marketing-research",
    name: "Marketing Research",
    status: "available",
    category: "provider",
    approvalRisk: "low",
    summary:
      "Composable, cited marketing research with swappable signal and synthesis ports, coverage-honest snapshots, and cite-or-refuse briefs.",
    requires: ["org-team-rbac"],
    optional: ["audit-log", "jobs-workflows", "notifications-inapp"],
    mount: "/marketing-research",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Marketing Research", path: "/marketing-research", permission: "marketing.read", icon: "Search" }],
      },
      agentic: {
        applicable: true,
        tools: ["marketing-research.runResearch", "marketing-research.getBrief"],
        approvalRequired: ["marketing-research.runResearch"],
      },
    },
    eventsEmitted: ["marketing.brief_created", "marketing.signal_alert"],
    permissions: ["marketing.read", "marketing.run", "marketing.admin", "marketing.observe"],
    rpc: [
      { method: "runResearch", scope: "marketing.run", public: false },
      { method: "getBrief", scope: "marketing.read", public: false },
    ],
    hooks: ["beforeResearchRun", "afterBriefCreated"],
  }),
  catalogModule({
    id: "membership-credits",
    name: "Membership Credits",
    status: "draft",
    category: "core",
    summary:
      "Tenant-scoped membership tiers, active customer memberships, customer credit balances, credit ledger transactions, and membership history.",
    optional: ["auth", "audit-log", "booking", "customer", "payment", "billing-subscriptions"],
    mount: "/membership-credits",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Membership Credits", path: "/membership-credits", permission: "membership-credits.read", icon: "BadgeDollarSign" }],
      },
      agentic: {
        applicable: true,
        tools: [
          "membership-credits.createMembershipTier",
          "membership-credits.listMembershipTiers",
          "membership-credits.assignMembership",
          "membership-credits.grantCustomerCredit",
          "membership-credits.debitCustomerCredit",
          "membership-credits.getCustomerMembershipSnapshot",
        ],
        approvalRequired: [
          "membership-credits.createMembershipTier",
          "membership-credits.assignMembership",
          "membership-credits.grantCustomerCredit",
          "membership-credits.debitCustomerCredit",
        ],
      },
    },
    eventsEmitted: [
      "membership-credits.tier_created",
      "membership-credits.membership_assigned",
      "membership-credits.membership_changed",
      "membership-credits.membership_cancelled",
      "membership-credits.membership_expired",
      "membership-credits.credit_recorded",
    ],
    permissions: [
      "membership-credits.read",
      "membership-credits.write",
      "membership-credits.credit-admin",
      "membership-credits.membership-admin",
      "membership-credits.admin",
      "membership-credits.extend",
      "membership-credits.observe",
    ],
    rpc: [
      { method: "createMembershipTier", scope: "membership-credits.membership-admin", public: false },
      { method: "listMembershipTiers", scope: "membership-credits.read", public: false },
      { method: "assignMembership", scope: "membership-credits.membership-admin", public: false },
      { method: "grantCustomerCredit", scope: "membership-credits.credit-admin", public: false },
      { method: "debitCustomerCredit", scope: "membership-credits.credit-admin", public: false },
      { method: "getCustomerMembershipSnapshot", scope: "membership-credits.read", public: false },
    ],
    hooks: ["beforeMembershipCreditsCreate", "afterMembershipCreditsUpdated"],
  }),
  catalogModule({
    id: "project-progress",
    name: "Project Progress",
    status: "draft",
    category: "core",
    summary: "Project progress timeline, worker access grants, media metadata, comments, and public customer snapshots.",
    optional: ["auth", "customer", "file-media", "email", "notifications-inapp", "audit-log"],
    mount: "/project-progress",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Project Progress", path: "/project-progress", permission: "project-progress.read", icon: "Milestone" }],
      },
      visitor: {
        applicable: true,
        featureKey: "projectProgress",
      },
      agentic: {
        applicable: true,
        tools: [
          "project-progress.createProject",
          "project-progress.updateProjectStatus",
          "project-progress.createProgressLog",
          "project-progress.grantProjectAccess",
          "project-progress.getProjectSnapshot",
          "project-progress.resolvePublicProject",
        ],
        approvalRequired: [
          "project-progress.createProject",
          "project-progress.updateProjectStatus",
          "project-progress.createProgressLog",
          "project-progress.grantProjectAccess",
        ],
      },
    },
    eventsEmitted: [
      "project-progress.created",
      "project-progress.updated",
      "project-progress.project.created",
      "project-progress.project.status-changed",
      "project-progress.access.granted",
      "project-progress.access.revoked",
      "project-progress.log.created",
      "project-progress.media.attached",
      "project-progress.comment.created",
    ],
    permissions: [
      "project-progress.read",
      "project-progress.write",
      "project-progress.admin",
      "project-progress.extend",
      "project-progress.observe",
    ],
    rpc: [
      { method: "createProject", scope: "project-progress.write", public: false },
      { method: "updateProjectStatus", scope: "project-progress.write", public: false },
      { method: "createProgressLog", scope: "project-progress.write", public: false },
      { method: "grantProjectAccess", scope: "project-progress.admin", public: false },
      { method: "getProjectSnapshot", scope: "project-progress.read", public: false },
      { method: "resolvePublicProject", scope: null, public: true },
    ],
    hooks: ["beforeProjectCreate", "beforeProgressLogCreate", "afterProgressLogCreated", "afterCommentCreated"],
  }),
  catalogModule({
    id: "sms-campaigns",
    name: "SMS Campaigns",
    status: "draft",
    category: "core",
    approvalRisk: "high",
    summary:
      "Tenant-scoped SMS campaigns for opted-in contacts, groups, reusable templates, provider configuration, scheduled sends, dispatch, and delivery callbacks.",
    optional: ["auth", "audit-log"],
    mount: "/sms-campaigns",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "SMS Campaigns", path: "/sms-campaigns", permission: "sms-campaigns.read", icon: "MessageSquareText" }],
      },
      agentic: {
        applicable: true,
        tools: [
          "sms-campaigns.upsertSmsContact",
          "sms-campaigns.createSmsCampaign",
          "sms-campaigns.scheduleSmsCampaign",
          "sms-campaigns.dispatchSmsCampaign",
          "sms-campaigns.recordSmsDelivery",
        ],
        approvalRequired: [
          "sms-campaigns.upsertSmsContact",
          "sms-campaigns.createSmsCampaign",
          "sms-campaigns.scheduleSmsCampaign",
          "sms-campaigns.dispatchSmsCampaign",
        ],
      },
    },
    eventsEmitted: [
      "sms-campaigns.contact_upserted",
      "sms-campaigns.group_created",
      "sms-campaigns.template_created",
      "sms-campaigns.provider_configured",
      "sms-campaigns.campaign_created",
      "sms-campaigns.campaign_scheduled",
      "sms-campaigns.campaign_dispatched",
      "sms-campaigns.delivery_recorded",
    ],
    permissions: [
      "sms-campaigns.read",
      "sms-campaigns.write",
      "sms-campaigns.dispatch",
      "sms-campaigns.admin",
      "sms-campaigns.extend",
      "sms-campaigns.observe",
    ],
    rpc: [
      { method: "upsertSmsContact", scope: "sms-campaigns.write", public: false },
      { method: "createSmsCampaign", scope: "sms-campaigns.write", public: false },
      { method: "scheduleSmsCampaign", scope: "sms-campaigns.write", public: false },
      { method: "dispatchSmsCampaign", scope: "sms-campaigns.dispatch", public: false },
      { method: "recordSmsDelivery", scope: "sms-campaigns.write", public: false },
    ],
    hooks: ["beforeSmsCampaignsCreate", "afterSmsCampaignsUpdated"],
  }),
  catalogModule({
    id: "storage-entitlements",
    name: "Storage Entitlements",
    status: "draft",
    category: "core",
    summary: "Storage quota, packages, purchases, owner usage accounting, and share-link entitlement controls for portal-style applications.",
    optional: ["auth", "audit-log"],
    mount: "/storage-entitlements",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Storage", path: "/storage-entitlements", permission: "storage-entitlements.read", icon: "HardDrive" }],
      },
      visitor: {
        applicable: true,
        featureKey: "storageShare",
      },
      agentic: {
        applicable: true,
        tools: [
          "storage-entitlements.getStorageInfo",
          "storage-entitlements.reserveStorageBytes",
          "storage-entitlements.releaseStorageBytes",
          "storage-entitlements.createStoragePackage",
          "storage-entitlements.completeStoragePurchase",
          "storage-entitlements.createShareLink",
          "storage-entitlements.resolveShareLink",
        ],
        approvalRequired: [
          "storage-entitlements.reserveStorageBytes",
          "storage-entitlements.createStoragePackage",
          "storage-entitlements.completeStoragePurchase",
          "storage-entitlements.createShareLink",
        ],
      },
    },
    eventsEmitted: [
      "storage-entitlements.created",
      "storage-entitlements.updated",
      "storage-entitlements.quota.updated",
      "storage-entitlements.purchase.completed",
      "storage-entitlements.share.created",
      "storage-entitlements.share.downloaded",
      "storage-entitlements.share.revoked",
    ],
    permissions: [
      "storage-entitlements.read",
      "storage-entitlements.write",
      "storage-entitlements.admin",
      "storage-entitlements.extend",
      "storage-entitlements.observe",
    ],
    rpc: [
      { method: "getStorageInfo", scope: "storage-entitlements.read", public: false },
      { method: "reserveStorageBytes", scope: "storage-entitlements.write", public: false },
      { method: "releaseStorageBytes", scope: "storage-entitlements.write", public: false },
      { method: "createStoragePackage", scope: "storage-entitlements.admin", public: false },
      { method: "completeStoragePurchase", scope: "storage-entitlements.write", public: false },
      { method: "createShareLink", scope: "storage-entitlements.write", public: false },
      { method: "resolveShareLink", scope: null, public: true },
    ],
    hooks: ["beforeStorageEntitlementsCreate", "afterStorageEntitlementsUpdated"],
  }),
  catalogModule({
    id: "support-inbox",
    name: "Support Inbox",
    status: "draft",
    category: "core",
    summary:
      "Tenant-scoped support widget and inbox for widget settings, quick actions, conversations, messages, channel metadata, and agent takeover.",
    optional: ["auth", "audit-log", "support-ticket", "knowledge-base-rag", "gateway"],
    mount: "/support-inbox",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Support Inbox", path: "/support-inbox", permission: "support-inbox.read", icon: "MessagesSquare" }],
      },
      visitor: {
        applicable: true,
        featureKey: "supportWidget",
      },
      agentic: {
        applicable: true,
        tools: [
          "support-inbox.upsertWidgetSettings",
          "support-inbox.getWidgetConfig",
          "support-inbox.startConversation",
          "support-inbox.addMessage",
          "support-inbox.listConversations",
          "support-inbox.setAgentTakeover",
          "support-inbox.configureChannelConnection",
        ],
        approvalRequired: [
          "support-inbox.upsertWidgetSettings",
          "support-inbox.addMessage",
          "support-inbox.setAgentTakeover",
          "support-inbox.configureChannelConnection",
        ],
      },
    },
    eventsEmitted: [
      "support-inbox.widget_settings_updated",
      "support-inbox.quick_action_created",
      "support-inbox.quick_action_deleted",
      "support-inbox.conversation_started",
      "support-inbox.message_added",
      "support-inbox.conversation_status_updated",
      "support-inbox.agent_takeover_updated",
      "support-inbox.channel_connection_configured",
    ],
    permissions: [
      "support-inbox.read",
      "support-inbox.write",
      "support-inbox.agent",
      "support-inbox.channel-admin",
      "support-inbox.admin",
      "support-inbox.extend",
      "support-inbox.observe",
    ],
    rpc: [
      { method: "upsertWidgetSettings", scope: "support-inbox.admin", public: false },
      { method: "getWidgetConfig", scope: null, public: true },
      { method: "startConversation", scope: null, public: true },
      { method: "addMessage", scope: "support-inbox.write", public: false },
      { method: "listConversations", scope: "support-inbox.read", public: false },
      { method: "setAgentTakeover", scope: "support-inbox.agent", public: false },
      { method: "configureChannelConnection", scope: "support-inbox.channel-admin", public: false },
    ],
    hooks: ["beforeSupportInboxCreate", "afterSupportInboxUpdated"],
  }),
  catalogModule({
    id: "product-catalog",
    name: "Product Catalog",
    status: "draft",
    summary: "Product and category catalog with SKU uniqueness, external mappings, combo products, and catalog events.",
    optional: ["auth", "audit-log"],
    mount: "/products",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Products", path: "/products", permission: "product-catalog.read", icon: "Package" }],
        referenceUi: ["reference-ui/admin/README.md"],
      },
      visitor: {
        applicable: false,
        referenceUi: ["reference-ui/visitor/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "product-catalog.listProducts",
          "product-catalog.getProduct",
          "product-catalog.createProduct",
          "product-catalog.updateProduct",
          "product-catalog.listCategories",
          "product-catalog.createCategory",
          "product-catalog.expandProductComponents",
        ],
        skillPaths: ["skills/product-catalog-operator/SKILL.md"],
        approvalRequired: [
          "product-catalog.createProduct",
          "product-catalog.updateProduct",
          "product-catalog.createCategory",
        ],
      },
    },
    eventsEmitted: [
      "product-catalog.category_created",
      "product-catalog.category_updated",
      "product-catalog.product_created",
      "product-catalog.product_updated",
      "product-catalog.combo_updated",
    ],
    permissions: [
      "product-catalog.read",
      "product-catalog.write",
      "product-catalog.admin",
      "product-catalog.extend",
      "product-catalog.observe",
    ],
    rpc: [
      { method: "listProducts", scope: "product-catalog.read", public: false },
      { method: "getProduct", scope: "product-catalog.read", public: false },
      { method: "createProduct", scope: "product-catalog.write", public: false },
      { method: "updateProduct", scope: "product-catalog.write", public: false },
      { method: "listCategories", scope: "product-catalog.read", public: false },
      { method: "createCategory", scope: "product-catalog.write", public: false },
      { method: "expandProductComponents", scope: "product-catalog.read", public: false },
    ],
    hooks: ["beforeCategoryCreate", "beforeProductCreate", "afterCategoryUpdated", "afterProductUpdated"],
    skills: [
      {
        id: "product-catalog-operator",
        recommendedFor: ["admin-operations", "agentic-tools"],
        path: "skills/product-catalog-operator/SKILL.md",
      },
    ],
  }),
  catalogModule({
    id: "inventory",
    name: "Inventory",
    status: "draft",
    summary: "Tenant-scoped inventory ledger with stock movements, reservations, deductions, reconciliation documents, low-stock alerts, and derived balances.",
    requires: ["product-catalog"],
    optional: ["auth", "audit-log"],
    mount: "/inventory",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Inventory", path: "/inventory", permission: "inventory.read", icon: "Warehouse" }],
      },
      agentic: {
        applicable: true,
        tools: [
          "inventory.getStockBalance",
          "inventory.listStockMovements",
          "inventory.stockIn",
          "inventory.reserveStock",
          "inventory.releaseReservation",
          "inventory.deductStock",
          "inventory.reconcileStock",
          "inventory.createReconciliationDocument",
          "inventory.listReconciliationDocuments",
          "inventory.completeReconciliationDocument",
          "inventory.listLowStockAlerts",
        ],
        approvalRequired: [
          "inventory.stockIn",
          "inventory.reserveStock",
          "inventory.releaseReservation",
          "inventory.deductStock",
          "inventory.reconcileStock",
          "inventory.createReconciliationDocument",
          "inventory.completeReconciliationDocument",
        ],
      },
    },
    eventsEmitted: [
      "inventory.stock_received",
      "inventory.stock_reserved",
      "inventory.stock_released",
      "inventory.stock_deducted",
      "inventory.stock_reconciled",
      "inventory.reconciliation_document_created",
      "inventory.reconciliation_document_completed",
    ],
    permissions: [
      "inventory.read",
      "inventory.write",
      "inventory.admin",
      "inventory.extend",
      "inventory.observe",
    ],
    rpc: [
      { method: "getStockBalance", scope: "inventory.read", public: false },
      { method: "listStockMovements", scope: "inventory.read", public: false },
      { method: "stockIn", scope: "inventory.write", public: false },
      { method: "reserveStock", scope: "inventory.write", public: false },
      { method: "releaseReservation", scope: "inventory.write", public: false },
      { method: "deductStock", scope: "inventory.write", public: false },
      { method: "reconcileStock", scope: "inventory.write", public: false },
      { method: "createReconciliationDocument", scope: "inventory.write", public: false },
      { method: "listReconciliationDocuments", scope: "inventory.read", public: false },
      { method: "completeReconciliationDocument", scope: "inventory.write", public: false },
      { method: "listLowStockAlerts", scope: "inventory.read", public: false },
    ],
    hooks: [
      "beforeStockIn",
      "beforeReservationCreate",
      "beforeReleaseCreate",
      "beforeDeductionCreate",
      "beforeReconciliation",
      "afterStockMovementRecorded",
    ],
  }),
  catalogModule({
    id: "sales-order",
    name: "Sales Order",
    status: "draft",
    summary: "Tenant-scoped sales orders with line items, external references, status transitions, bulk confirm/cancel, send attempts, reservation handoff, and invoice draft handoff.",
    optional: ["auth", "audit-log", "inventory", "invoice", "email"],
    mount: "/sales-orders",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Sales Orders", path: "/sales-orders", permission: "sales-order.read", icon: "ShoppingCart" }],
        referenceUi: ["reference-ui/admin/README.md"],
      },
      visitor: {
        applicable: false,
        referenceUi: ["reference-ui/visitor/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "sales-order.listOrders",
          "sales-order.getOrder",
          "sales-order.createDraftOrder",
          "sales-order.bulkTransitionOrders",
          "sales-order.confirmOrder",
          "sales-order.cancelOrder",
          "sales-order.sendSalesOrder",
          "sales-order.markOrderInvoiced",
        ],
        skillPaths: ["skills/sales-order-operator/SKILL.md"],
        approvalRequired: [
          "sales-order.createDraftOrder",
          "sales-order.bulkTransitionOrders",
          "sales-order.confirmOrder",
          "sales-order.cancelOrder",
          "sales-order.sendSalesOrder",
          "sales-order.markOrderInvoiced",
        ],
      },
    },
    eventsEmitted: [
      "sales-order.order_created",
      "sales-order.order_confirmed",
      "sales-order.order_cancelled",
      "sales-order.order_invoiced",
      "sales-order.order_sent",
      "sales-order.order_send_failed",
    ],
    permissions: [
      "sales-order.read",
      "sales-order.write",
      "sales-order.admin",
      "sales-order.extend",
      "sales-order.observe",
    ],
    rpc: [
      { method: "listOrders", scope: "sales-order.read", public: false },
      { method: "getOrder", scope: "sales-order.read", public: false },
      { method: "createDraftOrder", scope: "sales-order.write", public: false },
      { method: "bulkTransitionOrders", scope: "sales-order.write", public: false },
      { method: "confirmOrder", scope: "sales-order.write", public: false },
      { method: "cancelOrder", scope: "sales-order.write", public: false },
      { method: "sendSalesOrder", scope: "sales-order.write", public: false },
      { method: "markOrderInvoiced", scope: "sales-order.write", public: false },
    ],
    hooks: [
      "beforeSalesOrderCreate",
      "beforeSalesOrderConfirm",
      "beforeSalesOrderCancel",
      "beforeSalesOrderInvoice",
      "beforeSalesOrderSend",
      "afterSalesOrderUpdated",
    ],
    skills: [
      {
        id: "sales-order-operator",
        recommendedFor: ["admin-operations", "agentic-tools"],
        path: "skills/sales-order-operator/SKILL.md",
      },
    ],
  }),
  catalogModule({
    id: "estimate-quote",
    name: "Estimate Quote",
    status: "draft",
    summary: "Estimate and quote documents with draft editing, lifecycle transitions, accepted conversion, and invoice draft handoff.",
    optional: ["auth", "audit-log", "invoice"],
    mount: "/quotes",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Estimate Quote", path: "/quotes", permission: "estimate-quote.read" }],
        referenceUi: ["reference-ui/admin/README.md"],
      },
      visitor: {
        applicable: false,
        referenceUi: ["reference-ui/visitor/README.md"],
      },
      agentic: {
        applicable: true,
        tools: ["estimate-quote.read", "estimate-quote.write"],
        skillPaths: ["skills/estimate-quote-operator/SKILL.md"],
        approvalRequired: ["estimate-quote.write"],
      },
    },
    eventsEmitted: [
      "estimate-quote.created",
      "estimate-quote.updated",
      "estimate-quote.sent",
      "estimate-quote.viewed",
      "estimate-quote.accepted",
      "estimate-quote.declined",
      "estimate-quote.expired",
      "estimate-quote.converted",
      "estimate-quote.voided",
    ],
    permissions: [
      "estimate-quote.read",
      "estimate-quote.write",
      "estimate-quote.admin",
      "estimate-quote.extend",
      "estimate-quote.observe",
    ],
    hooks: ["beforeEstimateQuoteCreate", "afterEstimateQuoteUpdated"],
    skills: [
      {
        id: "estimate-quote-operator",
        recommendedFor: ["admin-operations", "agentic-tools"],
        path: "skills/estimate-quote-operator/SKILL.md",
      },
    ],
  }),
  catalogModule({
    id: "recurring-documents",
    name: "Recurring Documents",
    status: "draft",
    summary: "Recurring invoice and bill templates with due-cycle generation, lifecycle state, and draft document handoff.",
    optional: ["auth", "audit-log", "invoice", "accounts-payable", "jobs-workflows"],
    mount: "/recurring-documents",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Recurring Documents", path: "/recurring-documents", permission: "recurring-documents.read" }],
        referenceUi: ["reference-ui/admin/README.md"],
      },
      visitor: {
        applicable: false,
        referenceUi: ["reference-ui/visitor/README.md"],
      },
      agentic: {
        applicable: true,
        tools: ["recurring-documents.read", "recurring-documents.write"],
        skillPaths: ["skills/recurring-documents-operator/SKILL.md"],
        approvalRequired: ["recurring-documents.write"],
      },
    },
    eventsEmitted: [
      "recurring-documents.created",
      "recurring-documents.updated",
      "recurring-documents.paused",
      "recurring-documents.resumed",
      "recurring-documents.cancelled",
      "recurring-documents.completed",
      "recurring-documents.generated",
    ],
    permissions: [
      "recurring-documents.read",
      "recurring-documents.write",
      "recurring-documents.admin",
      "recurring-documents.extend",
      "recurring-documents.observe",
    ],
    hooks: ["beforeRecurringDocumentsCreate", "afterRecurringDocumentsUpdated"],
    skills: [
      {
        id: "recurring-documents-operator",
        recommendedFor: ["admin-operations", "agentic-tools"],
        path: "skills/recurring-documents-operator/SKILL.md",
      },
    ],
  }),
  catalogModule({
    id: "shipment",
    name: "Shipment",
    status: "draft",
    summary: "Shipment batches, fulfillment workflow, auditable status transitions, idempotent completion, and shipment events.",
    optional: ["auth", "audit-log"],
    mount: "/shipments",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Shipments", path: "/shipments", permission: "shipment.read", icon: "Truck" }],
        referenceUi: ["reference-ui/admin/README.md"],
      },
      visitor: {
        applicable: false,
        referenceUi: ["reference-ui/visitor/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "shipment.listShipments",
          "shipment.getShipment",
          "shipment.createShipment",
          "shipment.startShipmentProcessing",
          "shipment.completeShipment",
          "shipment.cancelShipment",
          "shipment.listShipmentStatusTransitions",
        ],
        skillPaths: ["skills/shipment-operator/SKILL.md"],
        approvalRequired: [
          "shipment.createShipment",
          "shipment.startShipmentProcessing",
          "shipment.completeShipment",
          "shipment.cancelShipment",
        ],
      },
    },
    eventsEmitted: ["shipment.created", "shipment.processing_started", "shipment.completed", "shipment.cancelled"],
    permissions: ["shipment.read", "shipment.write", "shipment.admin", "shipment.extend", "shipment.observe"],
    rpc: [
      { method: "listShipments", scope: "shipment.read", public: false },
      { method: "getShipment", scope: "shipment.read", public: false },
      { method: "createShipment", scope: "shipment.write", public: false },
      { method: "startShipmentProcessing", scope: "shipment.write", public: false },
      { method: "completeShipment", scope: "shipment.write", public: false },
      { method: "cancelShipment", scope: "shipment.write", public: false },
      { method: "listShipmentStatusTransitions", scope: "shipment.read", public: false },
    ],
    hooks: ["beforeShipmentCreate", "beforeShipmentComplete", "afterShipmentUpdated"],
    skills: [
      {
        id: "shipment-operator",
        recommendedFor: ["admin-operations", "agentic-tools"],
        path: "skills/shipment-operator/SKILL.md",
      },
    ],
  }),
  catalogModule({
    id: "commerce-sync",
    name: "Commerce Sync",
    status: "draft",
    approvalRisk: "high",
    summary: "Provider-neutral commerce connections, mappings, sync runs, webhook receipts, and normalized payload envelopes.",
    optional: ["auth", "audit-log"],
    mount: "/commerce-sync",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Commerce Sync", path: "/commerce-sync", permission: "commerce-sync.read" }],
        referenceUi: ["reference-ui/admin/README.md"],
      },
      visitor: {
        applicable: false,
        referenceUi: ["reference-ui/visitor/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "commerce-sync.createCommerceConnection",
          "commerce-sync.recordProviderMapping",
          "commerce-sync.startSyncRun",
          "commerce-sync.completeSyncRun",
          "commerce-sync.recordWebhookReceipt",
          "commerce-sync.normalizeCommercePayload",
          "commerce-sync.syncWooCommercePage",
        ],
        skillPaths: ["skills/commerce-sync-operator/SKILL.md"],
        approvalRequired: [
          "commerce-sync.createCommerceConnection",
          "commerce-sync.recordProviderMapping",
          "commerce-sync.startSyncRun",
          "commerce-sync.completeSyncRun",
          "commerce-sync.recordWebhookReceipt",
          "commerce-sync.normalizeCommercePayload",
          "commerce-sync.syncWooCommercePage",
        ],
      },
    },
    eventsEmitted: [
      "commerce-sync.connection_created",
      "commerce-sync.mapping_recorded",
      "commerce-sync.sync_started",
      "commerce-sync.sync_completed",
      "commerce-sync.webhook_recorded",
      "commerce-sync.payload_normalized",
    ],
    permissions: [
      "commerce-sync.read",
      "commerce-sync.write",
      "commerce-sync.admin",
      "commerce-sync.extend",
      "commerce-sync.observe",
    ],
    hooks: [
      "beforeCommerceConnectionCreate",
      "beforeCommerceSyncRun",
      "beforeCommerceWebhookRecord",
      "afterCommercePayloadNormalized",
    ],
    skills: [
      {
        id: "commerce-sync-operator",
        recommendedFor: ["admin-operations", "agentic-tools"],
        path: "skills/commerce-sync-operator/SKILL.md",
      },
    ],
  }),
  catalogModule({
    id: "accounting-core",
    name: "Accounting Core",
    status: "draft",
    summary: "Tenant-scoped double-entry accounting foundation with chart of accounts, fiscal periods, balanced posting, voiding, trial balance, general ledger, and financial statements.",
    optional: ["auth", "audit-log"],
    mount: "/accounting",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Accounting", path: "/accounting", permission: "accounting-core.read", icon: "Landmark" }],
        referenceUi: ["reference-ui/admin/README.md"],
      },
      visitor: {
        applicable: false,
        referenceUi: ["reference-ui/visitor/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "accounting-core.listAccounts",
          "accounting-core.createAccount",
          "accounting-core.createFiscalPeriod",
          "accounting-core.createJournalEntry",
          "accounting-core.postJournalEntry",
          "accounting-core.voidJournalEntry",
          "accounting-core.getTrialBalance",
          "accounting-core.getGeneralLedger",
          "accounting-core.getIncomeStatement",
          "accounting-core.getBalanceSheet",
          "accounting-core.getCashFlowStatement",
        ],
        skillPaths: ["skills/accounting-core-operator/SKILL.md"],
        approvalRequired: [
          "accounting-core.createAccount",
          "accounting-core.createFiscalPeriod",
          "accounting-core.postJournalEntry",
          "accounting-core.voidJournalEntry",
        ],
      },
    },
    eventsEmitted: [
      "accounting-core.account_created",
      "accounting-core.fiscal_period_created",
      "accounting-core.fiscal_period_status_changed",
      "accounting-core.journal_entry_created",
      "accounting-core.journal_entry_updated",
      "accounting-core.journal_entry_posted",
      "accounting-core.journal_entry_voided",
    ],
    permissions: [
      "accounting-core.read",
      "accounting-core.write",
      "accounting-core.admin",
      "accounting-core.extend",
      "accounting-core.observe",
    ],
    rpc: [
      { method: "listAccounts", scope: "accounting-core.read", public: false },
      { method: "getAccount", scope: "accounting-core.read", public: false },
      { method: "createAccount", scope: "accounting-core.write", public: false },
      { method: "createFiscalPeriod", scope: "accounting-core.write", public: false },
      { method: "createJournalEntry", scope: "accounting-core.write", public: false },
      { method: "postJournalEntry", scope: "accounting-core.write", public: false },
      { method: "voidJournalEntry", scope: "accounting-core.write", public: false },
      { method: "getTrialBalance", scope: "accounting-core.read", public: false },
      { method: "getGeneralLedger", scope: "accounting-core.read", public: false },
      { method: "getIncomeStatement", scope: "accounting-core.read", public: false },
      { method: "getBalanceSheet", scope: "accounting-core.read", public: false },
      { method: "getCashFlowStatement", scope: "accounting-core.read", public: false },
    ],
    hooks: [
      "beforeAccountCreate",
      "beforeFiscalPeriodCreate",
      "beforeJournalEntryCreate",
      "beforeJournalEntryPost",
      "beforeJournalEntryVoid",
      "afterJournalEntryChanged",
    ],
    skills: [
      {
        id: "accounting-core-operator",
        recommendedFor: ["admin-operations", "agentic-tools"],
        path: "skills/accounting-core-operator/SKILL.md",
      },
    ],
  }),
  catalogModule({
    id: "invoice",
    name: "Invoice",
    status: "available",
    approvalRisk: "high",
    summary: "Invoices with gapless atomic numbering, per-line tax, recurring invoice templates, an enforced draft->open->paid->void lifecycle, idempotent payment application, payment-link metadata, and dunning hooks.",
    requires: ["customer"],
    optional: ["payment", "email", "audit-log", "jobs-workflows"],
    mount: "/invoices",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Invoices", path: "/invoices", permission: "invoice.read", icon: "FileText" }],
        referenceUi: ["reference-ui/README.md"],
      },
      visitor: {
        applicable: true,
        featureKey: "invoices",
        referenceUi: ["reference-ui/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "invoice.listInvoices",
          "invoice.getInvoice",
          "invoice.issueInvoice",
          "invoice.recordPayment",
          "invoice.createPaymentLink",
          "invoice.createRecurringTemplate",
          "invoice.listRecurringTemplates",
          "invoice.updateRecurringTemplateStatus",
          "invoice.generateDueRecurringInvoices",
          "invoice.voidInvoice",
        ],
        skillPaths: ["skills/invoice-operator/SKILL.md"],
        approvalRequired: [
          "invoice.issueInvoice",
          "invoice.recordPayment",
          "invoice.createPaymentLink",
          "invoice.createRecurringTemplate",
          "invoice.updateRecurringTemplateStatus",
          "invoice.generateDueRecurringInvoices",
          "invoice.voidInvoice",
        ],
      },
    },
    eventsEmitted: [
      "invoice.created",
      "invoice.issued",
      "invoice.paid",
      "invoice.voided",
      "invoice.overdue",
      "invoice.payment_link_created",
      "invoice.recurring_template_created",
      "invoice.recurring_template_status_updated",
      "invoice.recurring_invoice_generated",
    ],
    permissions: ["invoice.read", "invoice.write", "invoice.admin", "invoice.extend", "invoice.observe"],
    hooks: ["beforeInvoiceIssue", "onInvoiceIssued", "onInvoicePaid"],
    skills: [
      {
        id: "invoice-operator",
        path: "skills/invoice-operator/SKILL.md",
        recommendedFor: ["admin-operations", "billing-support", "money-mutations"],
      },
    ],
  }),
  catalogModule({
    id: "accounts-payable",
    name: "Accounts Payable",
    status: "draft",
    approvalRisk: "high",
    summary: "Tenant-scoped accounts payable with vendors, bills, payable lifecycle, idempotent payment application, aging, recurring bill templates, and accounting-core handoff ports.",
    optional: ["auth", "accounting-core", "audit-log", "jobs-workflows"],
    mount: "/payables",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Payables", path: "/payables", permission: "accounts-payable.read", icon: "Receipt" }],
        referenceUi: ["reference-ui/admin/README.md"],
      },
      visitor: {
        applicable: false,
        referenceUi: ["reference-ui/visitor/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "accounts-payable.listVendors",
          "accounts-payable.createVendor",
          "accounts-payable.getVendor",
          "accounts-payable.updateVendor",
          "accounts-payable.updateVendorStatus",
          "accounts-payable.get1099VendorReport",
          "accounts-payable.createBill",
          "accounts-payable.markBillPayable",
          "accounts-payable.postBillToAccounting",
          "accounts-payable.voidBill",
          "accounts-payable.recordBillPayment",
          "accounts-payable.voidBillPayment",
          "accounts-payable.getBillPayment",
          "accounts-payable.listBillPayments",
          "accounts-payable.getAgingReport",
          "accounts-payable.createRecurringBillTemplate",
          "accounts-payable.listRecurringBillTemplates",
          "accounts-payable.updateRecurringBillTemplateStatus",
          "accounts-payable.generateDueRecurringBills",
        ],
        skillPaths: ["skills/accounts-payable-operator/SKILL.md"],
        approvalRequired: [
          "accounts-payable.createBill",
          "accounts-payable.updateVendor",
          "accounts-payable.updateVendorStatus",
          "accounts-payable.markBillPayable",
          "accounts-payable.postBillToAccounting",
          "accounts-payable.voidBill",
          "accounts-payable.recordBillPayment",
          "accounts-payable.voidBillPayment",
          "accounts-payable.createRecurringBillTemplate",
          "accounts-payable.updateRecurringBillTemplateStatus",
          "accounts-payable.generateDueRecurringBills",
        ],
      },
    },
    eventsEmitted: [
      "accounts-payable.vendor_created",
      "accounts-payable.vendor_updated",
      "accounts-payable.vendor_status_updated",
      "accounts-payable.bill_created",
      "accounts-payable.bill_marked_payable",
      "accounts-payable.bill_posted",
      "accounts-payable.bill_voided",
      "accounts-payable.bill_payment_recorded",
      "accounts-payable.bill_payment_voided",
      "accounts-payable.bill_paid",
      "accounts-payable.recurring_bill_template_created",
      "accounts-payable.recurring_bill_template_status_updated",
      "accounts-payable.recurring_bill_generated",
    ],
    permissions: [
      "accounts-payable.read",
      "accounts-payable.write",
      "accounts-payable.pay",
      "accounts-payable.admin",
      "accounts-payable.extend",
      "accounts-payable.observe",
    ],
    hooks: [
      "beforeVendorCreate",
      "beforeBillCreate",
      "beforeBillMarkPayable",
      "beforeBillVoid",
      "beforeBillPaymentVoid",
      "afterBillPayable",
      "afterBillVoided",
      "afterBillPaymentRecorded",
      "afterBillPaymentVoided",
      "afterVendorCreated",
    ],
    skills: [
      {
        id: "accounts-payable-operator",
        recommendedFor: ["admin-operations", "money-mutations", "agentic-tools"],
        path: "skills/accounts-payable-operator/SKILL.md",
      },
    ],
  }),
  catalogModule({
    id: "accounts-receivable",
    name: "Accounts Receivable",
    status: "draft",
    summary: "Tenant-scoped customer payment application, open receivables, aging, and statement workflows.",
    requires: ["customer", "invoice"],
    optional: ["auth", "audit-log", "payment", "accounting-core"],
    mount: "/receivables",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Accounts Receivable", path: "/receivables", permission: "accounts-receivable.read" }],
        referenceUi: ["reference-ui/admin/README.md"],
      },
      visitor: {
        applicable: false,
        referenceUi: ["reference-ui/visitor/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "accounts-receivable.recordCustomerPayment",
          "accounts-receivable.applyPaymentToInvoices",
          "accounts-receivable.listOpenReceivables",
          "accounts-receivable.generateAgedReceivables",
          "accounts-receivable.produceCustomerStatement",
        ],
        skillPaths: ["skills/accounts-receivable-operator/SKILL.md"],
        approvalRequired: [
          "accounts-receivable.recordCustomerPayment",
          "accounts-receivable.applyPaymentToInvoices",
        ],
      },
    },
    eventsEmitted: [
      "accounts-receivable.customer_payment_recorded",
      "accounts-receivable.payment_applied",
    ],
    permissions: [
      "accounts-receivable.read",
      "accounts-receivable.write",
      "accounts-receivable.admin",
      "accounts-receivable.extend",
      "accounts-receivable.observe",
    ],
    hooks: [
      "beforeCustomerPaymentRecord",
      "beforePaymentApply",
      "afterCustomerPaymentRecorded",
      "afterPaymentApplied",
    ],
    skills: [
      {
        id: "accounts-receivable-operator",
        recommendedFor: ["admin-operations", "agentic-tools"],
        path: "skills/accounts-receivable-operator/SKILL.md",
      },
    ],
  }),
  catalogModule({
    id: "bank-reconciliation",
    name: "Bank Reconciliation",
    status: "draft",
    summary: "Tenant-scoped bank accounts, statement import mapping presets, matching corrections, exclusions, and reconciliation completion with integer-cent balances.",
    optional: ["auth", "audit-log", "accounting-core", "payment"],
    mount: "/banking",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Banking", path: "/banking", permission: "bank-reconciliation.read", icon: "Landmark" }],
        referenceUi: ["reference-ui/admin/README.md"],
      },
      visitor: {
        applicable: false,
        referenceUi: ["reference-ui/visitor/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "bank-reconciliation.createBankAccount",
          "bank-reconciliation.listBankAccounts",
          "bank-reconciliation.listStatementImportFieldMappingPresets",
          "bank-reconciliation.listStatementImports",
          "bank-reconciliation.importStatementCsv",
          "bank-reconciliation.importStatementTransactions",
          "bank-reconciliation.suggestMatches",
          "bank-reconciliation.createMatch",
          "bank-reconciliation.unmatchTransaction",
          "bank-reconciliation.excludeTransaction",
          "bank-reconciliation.restoreExcludedTransaction",
          "bank-reconciliation.startReconciliation",
          "bank-reconciliation.completeReconciliation",
        ],
        skillPaths: ["skills/bank-reconciliation-operator/SKILL.md"],
        approvalRequired: [
          "bank-reconciliation.createBankAccount",
          "bank-reconciliation.importStatementCsv",
          "bank-reconciliation.importStatementTransactions",
          "bank-reconciliation.createMatch",
          "bank-reconciliation.unmatchTransaction",
          "bank-reconciliation.excludeTransaction",
          "bank-reconciliation.restoreExcludedTransaction",
          "bank-reconciliation.startReconciliation",
          "bank-reconciliation.completeReconciliation",
        ],
      },
    },
    eventsEmitted: [
      "bank-reconciliation.bank_account_created",
      "bank-reconciliation.statement_imported",
      "bank-reconciliation.match_created",
      "bank-reconciliation.transaction_unmatched",
      "bank-reconciliation.transaction_excluded",
      "bank-reconciliation.transaction_restored",
      "bank-reconciliation.reconciliation_started",
      "bank-reconciliation.reconciliation_completed",
    ],
    eventsConsumed: [
      "accounting-core.journal_entry_posted",
      "payment.succeeded",
      "payment.refunded",
    ],
    permissions: [
      "bank-reconciliation.read",
      "bank-reconciliation.write",
      "bank-reconciliation.admin",
      "bank-reconciliation.extend",
      "bank-reconciliation.observe",
    ],
    rpc: [
      { method: "createBankAccount", scope: "bank-reconciliation.write", public: false },
      { method: "listBankAccounts", scope: "bank-reconciliation.read", public: false },
      { method: "listStatementImportFieldMappingPresets", scope: "bank-reconciliation.read", public: false },
      { method: "listStatementImports", scope: "bank-reconciliation.read", public: false },
      { method: "importStatementCsv", scope: "bank-reconciliation.write", public: false },
      { method: "importStatementTransactions", scope: "bank-reconciliation.write", public: false },
      { method: "suggestMatches", scope: "bank-reconciliation.read", public: false },
      { method: "createMatch", scope: "bank-reconciliation.write", public: false },
      { method: "unmatchTransaction", scope: "bank-reconciliation.write", public: false },
      { method: "excludeTransaction", scope: "bank-reconciliation.write", public: false },
      { method: "restoreExcludedTransaction", scope: "bank-reconciliation.write", public: false },
      { method: "startReconciliation", scope: "bank-reconciliation.write", public: false },
      { method: "completeReconciliation", scope: "bank-reconciliation.write", public: false },
    ],
    hooks: [
      "beforeBankAccountCreate",
      "beforeStatementImport",
      "beforeMatchCreate",
      "beforeReconciliationStart",
      "beforeReconciliationComplete",
      "afterReconciliationChanged",
    ],
    skills: [
      {
        id: "bank-reconciliation-operator",
        recommendedFor: ["admin-operations", "agentic-tools", "finance-operations"],
        path: "skills/bank-reconciliation-operator/SKILL.md",
      },
    ],
  }),
  catalogModule({
    id: "email",
    name: "Email",
    status: "available",
    category: "provider",
    summary: "Transactional email module with provider-neutral ports and Resend and StackSuite (AWS SES) HTTP adapters.",
    optional: ["auth", "audit-log", "customer"],
    mount: "/emails",
    surfaces: {
      admin: {
        applicable: true,
        nav: [{ label: "Email", path: "/settings/email", permission: "email.read", icon: "Mail" }],
        referenceUi: ["reference-ui/README.md"],
      },
      agentic: {
        applicable: true,
        tools: ["email.sendEmail"],
        skillPaths: ["skills/email-operator/SKILL.md"],
        approvalRequired: ["email.sendEmail"],
      },
    },
    eventsEmitted: ["email.queued", "email.sent", "email.failed"],
    permissions: ["email.read", "email.write", "email.admin", "email.extend"],
    secrets: ["RESEND_API_KEY", "EMAIL_SERVICE_API_KEY"],
    hooks: ["beforeEmailSend", "afterEmailQueued", "afterEmailFailed"],
    skills: [
      {
        id: "microservices-provider-setup",
        recommendedFor: ["provider-setup", "sender-domain", "deliverability"],
      },
      {
        id: "email-operator",
        path: "skills/email-operator/SKILL.md",
        recommendedFor: ["admin-operations", "provider-setup", "deliverability"],
      },
    ],
  }),
]);

const MODULES = Object.freeze([
  {
    id: "auth",
    name: "Auth",
    version: "0.1.0",
    status: "available",
    category: "platform",
    summary: "EdDSA service-token mint/verify, scope checks, and JWKS for auth-gated inter-service communication.",
    requires: [],
    optional: ["audit-log"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/auth",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Auth", path: "/settings/auth", permission: "auth.admin" }],
      },
      agentic: {
        applicable: true,
        tools: ["auth.mintToken", "auth.verifyToken", "auth.getJwks"],
        approvalRequired: ["auth.mintToken", "auth.rotateSigningKey"],
      },
    }),
    eventsEmitted: ["auth.token_minted", "auth.key_rotated"],
    eventsConsumed: [],
    permissions: ["auth.mint", "auth.verify", "auth.admin"],
    rpc: [
      { method: "mintToken", scope: "auth.mint", public: false },
      { method: "verifyToken", scope: "auth.verify", public: false },
      { method: "getJwks", scope: null, public: true },
    ],
    hooks: [
      {
        name: "beforeMintToken",
        timing: "pre",
        purpose: "Clamp or narrow requested scopes and ttl before signing.",
      },
      {
        name: "afterTokenMinted",
        timing: "post",
        purpose: "Observe or augment a minted token result.",
      },
    ],
    customization: {
      config: ["defaultTtlSeconds", "issuer", "jwksCacheSeconds"],
      hooks: ["beforeMintToken", "afterTokenMinted"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "identity",
    name: "Identity",
    version: "0.1.0",
    status: "available",
    category: "platform",
    summary: "Passwordless email-code login and server-side sessions backed by auth-scoped service tokens.",
    requires: ["auth"],
    optional: ["email", "audit-log"],
    storage: ["d1"],
    runtime: {
      framework: "sveltekit",
      mount: "/identity",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Identity", path: "/settings/identity", permission: "identity.admin", icon: "UserRoundCog" }],
        referenceUi: ["reference-ui/README.md"],
      },
      visitor: {
        applicable: true,
        featureKey: "login",
        referenceUi: ["reference-ui/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "identity.requestLoginCode",
          "identity.verifyLoginCode",
          "identity.readSession",
          "identity.destroySession",
        ],
        skillPaths: ["skills/identity-operator/SKILL.md"],
        approvalRequired: [
          "identity.requestLoginCode",
          "identity.verifyLoginCode",
          "identity.destroySession",
        ],
      },
    }),
    eventsEmitted: [
      "identity.login_code_issued",
      "identity.login_verified",
      "identity.session_created",
      "identity.session_destroyed",
    ],
    eventsConsumed: [],
    permissions: [
      "identity.login",
      "identity.session",
      "identity.admin",
      "identity.extend",
      "identity.observe",
    ],
    rpc: [
      { method: "requestLoginCode", scope: "identity.login", public: false },
      { method: "verifyLoginCode", scope: "identity.login", public: false },
      { method: "readSession", scope: "identity.session", public: false },
      { method: "destroySession", scope: "identity.session", public: false },
    ],
    hooks: [
      {
        name: "beforeVerifyCode",
        timing: "pre",
        purpose: "Guard login code verification before a session is created.",
      },
      {
        name: "afterSessionCreated",
        timing: "post",
        purpose: "Observe session creation for audit, notification, or login support workflows.",
      },
    ],
    customization: {
      config: ["sessionTtlSeconds", "loginCodeTtlSeconds"],
      hooks: ["beforeVerifyCode", "afterSessionCreated"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "gateway",
    name: "Gateway",
    version: "0.1.0",
    status: "available",
    category: "platform",
    summary: "Public trust boundary: API-key authentication, rate limiting, scope narrowing, and token exchange via auth.",
    requires: ["auth"],
    optional: ["audit-log"],
    storage: ["d1", "kv"],
    runtime: {
      framework: "hono",
      mount: "/gateway",
      bindings: ["DB", "RATE_LIMIT_KV"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Gateway", path: "/settings/api-keys", permission: "gateway.admin" }],
      },
      agentic: {
        applicable: true,
        tools: ["gateway.issueToken", "gateway.inspectRateLimit"],
        approvalRequired: ["gateway.issueToken", "gateway.createApiKey", "gateway.revokeApiKey"],
      },
    }),
    eventsEmitted: ["gateway.token_issued", "gateway.access_denied"],
    eventsConsumed: [],
    permissions: ["gateway.admin"],
    rpc: [],
    hooks: [
      {
        name: "beforeIssueToken",
        timing: "pre",
        purpose: "Narrow scopes, attach claims, or reject issuance before minting.",
      },
      {
        name: "afterTokenIssued",
        timing: "post",
        purpose: "Observe issued tokens for analytics or audit.",
      },
    ],
    customization: {
      config: ["tokenTtlSeconds", "rateLimit", "rateWindowSeconds"],
      hooks: ["beforeIssueToken", "afterTokenIssued"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "customer",
    name: "Customer",
    version: "0.1.0",
    status: "available",
    category: "core",
    summary: "Customer profiles, tags, lifecycle state, consent fields, and customer events.",
    requires: ["auth"],
    optional: ["email", "audit-log"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/customers",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Customers", path: "/customers", permission: "customer.read", icon: "Users" }],
      },
      visitor: {
        applicable: true,
        featureKey: "memberProfile",
      },
      agentic: {
        applicable: true,
        tools: ["customer.getCustomer", "customer.listCustomers", "customer.upsertCustomer"],
        approvalRequired: ["customer.upsertCustomer", "customer.deleteCustomer"],
      },
    }),
    eventsEmitted: ["customer.created", "customer.updated"],
    eventsConsumed: [],
    permissions: ["customer.read", "customer.write", "customer.admin"],
    rpc: [
      { method: "getCustomer", scope: "customer.read", public: false },
      { method: "listCustomers", scope: "customer.read", public: false },
      { method: "upsertCustomer", scope: "customer.write", public: false },
    ],
    hooks: [
      {
        name: "beforeCustomerCreate",
        timing: "pre",
        purpose: "Normalize incoming customer data and enforce business-specific required fields.",
      },
      {
        name: "afterCustomerUpdated",
        timing: "post",
        purpose: "Sync customer changes to external CRMs or notification flows.",
      },
    ],
    customization: {
      config: ["profileFields", "tags", "segments", "consentFields"],
      hooks: ["beforeCustomerCreate", "afterCustomerUpdated"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  ...INTERNAL_CATALOG_MODULES,
  {
    id: "booking",
    name: "Booking",
    version: "0.1.0",
    status: "available",
    category: "vertical",
    summary: "Service booking, availability, cancellation windows, confirmation, and booking events.",
    requires: ["auth", "customer"],
    optional: ["payment", "email", "staff", "audit-log"],
    storage: ["d1", "kv"],
    runtime: {
      framework: "hono",
      mount: "/bookings",
      bindings: ["DB", "CACHE_KV", "NOTIFICATIONS"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Bookings", path: "/bookings", permission: "booking.read", icon: "CalendarDays" }],
      },
      visitor: {
        applicable: true,
        featureKey: "spaces",
      },
      agentic: {
        applicable: true,
        tools: ["booking.listBookings", "booking.getBooking", "booking.getAvailability", "booking.createBooking", "booking.cancelBooking"],
        approvalRequired: ["booking.createBooking", "booking.cancelBooking"],
      },
    }),
    eventsEmitted: ["booking.created", "booking.confirmed", "booking.cancelled"],
    eventsConsumed: ["customer.created", "payment.succeeded"],
    permissions: ["booking.read", "booking.write", "booking.admin"],
    rpc: [
      { method: "listBookings", scope: "booking.read", public: false },
      { method: "getBooking", scope: "booking.read", public: false },
      { method: "getAvailability", scope: "booking.read", public: false },
    ],
    hooks: [
      {
        name: "beforeBookingCreate",
        timing: "pre",
        purpose: "Validate booking rules before a booking record is created.",
      },
      {
        name: "calculateAvailability",
        timing: "compute",
        purpose: "Replace or adjust generated availability slots with business-specific rules.",
      },
      {
        name: "afterBookingConfirmed",
        timing: "post",
        purpose: "Run post-confirmation workflows such as reminders or payment capture.",
      },
    ],
    customization: {
      config: [
        "serviceTypes",
        "slotIntervalMinutes",
        "defaultDurationMinutes",
        "leadTimeMinutes",
        "cancellationWindowHours",
        "allowWaitlist",
      ],
      hooks: ["beforeBookingCreate", "calculateAvailability", "afterBookingConfirmed"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "audit-log",
    name: "Audit Log",
    version: "0.1.0",
    status: "available",
    category: "sink",
    summary: "Append-only audit trail. Pure event sink: records domain events from a signed queue or direct calls.",
    requires: [],
    optional: [],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/audit",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Audit Log", path: "/settings/audit-log", permission: "audit.read" }],
      },
      agentic: {
        applicable: true,
        tools: ["audit.listEvents", "audit.exportEvents"],
        approvalRequired: ["audit.exportEvents"],
      },
    }),
    eventsEmitted: ["audit.recorded", "audit.exported"],
    eventsConsumed: [],
    permissions: ["audit.read", "audit.export", "audit.admin"],
    rpc: [],
    hooks: [
      {
        name: "redactAuditPayload",
        timing: "pre",
        purpose: "Redact or drop sensitive fields before an audit record is persisted.",
      },
      {
        name: "beforeAuditExport",
        timing: "pre",
        purpose: "Filter or guard an audit export request.",
      },
    ],
    customization: {
      config: ["requireSignedEnvelope", "defaultListLimit"],
      hooks: ["redactAuditPayload", "beforeAuditExport"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "payment",
    name: "Payment",
    version: "0.1.0",
    status: "available",
    category: "provider",
    summary: "Stripe-backed payment provider: create payment intents, record payments, and verify signed Stripe webhooks. Emits payment lifecycle events.",
    requires: ["auth", "customer"],
    optional: ["audit-log"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/payments",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Payments", path: "/payments", permission: "payment.read", icon: "CreditCard" }],
      },
      visitor: {
        applicable: true,
        featureKey: "payments",
      },
      agentic: {
        applicable: true,
        tools: ["payment.createPaymentIntent", "payment.listPayments", "payment.refundPayment"],
        approvalRequired: ["payment.createPaymentIntent", "payment.refundPayment"],
      },
    }),
    secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    eventsEmitted: ["payment.checkout_created", "payment.succeeded", "payment.refunded", "payment.failed"],
    eventsConsumed: [],
    permissions: ["payment.read", "payment.write", "payment.admin"],
    rpc: [
      { method: "createPaymentIntent", scope: "payment.write", public: false },
    ],
    hooks: [
      {
        name: "beforeCreatePaymentIntent",
        timing: "pre",
        purpose: "Adjust or validate intent input before the gateway call.",
      },
      {
        name: "afterPaymentSucceeded",
        timing: "post",
        purpose: "Run side-effects after a payment is marked succeeded.",
      },
    ],
    customization: {
      config: ["defaultCurrency", "requireWebhookSecret", "defaultListLimit"],
      hooks: ["beforeCreatePaymentIntent", "afterPaymentSucceeded"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "billing-subscriptions",
    name: "Billing & Subscriptions",
    version: "0.1.0",
    status: "available",
    category: "provider",
    approvalRisk: "high",
    summary:
      "Recurring plans and subscription state on top of Stripe: a complete status state machine, idempotent webhook application, plan changes, metered usage, and dunning hooks.",
    requires: [],
    optional: ["payment", "org-team-rbac", "jobs-workflows", "audit-log"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/billing",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Billing", path: "/settings/billing", permission: "billing.read", icon: "Receipt" }],
      },
      agentic: {
        applicable: true,
        tools: ["billing.listPlans", "billing.startSubscription", "billing.changePlan", "billing.cancelSubscription"],
        approvalRequired: ["billing.startSubscription", "billing.changePlan", "billing.cancelSubscription"],
      },
    }),
    eventsEmitted: [
      "subscription.started",
      "subscription.activated",
      "subscription.past_due",
      "subscription.canceled",
      "subscription.plan_changed",
    ],
    eventsConsumed: [],
    permissions: [
      "billing.read",
      "billing.write",
      "billing.admin",
      "billing-subscriptions.extend",
      "billing-subscriptions.observe",
    ],
    rpc: [
      { method: "startSubscription", scope: "billing.write", public: false },
      { method: "applyStripeEvent", scope: "billing.write", public: false },
    ],
    hooks: [
      {
        name: "beforeSubscriptionChange",
        timing: "pre",
        purpose: "Guard or adjust a subscription transition before it is persisted.",
      },
      {
        name: "onSubscriptionActivated",
        timing: "post",
        purpose: "Observe activation to grant access, notify users, or update downstream records.",
      },
      {
        name: "onSubscriptionPastDue",
        timing: "post",
        purpose: "Observe past-due transitions to start dunning or restrict risky operations.",
      },
    ],
    customization: {
      config: ["plans", "trialDays", "usageMeters", "dunning"],
      hooks: ["beforeSubscriptionChange", "onSubscriptionActivated", "onSubscriptionPastDue"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "idempotency",
    name: "Idempotency",
    version: "0.1.0",
    status: "available",
    category: "core",
    summary: "Scoped idempotency records for safe retry, replay, and duplicate side-effect prevention.",
    requires: [],
    optional: ["audit-log", "jobs-workflows"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/idempotency",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      agentic: {
        applicable: true,
        tools: ["idempotency.getRecord", "idempotency.inspectReplay"],
      },
    }),
    eventsEmitted: [
      "idempotency.claimed",
      "idempotency.replayed",
      "idempotency.completed",
      "idempotency.failed",
      "idempotency.expired_pruned",
    ],
    eventsConsumed: [],
    permissions: ["idempotency.claim", "idempotency.read", "idempotency.admin"],
    rpc: [
      { method: "claimIdempotency", scope: "idempotency.claim", public: false },
      { method: "getIdempotencyRecord", scope: "idempotency.read", public: false },
    ],
    hooks: [
      {
        name: "beforeIdempotencyClaim",
        timing: "pre",
        purpose: "Validate, enrich, or reject a claim before it is persisted or replayed.",
      },
      {
        name: "afterIdempotencyComplete",
        timing: "post",
        purpose: "Observe a completed idempotency record for audit or activity feeds.",
      },
      {
        name: "onIdempotencyReplay",
        timing: "post",
        purpose: "Observe terminal record replay without creating a duplicate side effect.",
      },
    ],
    customization: {
      config: ["defaultTtlMs", "defaultLockTtlMs", "maxTtlMs"],
      hooks: ["beforeIdempotencyClaim", "afterIdempotencyComplete", "afterIdempotencyFail", "onIdempotencyReplay"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: false, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "webhook-delivery",
    name: "Webhook Delivery",
    version: "0.1.0",
    status: "available",
    category: "sink",
    summary: "Outbound mirror of the event bus: registers external endpoints (per-endpoint signing secret), delivers HMAC-signed domain events, and logs delivery attempts.",
    requires: [],
    optional: ["audit-log"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/webhooks",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Webhooks", path: "/settings/webhooks", permission: "webhook.read" }],
      },
      agentic: {
        applicable: true,
        tools: ["webhook.listEndpoints", "webhook.registerEndpoint", "webhook.deliverTestEvent"],
        approvalRequired: ["webhook.registerEndpoint", "webhook.deliverTestEvent"],
      },
    }),
    // External outbound HTTP side-effects make this approval-gated despite being
    // a sink (audit-log, also a sink, stays medium — it never leaves the account).
    approvalRisk: "high",
    secrets: [],
    eventsEmitted: ["webhook.delivered", "webhook.failed"],
    eventsConsumed: [],
    permissions: ["webhook.read", "webhook.write", "webhook.admin"],
    rpc: [],
    hooks: [
      {
        name: "beforeWebhookDeliver",
        timing: "pre",
        purpose: "Adjust or drop an outbound event before delivery.",
      },
      {
        name: "afterWebhookDelivered",
        timing: "post",
        purpose: "Observe a delivery attempt result.",
      },
    ],
    customization: {
      config: ["defaultListLimit", "maxRetries"],
      hooks: ["beforeWebhookDeliver", "afterWebhookDelivered"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "document-extraction",
    name: "Document Extraction",
    version: "0.1.0",
    status: "draft",
    category: "core",
    summary:
      "Local-first scanned document extraction: file references, OCR/LLM drafts, schema normalization, source evidence, human review, and governed Gemma/AI fallback.",
    requires: [],
    optional: ["auth", "org-team-rbac", "audit-log", "file-media", "forms-intake", "ai-gateway", "jobs-workflows", "invoice", "customer", "support-ticket"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/documents",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Documents", path: "/documents", permission: "document-extraction.read", icon: "FileText" }],
      },
      visitor: {
        applicable: true,
        featureKey: "documentIntake",
      },
      agentic: {
        applicable: true,
        tools: [
          "document-extraction.createExtractionJob",
          "document-extraction.submitExtractionDraft",
          "document-extraction.reviewExtraction",
          "document-extraction.getExtractionJob",
          "document-extraction.listExtractionJobs",
          "document-extraction.normalizeExtraction",
        ],
        approvalRequired: [
          "document-extraction.reviewExtraction",
          "document-extraction.normalizeExtraction",
          "document-extraction.modelDownload",
          "ai-gateway.complete",
        ],
      },
    }),
    eventsEmitted: [
      "document-extraction.job_created",
      "document-extraction.draft_submitted",
      "document-extraction.approved",
      "document-extraction.rejected",
      "document-extraction.failed",
    ],
    eventsConsumed: [],
    permissions: [
      "document-extraction.read",
      "document-extraction.write",
      "document-extraction.review",
      "document-extraction.admin",
      "document-extraction.extend",
      "document-extraction.observe",
    ],
    rpc: [
      { method: "createExtractionJob", scope: "document-extraction.write", public: false },
      { method: "submitExtractionDraft", scope: "document-extraction.write", public: false },
      { method: "reviewExtraction", scope: "document-extraction.review", public: false },
      { method: "getExtractionJob", scope: "document-extraction.read", public: false },
      { method: "listExtractionJobs", scope: "document-extraction.read", public: false },
      { method: "normalizeExtraction", scope: "document-extraction.write", public: false },
    ],
    hooks: [
      {
        name: "beforeExtractionJobCreate",
        timing: "pre",
        purpose: "Guard document intake, schema selection, and file references before a review job is created.",
      },
      {
        name: "beforeExtractionDraftSubmit",
        timing: "pre",
        purpose: "Reject or adjust OCR/LLM drafts before they enter the review queue.",
      },
      {
        name: "afterExtractionReviewed",
        timing: "post",
        purpose: "Observe approval/rejection for audit, notifications, or target-record creation.",
      },
    ],
    customization: {
      config: ["mode", "reviewRequired", "minConfidenceForApproval", "localBrowser", "gatewayFallback", "sidecar"],
      hooks: ["beforeExtractionJobCreate", "beforeExtractionDraftSubmit", "afterExtractionReviewed"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: false, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "code-memory",
    name: "Code Memory",
    version: "0.1.0",
    status: "draft",
    category: "core",
    summary: "Trusted Sources, immutable source versions, Logic Capsules, and audit events for private reusable code memory.",
    requires: ["identity"],
    optional: ["audit-log", "jobs-workflows"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/code-memory",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Code Memory", path: "/code-memory", permission: "code-memory.read", icon: "DatabaseZap" }],
      },
      agentic: {
        applicable: true,
        tools: [
          "code-memory.addTrustedSource",
          "code-memory.listTrustedSources",
          "code-memory.recordSourceScan",
          "code-memory.createLogicCapsule",
          "code-memory.searchLogicCapsules",
          "code-memory.getLogicCapsule",
          "code-memory.approveLogicCapsule",
          "code-memory.rejectLogicCapsule",
        ],
        skillPaths: ["skills/code-memory-operator/SKILL.md"],
        approvalRequired: [
          "code-memory.addTrustedSource",
          "code-memory.recordSourceScan",
          "code-memory.createLogicCapsule",
          "code-memory.approveLogicCapsule",
          "code-memory.rejectLogicCapsule",
        ],
      },
    }),
    eventsEmitted: [
      "code-memory.source.added",
      "code-memory.source.scanned",
      "code-memory.capsule.created",
      "code-memory.capsule.approved",
      "code-memory.capsule.rejected",
      "code-memory.capsule.retrieved",
    ],
    eventsConsumed: [],
    permissions: [
      "code-memory.read",
      "code-memory.write",
      "code-memory.approve",
      "code-memory.admin",
      "code-memory.observe",
    ],
    rpc: [
      { method: "addTrustedSource", scope: "code-memory.write", public: false },
      { method: "listTrustedSources", scope: "code-memory.read", public: false },
      { method: "recordSourceScan", scope: "code-memory.write", public: false },
      { method: "createLogicCapsule", scope: "code-memory.write", public: false },
      { method: "searchLogicCapsules", scope: "code-memory.read", public: false },
      { method: "getLogicCapsule", scope: "code-memory.read", public: false },
      { method: "approveLogicCapsule", scope: "code-memory.approve", public: false },
      { method: "rejectLogicCapsule", scope: "code-memory.approve", public: false },
    ],
    hooks: [
      {
        name: "beforeTrustedSourceAdd",
        timing: "pre",
        purpose: "Guard repository URL, visibility, and allowed paths before adding a Trusted Source.",
      },
      {
        name: "beforeLogicCapsuleCreate",
        timing: "pre",
        purpose: "Reject or adjust candidate capsule metadata before persistence.",
      },
      {
        name: "afterLogicCapsuleRetrieved",
        timing: "post",
        purpose: "Observe approved capsule retrieval for audit or usage reporting.",
      },
    ],
    customization: {
      config: ["defaultProvider", "maxAllowedPaths"],
      hooks: ["beforeTrustedSourceAdd", "beforeLogicCapsuleCreate", "afterLogicCapsuleRetrieved"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: true, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
  {
    id: "operator-work",
    name: "Operator Work",
    version: "0.1.0",
    status: "draft",
    category: "core",
    summary: "Agent-readable task board, focus plan, daily review, and auditable operator work state for DOT AI OS.",
    approvalRisk: "medium",
    requires: ["org-team-rbac"],
    optional: ["audit-log", "jobs-workflows", "calendar-google", "email"],
    storage: ["d1"],
    runtime: {
      framework: "hono",
      mount: "/operator-work",
      bindings: ["DB"],
    },
    surfaces: moduleSurfaces({
      admin: {
        applicable: true,
        nav: [{ label: "Operator Work", path: "/operator-work", permission: "operator-work.read", icon: "ListTodo" }],
        referenceUi: ["reference-ui/README.md"],
      },
      agentic: {
        applicable: true,
        tools: [
          "operator-work.getOperatorWorkbench",
          "operator-work.listOperatorTasks",
          "operator-work.upsertOperatorTask",
          "operator-work.updateOperatorTaskStatus",
          "operator-work.listFocusBlocks",
          "operator-work.upsertFocusBlock",
          "operator-work.listDailyReviews",
          "operator-work.saveDailyReview",
        ],
        skillPaths: ["skills/operator-work-operator/SKILL.md"],
        approvalRequired: [
          "operator-work.upsertOperatorTask",
          "operator-work.updateOperatorTaskStatus",
          "operator-work.upsertFocusBlock",
          "operator-work.saveDailyReview",
        ],
      },
    }),
    eventsEmitted: [
      "operator-work.task.upserted",
      "operator-work.task.status_changed",
      "operator-work.focus_block.upserted",
      "operator-work.daily_review.saved",
    ],
    eventsConsumed: [],
    permissions: [
      "operator-work.read",
      "operator-work.write",
      "operator-work.admin",
      "operator-work.extend",
      "operator-work.observe",
    ],
    rpc: [
      { method: "getOperatorWorkbench", scope: "operator-work.read", public: false },
      { method: "listOperatorTasks", scope: "operator-work.read", public: false },
      { method: "upsertOperatorTask", scope: "operator-work.write", public: false },
      { method: "updateOperatorTaskStatus", scope: "operator-work.write", public: false },
      { method: "listFocusBlocks", scope: "operator-work.read", public: false },
      { method: "upsertFocusBlock", scope: "operator-work.write", public: false },
      { method: "listDailyReviews", scope: "operator-work.read", public: false },
      { method: "saveDailyReview", scope: "operator-work.write", public: false },
    ],
    hooks: [
      {
        name: "beforeOperatorTaskUpsert",
        timing: "pre",
        purpose: "Normalize or guard task writes before persistence.",
      },
      {
        name: "afterOperatorTaskUpdated",
        timing: "post",
        purpose: "Observe created or updated tasks for audit, notifications, or agent handoff workflows.",
      },
      {
        name: "beforeFocusBlockUpsert",
        timing: "pre",
        purpose: "Normalize or guard focus plan writes before persistence.",
      },
      {
        name: "beforeDailyReviewSave",
        timing: "pre",
        purpose: "Normalize or guard daily review saves before persistence.",
      },
    ],
    customization: {
      config: ["maxTasks", "allowAgentDrafts", "requireReviewBeforeUnlock"],
      hooks: ["beforeOperatorTaskUpsert", "afterOperatorTaskUpdated", "beforeFocusBlockUpsert", "beforeDailyReviewSave"],
      forkable: true,
    },
    quality: {
      tests: { unit: true, integration: false, fixtures: true },
      agentDocs: true,
      migrations: true,
      upgradeNotes: true,
    },
  },
]);

const HONO_WORKER_RUNTIME = Object.freeze({
  language: "typescript",
  framework: "hono",
  platform: "cloudflare-workers",
  storage: ["d1", "kv"],
});

const SVELTEKIT_WORKER_RUNTIME = Object.freeze({
  language: "typescript",
  framework: "sveltekit",
  platform: "cloudflare-workers",
  storage: ["d1", "kv"],
});

const ASTRO_STATIC_RUNTIME = Object.freeze({
  language: "typescript",
  framework: "astro",
  platform: "static",
  storage: [],
});

const ASTRO_WORKER_RUNTIME = Object.freeze({
  language: "typescript",
  framework: "astro",
  platform: "cloudflare-workers",
  storage: ["d1", "r2"],
});

const REPO_TEMPLATE_SUCCESS_CRITERIA = Object.freeze([
  "Template is scaffolded by create-microservices-app with source-visible module packages.",
  "microservices.template.json, microservices.config.json, and microservices.lock.json agree on template intent.",
  "Workspace template checks pass before marking the template ready.",
]);

function appConfig(appName, appSlug, extra = {}) {
  return {
    appName,
    appSlug,
    ...extra,
  };
}

function repoTemplate({
  id,
  name,
  version = "0.1.0",
  status = "ready",
  summary,
  targetCustomer,
  defaultModules = [],
  optionalModules = [],
  targetRuntime = SVELTEKIT_WORKER_RUNTIME,
  defaultConfig = {},
  successCriteria = REPO_TEMPLATE_SUCCESS_CRITERIA,
}) {
  return {
    id,
    name,
    version,
    status,
    summary,
    targetCustomer,
    defaultModules,
    optionalModules,
    targetRuntime,
    defaultConfig: {
      ...appConfig(name, id),
      ...defaultConfig,
    },
    successCriteria,
  };
}

const TEMPLATES = Object.freeze([
  {
    id: "booking-business",
    name: "Booking Business",
    version: "0.1.0",
    status: "available",
    summary: "A bookable service business foundation for studios, clinics, consultants, and local operators.",
    targetCustomer: "AI-heavy agencies, consultants, and technical founders building custom booking systems.",
    defaultModules: ["gateway", "auth", "customer", "booking"],
    optionalModules: ["email", "payment", "admin", "audit-log", "idempotency", "webhook-delivery"],
    targetRuntime: HONO_WORKER_RUNTIME,
    defaultConfig: {
      appName: "Booking Business",
      appSlug: "booking-business",
      timezone: "UTC",
      currency: "USD",
      auth: {
        defaultRole: "member",
        sessionTtlSeconds: 604800,
      },
      customer: {
        profileFields: ["name", "email", "phone", "notes"],
        consentFields: ["emailMarketingConsent"],
      },
      booking: {
        serviceTypes: ["consultation", "standard-service"],
        slotIntervalMinutes: 30,
        defaultDurationMinutes: 60,
        leadTimeMinutes: 120,
        cancellationWindowHours: 24,
        maxFutureDays: 90,
        allowWaitlist: false,
      },
    },
    successCriteria: [
      "Generated Hono Worker can run locally with Wrangler.",
      "Generated schema includes account, customer, booking, event, and audit tables.",
      "Hooks are explicit files an agent can customize without changing module internals.",
      "Module lock records exact module versions used for upgrade comparison.",
    ],
  },
  repoTemplate({
    id: "booking-sveltekit",
    name: "Booking SvelteKit",
    summary: "Full Cloudflare SvelteKit booking app template with detached booking API/domain logic.",
    targetCustomer: "Service businesses that need public booking, membership credits, payments, and operator admin.",
    defaultModules: ["gateway", "auth", "identity", "customer", "booking", "audit-log", "payment", "membership-credits", "email"],
    optionalModules: ["admin-shell", "webhook-delivery"],
    defaultConfig: {
      business: { name: "Booking Business", timezone: "UTC", currency: "USD" },
      booking: {
        serviceTypes: ["consultation", "standard-service"],
        slotIntervalMinutes: 30,
        defaultDurationMinutes: 60,
        leadTimeMinutes: 120,
        cancellationWindowHours: 24,
        maxFutureDays: 90,
        allowWaitlist: false,
      },
    },
  }),
  repoTemplate({
    id: "company-landing-astro",
    name: "Company Landing (Astro)",
    version: "0.2.0",
    summary: "Static editorial company landing page on Astro with content contracts and zero backend modules.",
    targetCustomer: "Founders and agencies that need an agent-editable marketing site before a full app.",
    targetRuntime: ASTRO_STATIC_RUNTIME,
    defaultModules: [],
    optionalModules: [],
    defaultConfig: appConfig("Company Landing", "company-landing"),
  }),
  repoTemplate({
    id: "wordpress-emdash-blog-astro",
    name: "WordPress to EmDash Blog (Astro)",
    status: "experimental",
    summary: "Cloudflare Astro and EmDash template for content-only WordPress blog migrations.",
    targetCustomer: "Content-heavy businesses migrating WordPress blogs to a Cloudflare-native static or edge setup.",
    targetRuntime: ASTRO_WORKER_RUNTIME,
    defaultModules: [],
    optionalModules: ["forms-intake", "email", "audit-log"],
  }),
  repoTemplate({
    id: "saas-starter-sveltekit",
    name: "SaaS Starter SvelteKit",
    summary: "Multi-tenant B2B SaaS starter with org signup, team RBAC, subscription billing, payments, admin, and audit log.",
    targetCustomer: "B2B SaaS founders who need tenancy and billing before domain-specific modules.",
    defaultModules: ["auth", "identity", "email", "org-team-rbac", "billing-subscriptions", "admin-shell", "audit-log", "payment"],
    optionalModules: ["webhook-delivery", "notifications-inapp"],
  }),
  repoTemplate({
    id: "saas-growth-sveltekit",
    name: "SaaS Growth SvelteKit",
    summary: "Multi-tenant SaaS starter with billing plus AI image generation, ads monitoring, and marketing research.",
    targetCustomer: "Growth-focused SaaS teams that want billing and marketing operations in one Cloudflare app.",
    defaultModules: [
      "auth",
      "identity",
      "email",
      "org-team-rbac",
      "billing-subscriptions",
      "admin-shell",
      "audit-log",
      "payment",
      "image-generation",
      "ads-manager",
      "marketing-research",
    ],
    optionalModules: ["webhook-delivery", "notifications-inapp"],
  }),
  repoTemplate({
    id: "client-portal-sveltekit",
    name: "Client Portal SvelteKit",
    summary: "Auth-gated Cloudflare SvelteKit client portal for customer invoices, files, storage quota, and account access.",
    targetCustomer: "Agencies and service businesses that need a customer portal with invoice and file visibility.",
    defaultModules: ["auth", "identity", "email", "gateway", "customer", "invoice", "file-media", "storage-entitlements", "audit-log"],
    optionalModules: ["payment", "admin-shell", "webhook-delivery"],
  }),
  repoTemplate({
    id: "dot-ai-os",
    name: "DOT AI OS",
    status: "private-pilot",
    summary: "Private-pilot operator OS for tasks, focus planning, knowledge, content pipelines, files, team roles, and business modules.",
    targetCustomer: "Private pilot users building an agent-native operating workspace on Cloudflare SvelteKit.",
    defaultModules: [
      "auth",
      "org-team-rbac",
      "admin-shell",
      "audit-log",
      "customer",
      "support-ticket",
      "knowledge-base-rag",
      "invoice",
      "file-media",
      "identity",
      "jobs-workflows",
      "notifications-inapp",
      "operator-work",
    ],
    optionalModules: ["email", "calendar-google", "webhook-delivery"],
  }),
  repoTemplate({
    id: "erp-shell-sveltekit",
    name: "ERP Shell SvelteKit",
    summary: "Single-company ERP shell with employees, roles, customers, invoices, files, support, and operational module slots.",
    targetCustomer: "Internal-tool teams and agencies composing ERP workflows from source-visible modules.",
    defaultModules: [
      "auth",
      "org-team-rbac",
      "admin-shell",
      "audit-log",
      "customer",
      "support-ticket",
      "support-inbox",
      "project-progress",
      "product-catalog",
      "inventory",
      "sales-order",
      "shipment",
      "commerce-sync",
      "accounting-core",
      "accounts-payable",
      "accounts-receivable",
      "bank-reconciliation",
      "invoice",
      "payment",
      "billing-subscriptions",
      "image-generation",
      "ads-manager",
      "forms-intake",
      "sms-campaigns",
      "booking",
      "file-media",
      "identity",
      "jobs-workflows",
      "notifications-inapp",
      "webhook-delivery",
    ],
    optionalModules: ["email"],
  }),
  repoTemplate({
    id: "commerce-ops-sveltekit",
    name: "Commerce Ops SvelteKit",
    summary: "Commerce operations template for products, inventory, sales orders, fulfillment, sync, invoices, payments, files, and jobs.",
    targetCustomer: "Commerce operators porting invoice, order, inventory, and fulfillment workflows into a Cloudflare app.",
    defaultModules: [
      "gateway",
      "auth",
      "org-team-rbac",
      "admin-shell",
      "audit-log",
      "customer",
      "support-ticket",
      "product-catalog",
      "inventory",
      "sales-order",
      "shipment",
      "commerce-sync",
      "invoice",
      "payment",
      "file-media",
      "identity",
      "jobs-workflows",
      "email",
      "notifications-inapp",
      "webhook-delivery",
    ],
    optionalModules: [],
  }),
  repoTemplate({
    id: "accounting-erp-sveltekit",
    name: "Accounting ERP SvelteKit",
    summary: "Accounting ERP template for general ledger, payables, receivables, bank reconciliation, quotes, invoices, payments, webhooks, and jobs.",
    targetCustomer: "Accounting and back-office operators porting StackSuite-style AP, AR, banking, and invoice workflows.",
    defaultModules: [
      "gateway",
      "auth",
      "org-team-rbac",
      "admin-shell",
      "audit-log",
      "customer",
      "support-ticket",
      "accounting-core",
      "accounts-payable",
      "accounts-receivable",
      "bank-reconciliation",
      "estimate-quote",
      "recurring-documents",
      "invoice",
      "payment",
      "file-media",
      "identity",
      "jobs-workflows",
      "email",
      "notifications-inapp",
      "webhook-delivery",
    ],
    optionalModules: [],
  }),
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function createContractError(code, message, remediation, details = {}) {
  const error = new Error(message);
  error.name = "MicroservicesContractError";
  error.code = code;
  error.remediation = remediation;
  error.details = details;
  return error;
}

function moduleSummary(module) {
  return {
    id: module.id,
    name: module.name,
    version: module.version,
    status: module.status,
    category: module.category,
    summary: module.summary,
    requires: clone(module.requires),
    mount: module.runtime.mount,
    ...(module.interactive ? { interactive: clone(module.interactive) } : {}),
    ...(module.skills ? { skills: clone(module.skills) } : {}),
    ...(module.surfaces ? { surfaces: clone(module.surfaces) } : {}),
  };
}

function templateSummary(template) {
  return {
    id: template.id,
    name: template.name,
    version: template.version,
    status: template.status,
    summary: template.summary,
    defaultModules: clone(template.defaultModules),
    optionalModules: clone(template.optionalModules),
    ...(template.interactive ? { interactive: clone(template.interactive) } : {}),
    ...(template.skills ? { skills: clone(template.skills) } : {}),
  };
}

function findById(items, id, kind) {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) {
    throw createContractError(
      `${kind.toUpperCase()}_NOT_FOUND`,
      `Unknown ${kind}: ${id}`,
      `Run "${kind}s list --json" and select one of the returned ids.`,
      { id }
    );
  }
  return item;
}

export function parseModuleRef(value, explicitVersion = null) {
  const raw = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  const at = raw.lastIndexOf("@");
  const inline =
    at > 0
      ? {
          id: raw.slice(0, at),
          version: raw.slice(at + 1) || null,
        }
      : {
          id: raw,
          version: null,
        };
  const version = explicitVersion ? String(explicitVersion).trim() : inline.version;

  if (inline.version && explicitVersion && inline.version !== String(explicitVersion).trim()) {
    throw createContractError(
      "MODULE_VERSION_CONFLICT",
      `Conflicting versions requested for module ${inline.id}.`,
      "Use either module@version or --version/--to, not both with different versions.",
      { moduleId: inline.id, inlineVersion: inline.version, explicitVersion: String(explicitVersion).trim() }
    );
  }

  return {
    id: inline.id,
    version,
    raw,
  };
}

export function availableModuleVersions(id) {
  const versions = MODULES.filter((candidate) => candidate.id === id).map((module) => module.version);
  if (!versions.length) {
    throw createContractError(
      "MODULE_NOT_FOUND",
      `Unknown module: ${id}`,
      'Run "modules list --json" and select one of the returned ids.',
      { id }
    );
  }
  return unique(versions);
}

function findModuleByRef(ref, explicitVersion = null) {
  const selector = parseModuleRef(ref, explicitVersion);
  const candidates = MODULES.filter((candidate) => candidate.id === selector.id);
  if (!candidates.length) {
    throw createContractError(
      "MODULE_NOT_FOUND",
      `Unknown module: ${selector.id}`,
      'Run "modules list --json" and select one of the returned ids.',
      { id: selector.id }
    );
  }

  const module = selector.version
    ? candidates.find((candidate) => candidate.version === selector.version)
    : candidates[candidates.length - 1];
  if (!module) {
    throw createContractError(
      "MODULE_VERSION_NOT_FOUND",
      `Module ${selector.id}@${selector.version} is not available in this registry snapshot.`,
      "Select one of the available versions or omit the version to use the current registry version.",
      {
        id: selector.id,
        moduleId: selector.id,
        requestedVersion: selector.version,
        availableVersions: candidates.map((candidate) => candidate.version),
      }
    );
  }

  return module;
}

function moduleRefString(module) {
  return `${module.id}@${module.version}`;
}

export function moduleReleaseTag(id, version) {
  return `modules/${id}/v${version}`;
}

export function moduleSourceRef(input, version = null) {
  const module = typeof input === "string" ? { id: input, version } : input;
  return {
    type: "git",
    repo: MODULE_SOURCE_REPO,
    url: MODULE_SOURCE_URL,
    tag: moduleReleaseTag(module.id, module.version),
    ref: `refs/tags/${moduleReleaseTag(module.id, module.version)}`,
    path: `modules/${module.id}`,
  };
}

function resolveModuleRefs(moduleRefs) {
  const explicitVersions = new Map();
  for (const value of moduleRefs) {
    const ref = parseModuleRef(value);
    if (!ref.id || !ref.version) continue;
    const existing = explicitVersions.get(ref.id);
    if (existing && existing !== ref.version) {
      throw createContractError(
        "MODULE_VERSION_CONFLICT",
        `Conflicting versions requested for module ${ref.id}.`,
        "Request a single version for each module.",
        { moduleId: ref.id, requestedVersions: [existing, ref.version] }
      );
    }
    explicitVersions.set(ref.id, ref.version);
  }

  const visited = new Set();
  const ordered = [];

  function visit(value) {
    const ref = parseModuleRef(value);
    const version = explicitVersions.get(ref.id) ?? ref.version;
    const module = findModuleByRef(ref.id, version);
    if (visited.has(module.id)) return;
    visited.add(module.id);
    for (const requiredId of module.requires) {
      visit(requiredId);
    }
    ordered.push(module);
  }

  for (const moduleRef of moduleRefs) {
    visit(moduleRef);
  }

  return ordered;
}

function mergeConfig(base, override) {
  if (!override || typeof override !== "object" || Array.isArray(override)) {
    return clone(base);
  }

  const output = clone(base);
  for (const [key, value] of Object.entries(override)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      output[key] &&
      typeof output[key] === "object" &&
      !Array.isArray(output[key])
    ) {
      output[key] = mergeConfig(output[key], value);
    } else {
      output[key] = clone(value);
    }
  }
  return output;
}

export function listModules() {
  return MODULES.map((module) => ({
    ...moduleSummary(module),
    latestVersion: module.version,
    availableVersions: availableModuleVersions(module.id),
    sourceRef: moduleSourceRef(module),
  }));
}

export function inspectModule(id) {
  return clone(findModuleByRef(id));
}

export function listTemplates() {
  return TEMPLATES.map(templateSummary);
}

export function inspectTemplate(id) {
  return clone(findById(TEMPLATES, id, "template"));
}

export function resolveModuleIds(moduleIds) {
  return resolveModuleRefs(moduleIds).map((module) => module.id);
}

export function createModuleLock(modules, template = null) {
  return {
    schemaVersion: CONTRACT_VERSION,
    generatedAt: "deterministic-local-preview",
    registry: {
      id: "microservices.sh",
      contractVersion: CONTRACT_VERSION,
    },
    generator: {
      package: "create-microservices-app",
      version: "0.0.0",
    },
    template: template
      ? {
          id: template.id,
          version: template.version,
          source: `registry:${template.id}@${template.version}`,
          checksum: `sha256:preview-${template.id}-${template.version}`,
        }
      : null,
    // App-level deploy topology (plans/24). Default is embedded; service mode is
    // opt-in and recorded per-module below.
    deploy: { mode: "embedded" },
    modules: modules.map((module) => ({
      id: module.id,
      version: module.version,
      source: `registry:${module.id}@${module.version}`,
      sourceRef: moduleSourceRef(module),
      checksum: `sha256:preview-${module.id}-${module.version}`,
      customizationMode: "config-hooks",
      // Per-module topology. In service mode this also carries worker + d1 names.
      mode: "embedded",
      contract: {
        mount: module.runtime.mount,
        bindings: clone(module.runtime.bindings),
        resources: module.storage.map((item) => item.toUpperCase()),
        permissions: clone(module.permissions),
        rpc: clone(module.rpc ?? []),
        hooks: module.hooks.map((hook) => hook.name),
        events: unique([...module.eventsEmitted, ...module.eventsConsumed]),
        requires: clone(module.requires),
        secrets: clone(module.secrets ?? []),
        surfaces: clone(module.surfaces ?? {}),
      },
    })),
    customizations: {
      config: true,
      hooks: modules.flatMap((module) => module.customization?.hooks ?? []),
      overlays: [],
      forks: [],
    },
  };
}

export function composeApp(input = {}) {
  const options = typeof input === "string" ? { templateId: input } : input;
  const templateId = options.templateId ?? options.template ?? "booking-business";
  const template = inspectTemplate(templateId);
  const requestedModules = unique([
    ...template.defaultModules,
    ...(options.modules ?? []),
  ]);
  const modules = resolveModuleRefs(requestedModules).map(clone);
  const resolvedModuleIds = modules.map((module) => module.id);
  const config = mergeConfig(template.defaultConfig, options.config);

  return {
    schemaVersion: CONTRACT_VERSION,
    compositionId: `cmp_${template.id}_${modules.map(moduleRefString).join("_")}`,
    template: templateSummary(template),
    config,
    modules,
    routes: modules.map((module) => ({
      module: module.id,
      mount: module.runtime.mount,
      framework: module.runtime.framework,
    })),
    bindings: unique(modules.flatMap((module) => module.runtime.bindings)),
    storage: unique(modules.flatMap((module) => module.storage)),
    permissions: unique(modules.flatMap((module) => module.permissions)),
    events: {
      emitted: unique(modules.flatMap((module) => module.eventsEmitted)),
      consumed: unique(modules.flatMap((module) => module.eventsConsumed)),
    },
    hooks: modules.flatMap((module) =>
      module.hooks.map((hook) => ({
        module: module.id,
        ...hook,
      }))
    ),
    checks: [
      "module-contract",
      "dependency-resolution",
      "worker-bindings",
      "schema-presence",
      "hook-surface",
      "audit-events",
    ],
    upgradePolicy: {
      mode: "contract-lock",
      lockfile: "microservices.lock.json",
      compatibleCustomization: ["config", "hooks"],
      manualCustomization: ["fork", "export"],
    },
    lock: createModuleLock(modules, template),
  };
}

export { CONTRACT_VERSION };
