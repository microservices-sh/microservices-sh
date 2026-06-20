<script lang="ts">
  import { onMount } from "svelte";
  import {
    Badge,
    Button,
    Card,
    EmptyState,
    MetricStrip,
    PageHeader,
    ResourceTable,
    type Metric,
    type Tone
  } from "./lib/ui";
  import {
    getRuntimeStatus,
    getSyncStatus,
    importDocumentPaths,
    loadQueueDocuments,
    listenForDroppedDocuments,
    selectImportFolder,
    type ImportFolder,
    type ImportResult,
    type QueueJob,
    type RuntimeStatus,
    type SyncStatus
  } from "./lib/desktop";

  type StatusKey = RuntimeStatus["ocr"] | SyncStatus["state"] | QueueJob["status"];

  let runtime: RuntimeStatus = { ocr: "checking", llm: "checking", model: "Checking", mode: "browser-preview" };
  let sync: SyncStatus = { baseUrl: "http://localhost:5174", state: "not-configured", pendingDrafts: 0 };
  let folder: ImportFolder | null = null;
  let jobs: QueueJob[] = [];
  let busy = false;
  let dragActive = false;
  let importMessage = "Select a folder to create local draft jobs.";
  let metrics: Metric[] = [];

  const statusLabel: Record<StatusKey, string> = {
    ready: "Ready",
    missing: "Missing",
    checking: "Checking",
    connected: "Connected",
    "not-configured": "Not Configured",
    offline: "Offline",
    extracting: "Extracting",
    review: "Review",
    synced: "Synced"
  };

  const kindLabel: Record<QueueJob["kind"], string> = {
    invoice: "Invoice",
    intake: "Intake",
    support: "Support"
  };

  $: reviewCount = jobs.filter((job) => job.status === "review").length;
  $: syncedCount = jobs.filter((job) => job.status === "synced").length;
  $: duplicateCount = folder?.duplicateDocuments ?? 0;
  $: skippedCount = folder?.skippedDocuments ?? 0;
  $: importedCount = folder?.newDocuments ?? jobs.length;
  $: metrics = [
    { label: "Queued", value: jobs.length, tone: jobs.length > 0 ? "info" : "neutral", hint: "local drafts" },
    { label: "Imported", value: importedCount, tone: importedCount > 0 ? "good" : "neutral", hint: "new documents" },
    { label: "Duplicates", value: duplicateCount, tone: duplicateCount > 0 ? "warn" : "neutral", hint: "hash matches" },
    { label: "Skipped", value: skippedCount, tone: skippedCount > 0 ? "warn" : "neutral", hint: "unsupported paths" },
    { label: "Review", value: reviewCount, tone: reviewCount > 0 ? "warn" : "neutral", hint: "needs approval" }
  ];

  async function refresh() {
    const [runtimeStatus, syncStatus, queued] = await Promise.all([
      getRuntimeStatus(),
      getSyncStatus(),
      jobs.length ? Promise.resolve(jobs) : loadQueueDocuments()
    ]);
    runtime = runtimeStatus;
    sync = syncStatus;
    jobs = queued;
  }

  async function chooseFolder() {
    busy = true;
    try {
      const result = await selectImportFolder();
      if (!result) return;

      applyImportResult(result);
    } finally {
      busy = false;
    }
  }

  async function importDroppedPaths(paths: string[]) {
    if (busy) return;

    if (!paths.length) {
      importMessage = "Drop did not include local file paths.";
      return;
    }

    busy = true;
    try {
      applyImportResult(await importDocumentPaths(paths));
    } finally {
      busy = false;
    }
  }

  function applyImportResult(result: ImportResult) {
    folder = result.folder;
    jobs = result.jobs;
    sync = { ...sync, pendingDrafts: jobs.filter((job) => job.status !== "synced").length };
    importMessage = [
      `${result.folder.newDocuments} new`,
      `${result.folder.duplicateDocuments} duplicates`,
      `${result.folder.skippedDocuments} skipped`
    ].join(", ");
  }

  function handleBrowserDrag(event: DragEvent) {
    event.preventDefault();
    if (runtime.mode === "browser-preview") {
      dragActive = true;
    }
  }

  function handleBrowserDrop(event: DragEvent) {
    event.preventDefault();
    dragActive = false;

    if (runtime.mode === "browser-preview") {
      importMessage = "Browser preview cannot read local file paths. Use desktop mode or Select Folder.";
    }
  }

  async function refreshRuntime() {
    runtime = await getRuntimeStatus();
  }

  function toneForStatus(status: StatusKey): Tone {
    if (status === "ready" || status === "connected" || status === "synced") return "good";
    if (status === "missing" || status === "offline") return "bad";
    if (status === "review" || status === "checking" || status === "extracting") return "warn";
    return "neutral";
  }

  function confidenceLabel(confidence: number) {
    return `${Math.round(confidence * 100)}%`;
  }

  onMount(() => {
    void refresh();

    let mounted = true;
    let unlisten = () => undefined;

    void listenForDroppedDocuments(importDroppedPaths, (active) => {
      dragActive = active;
    }).then((nextUnlisten) => {
      if (mounted) {
        unlisten = nextUnlisten;
      } else {
        nextUnlisten();
      }
    });

    return () => {
      mounted = false;
      unlisten();
    };
  });
</script>

<main class="desktop-shell">
  <aside class="desktop-rail" aria-label="Workspace">
    <div class="brand">
      <span class="brand-mark" aria-hidden="true">ms</span>
      <div>
        <p class="rail-eyebrow">microservices.sh</p>
        <h1>ERP Desktop</h1>
      </div>
    </div>

    <nav class="nav-list" aria-label="Sections">
      <a class="nav-item active" href="#import">Import Queue</a>
      <a class="nav-item" href="#runtime">Local Runtime</a>
      <a class="nav-item" href="#sync">Sync Status</a>
    </nav>

    <div class="rail-status">
      <p class="rail-eyebrow">Mode</p>
      <Badge tone={runtime.mode === "tauri" ? "good" : "info"}>
        {runtime.mode === "tauri" ? "Desktop" : "Browser Preview"}
      </Badge>
    </div>
  </aside>

  <section class="workspace" aria-label="Desktop intake workspace">
    <PageHeader
      eyebrow="Connected companion"
      title="Local intake bridge"
      description="Import scanned documents into a local draft queue, review extraction state, then sync approved records into ERP Shell."
    >
      {#snippet actions()}
        <Button onclick={refreshRuntime}>Runtime</Button>
        <Button variant="primary" onclick={chooseFolder} disabled={busy}>{busy ? "Scanning" : "Select Folder"}</Button>
      {/snippet}
      {#snippet meta()}
        <span>{folder?.path ?? "No folder selected"}</span>
        <span>{importMessage}</span>
      {/snippet}
    </PageHeader>

    <MetricStrip {metrics} />

    <div class="content-grid">
      <Card title="Import queue" class="queue-card">
        {#snippet header()}
          <div class="folder-state">
            <span class="path-label">{folder?.path ?? "No folder selected"}</span>
            <Badge tone={duplicateCount || skippedCount ? "warn" : "neutral"}>{importMessage}</Badge>
          </div>
        {/snippet}

        <button
          class="drop-zone"
          class:active={dragActive}
          type="button"
          onclick={chooseFolder}
          ondragover={handleBrowserDrag}
          ondragleave={() => (dragActive = false)}
          ondrop={handleBrowserDrop}
          disabled={busy}
        >
          <span class="drop-title">{dragActive ? "Release to Import" : "Drop or Select Documents"}</span>
          <span>PDF, images, folders, and scans stay local until review.</span>
        </button>

        {#if jobs.length}
          <ResourceTable caption="Queued local documents" class="flush queue-table">
            {#snippet head()}
              <tr>
                <th>Type</th>
                <th>Document</th>
                <th class="table-num">Pages</th>
                <th>Status</th>
                <th class="table-num">Confidence</th>
              </tr>
            {/snippet}
            {#each jobs as job}
              <tr>
                <td data-label="Type"><Badge tone="info">{kindLabel[job.kind]}</Badge></td>
                <td data-label="Document">
                  <strong class="table-primary">{job.name}</strong>
                  <span class="table-muted">{job.path}</span>
                  <span class="job-hash">sha256 {job.fileHash.slice(0, 10)}</span>
                </td>
                <td data-label="Pages" class="table-num">{job.pages}</td>
                <td data-label="Status"><Badge tone={toneForStatus(job.status)}>{statusLabel[job.status]}</Badge></td>
                <td data-label="Confidence" class="table-num confidence-cell">
                  <meter min="0" max="1" value={job.confidence} aria-label={`${job.name} confidence`}></meter>
                  <span>{confidenceLabel(job.confidence)}</span>
                </td>
              </tr>
            {/each}
          </ResourceTable>
        {:else}
          <EmptyState title="No queued documents" description="Select a folder or drop local files to create draft extraction jobs." />
        {/if}
      </Card>

      <Card title="Local runtime" class="side-card" id="runtime">
        {#snippet header()}
          <Badge tone={toneForStatus(runtime.ocr)}>{statusLabel[runtime.ocr]}</Badge>
        {/snippet}
        <dl class="status-list">
          <div>
            <dt>OCR</dt>
            <dd><Badge tone={toneForStatus(runtime.ocr)}>{statusLabel[runtime.ocr]}</Badge></dd>
          </div>
          <div>
            <dt>LLM</dt>
            <dd><Badge tone={toneForStatus(runtime.llm)}>{statusLabel[runtime.llm]}</Badge></dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>{runtime.model}</dd>
          </div>
        </dl>
      </Card>

      <Card title="Sync status" class="side-card" id="sync">
        {#snippet header()}
          <Badge tone={toneForStatus(sync.state)}>{statusLabel[sync.state]}</Badge>
        {/snippet}
        <dl class="status-list">
          <div>
            <dt>Target</dt>
            <dd>{sync.baseUrl}</dd>
          </div>
          <div>
            <dt>Pending Drafts</dt>
            <dd>{sync.pendingDrafts}</dd>
          </div>
          <div>
            <dt>Synced</dt>
            <dd>{syncedCount}</dd>
          </div>
        </dl>
      </Card>
    </div>
  </section>
</main>
