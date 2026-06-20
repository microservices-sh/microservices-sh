<script lang="ts">
  import { onMount } from "svelte";
  import {
    AppShell,
    Badge,
    Button,
    Card,
    CustomSelect,
    EmptyState,
    MetricStrip,
    PageHeader,
    ResourceTable,
    type Metric,
    type Tone
  } from "./lib/ui";
  import {
    approveJob,
    extractDocument,
    getRuntimeSettings,
    getRuntimeStatus,
    getSyncStatus,
    importDocumentPaths,
    installGemmaModel,
    loadDocumentDraft,
    loadQueueDocuments,
    listenForDroppedDocuments,
    rejectJob,
    saveRuntimeSettings,
    selectImportFiles,
    selectImportFolder,
    updateDraftField,
    type ExtractionDraft,
    type ExtractedField,
    type ImportFolder,
    type ImportResult,
    type QueueJob,
    type RuntimeSettings,
    type RuntimeStatus,
    type SyncStatus
  } from "./lib/desktop";

  type StatusKey = RuntimeStatus["ocr"] | SyncStatus["state"] | QueueJob["status"];

  let runtime: RuntimeStatus = {
    ocr: "checking",
    llm: "checking",
    model: "Checking",
    mode: "browser-preview",
    ocrEngine: "tesseract",
    llmEngine: "ollama"
  };
  let runtimeSettings: RuntimeSettings = {
    gemmaModel: "gemma4:e4b",
    ocrLanguage: "eng",
    suggestedModels: ["gemma4:e2b", "gemma4:e4b", "gemma4:12b", "gemma4:26b", "gemma4:31b"],
    installedModels: [],
    selectedModelInstalled: false,
    ollamaInstalled: false,
    tesseractInstalled: false
  };
  let sync: SyncStatus = { baseUrl: "http://localhost:5174", state: "not-configured", pendingDrafts: 0 };
  let folder: ImportFolder | null = null;
  let jobs: QueueJob[] = [];
  let busy = false;
  let extractingJobId: string | null = null;
  let savingFieldKey: string | null = null;
  let savedFieldKey: string | null = null;
  let decidingJobId: string | null = null;
  let confirmingRejectId: string | null = null;
  let installingModel = false;
  let savingSettings = false;
  let dragActive = false;
  let activePathname = "#import";
  let selectedJobId: string | null = null;
  let selectedDraft: ExtractionDraft | null = null;
  let settingsDraftModel = "gemma4:e4b";
  let settingsDraftOcrLanguage = "eng";
  let settingsMessage = "Runtime settings are local to this desktop app.";
  let importMessage = "Select a folder to create local draft jobs.";
  let metrics: Metric[] = [];

  const desktopNav = [
    {
      section: "Workspace",
      items: [
        { href: "#import", label: "Import Queue", icon: "folder" },
        { href: "#runtime", label: "Local Runtime", icon: "bot" },
        { href: "#sync", label: "Sync Status", icon: "workflow" },
        { href: "#settings", label: "Settings", icon: "settings" }
      ]
    }
  ];

  const ocrLanguageOptions = [
    { value: "eng", label: "English" },
    { value: "chi_sim", label: "Chinese Simplified" },
    { value: "chi_tra", label: "Chinese Traditional" },
    { value: "spa", label: "Spanish" },
    { value: "fra", label: "French" },
    { value: "deu", label: "German" },
    { value: "jpn", label: "Japanese" },
    { value: "kor", label: "Korean" }
  ];

  const statusLabel: Record<StatusKey, string> = {
    ready: "Ready",
    missing: "Missing",
    checking: "Checking",
    connected: "Connected",
    "not-configured": "Not Configured",
    offline: "Offline",
    extracting: "Extracting",
    review: "Review",
    approved: "Approved",
    rejected: "Rejected",
    synced: "Synced"
  };

  const kindLabel: Record<QueueJob["kind"], string> = {
    invoice: "Invoice",
    intake: "Intake",
    support: "Support"
  };

  $: reviewCount = jobs.filter((job) => job.status === "review").length;
  $: approvedCount = jobs.filter((job) => job.status === "approved").length;
  $: syncedCount = jobs.filter((job) => job.status === "synced").length;
  $: duplicateCount = folder?.duplicateDocuments ?? 0;
  $: skippedCount = folder?.skippedDocuments ?? 0;
  $: importedCount = folder?.newDocuments ?? jobs.length;
  $: selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs.find((job) => job.draft) ?? null;
  $: activeDraft = selectedJob?.draft ?? selectedDraft;
  $: modelOptions = Array.from(
    new Set(
      [...runtimeSettings.suggestedModels, ...runtimeSettings.installedModels, settingsDraftModel]
        .map((model) => model.trim())
        .filter(Boolean)
    )
  );
  $: selectedModelInstalled = isModelInstalled(settingsDraftModel);
  $: modelSelectOptions = modelOptions.map(modelOption);
  $: ocrSelectOptions = ocrLanguageOptions.map((option) => ({
    ...option,
    meta: option.value
  }));
  $: llmDetail = runtimeLlmDetail();
  $: ocrDetail = runtimeOcrDetail();
  $: metrics = [
    { label: "Queued", value: jobs.length, tone: jobs.length > 0 ? "info" : "neutral", hint: "local drafts" },
    { label: "Imported", value: importedCount, tone: importedCount > 0 ? "good" : "neutral", hint: "new documents" },
    { label: "Duplicates", value: duplicateCount, tone: duplicateCount > 0 ? "warn" : "neutral", hint: "hash matches" },
    { label: "Skipped", value: skippedCount, tone: skippedCount > 0 ? "warn" : "neutral", hint: "unsupported paths" },
    { label: "Review", value: reviewCount, tone: reviewCount > 0 ? "warn" : "neutral", hint: "needs approval" }
  ];

  async function refresh() {
    const [runtimeStatus, syncStatus, queued, settings] = await Promise.all([
      getRuntimeStatus(),
      getSyncStatus(),
      jobs.length ? Promise.resolve(jobs) : loadQueueDocuments(),
      getRuntimeSettings()
    ]);
    runtime = runtimeStatus;
    sync = syncStatus;
    jobs = queued;
    applyRuntimeSettings(settings);
    selectedJobId = selectedJobId ?? queued.find((job) => job.draft)?.id ?? queued[0]?.id ?? null;
  }

  function isModelInstalled(model: string) {
    return runtimeSettings.installedModels.some(
      (installedModel) => installedModel === model || installedModel.startsWith(`${model}:`)
    );
  }

  function modelOption(model: string) {
    const installed = isModelInstalled(model);

    return {
      value: model,
      label: model,
      meta: installed ? "Installed locally" : "Available to install",
      badge: installed ? "Installed" : "Pull",
      tone: installed ? "good" : "warn"
    } as const;
  }

  function runtimeLlmDetail() {
    if (!runtimeSettings.ollamaInstalled) return "Ollama app missing";
    if (selectedModelInstalled) return runtime.llmEngine ?? "ollama";
    if (runtimeSettings.installedModels.length) return `${settingsDraftModel} not installed`;
    return "Start Ollama or install a model";
  }

  function runtimeOcrDetail() {
    if (runtimeSettings.tesseractInstalled) return "Tesseract pre-pass";
    if (selectedModelInstalled) return "Gemma vision fallback";
    return "Tesseract optional; install Gemma model";
  }

  async function chooseFolder() {
    await chooseImportSource(selectImportFolder);
  }

  async function chooseFiles() {
    await chooseImportSource(selectImportFiles);
  }

  async function chooseImportSource(selectSource: () => Promise<ImportResult | null>) {
    busy = true;
    try {
      const result = await selectSource();
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
    selectedJobId = result.jobs.find((job) => job.draft)?.id ?? result.jobs[0]?.id ?? null;
    selectedDraft = selectedJobId ? (result.jobs.find((job) => job.id === selectedJobId)?.draft ?? null) : null;
    sync = { ...sync, pendingDrafts: jobs.filter((job) => job.status !== "synced").length };
    importMessage = [
      `${result.folder.newDocuments} new`,
      `${result.folder.duplicateDocuments} duplicates`,
      `${result.folder.skippedDocuments} skipped`
    ].join(", ");
  }

  async function selectJob(job: QueueJob) {
    selectedJobId = job.id;
    selectedDraft = job.draft ?? (await loadDocumentDraft(job.id));
  }

  async function runExtraction(job: QueueJob) {
    if (extractingJobId) return;

    extractingJobId = job.id;
    selectedJobId = job.id;
    importMessage = `Extracting ${job.name}`;

    try {
      const result = await extractDocument(job.id);
      jobs = jobs.map((item) => (item.id === result.job.id ? result.job : item));
      selectedDraft = result.draft;
      sync = { ...sync, pendingDrafts: pendingCount() };
      importMessage = `${result.job.name} converted to a review draft`;
      runtime = await getRuntimeStatus();
    } catch (error) {
      importMessage = error instanceof Error ? error.message : "Extraction failed";
    } finally {
      extractingJobId = null;
    }
  }

  function pendingCount() {
    return jobs.filter((item) => item.status !== "synced" && item.status !== "rejected").length;
  }

  function mergeJob(updated: QueueJob) {
    jobs = jobs.map((item) => (item.id === updated.id ? updated : item));
    if (updated.id === selectedJobId) selectedDraft = updated.draft ?? selectedDraft;
    sync = { ...sync, pendingDrafts: pendingCount() };
  }

  async function saveField(job: QueueJob, field: ExtractedField, value: string) {
    const next = value.trim();
    if (next === fieldEditValue(field)) return;

    const key = `${job.id}:${field.name}`;
    savingFieldKey = key;
    savedFieldKey = null;
    try {
      mergeJob(await updateDraftField(job.id, field.name, next));
      importMessage = `Updated ${field.name} on ${job.name}`;
      savedFieldKey = key;
      setTimeout(() => {
        if (savedFieldKey === key) savedFieldKey = null;
      }, 1600);
    } catch (error) {
      importMessage = error instanceof Error ? error.message : "Field update failed";
    } finally {
      savingFieldKey = null;
    }
  }

  async function approveDraft(job: QueueJob) {
    if (decidingJobId) return;

    confirmingRejectId = null;
    decidingJobId = job.id;
    try {
      mergeJob(await approveJob(job.id));
      importMessage = `${job.name} approved for sync`;
    } catch (error) {
      importMessage = error instanceof Error ? error.message : "Approve failed";
    } finally {
      decidingJobId = null;
    }
  }

  function armReject(job: QueueJob) {
    confirmingRejectId = job.id;
  }

  function cancelReject() {
    confirmingRejectId = null;
  }

  async function rejectDraft(job: QueueJob) {
    if (decidingJobId) return;

    confirmingRejectId = null;
    decidingJobId = job.id;
    try {
      mergeJob(await rejectJob(job.id, "Rejected in review"));
      importMessage = `${job.name} rejected`;
    } catch (error) {
      importMessage = error instanceof Error ? error.message : "Reject failed";
    } finally {
      decidingJobId = null;
    }
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
      importMessage = "Browser preview cannot read local file paths. Use desktop mode or Select Files.";
    }
  }

  async function refreshRuntime() {
    const [runtimeStatus, settings] = await Promise.all([getRuntimeStatus(), getRuntimeSettings()]);
    runtime = runtimeStatus;
    applyRuntimeSettings(settings);
  }

  function applyRuntimeSettings(settings: RuntimeSettings) {
    runtimeSettings = settings;
    settingsDraftModel = settings.gemmaModel;
    settingsDraftOcrLanguage = settings.ocrLanguage;
  }

  async function saveSettings() {
    savingSettings = true;
    settingsMessage = "Saving runtime settings";

    try {
      const settings = await saveRuntimeSettings(settingsDraftModel, settingsDraftOcrLanguage);
      applyRuntimeSettings(settings);
      runtime = await getRuntimeStatus();
      settingsMessage = "Runtime settings saved";
    } catch (error) {
      settingsMessage = error instanceof Error ? error.message : "Settings save failed";
    } finally {
      savingSettings = false;
    }
  }

  async function installSelectedModel() {
    installingModel = true;
    settingsMessage = `Installing ${settingsDraftModel}`;

    try {
      const result = await installGemmaModel(settingsDraftModel);
      applyRuntimeSettings(result.settings);
      runtime = await getRuntimeStatus();
      settingsMessage = `${result.model} installed`;
    } catch (error) {
      settingsMessage = error instanceof Error ? error.message : "Model install failed";
    } finally {
      installingModel = false;
    }
  }

  function updateActivePathname() {
    activePathname = window.location.hash || "#import";
  }

  function toneForStatus(status: StatusKey): Tone {
    if (status === "ready" || status === "connected" || status === "synced" || status === "approved")
      return "good";
    if (status === "missing" || status === "offline" || status === "rejected") return "bad";
    if (status === "review" || status === "checking" || status === "extracting") return "warn";
    return "neutral";
  }

  function confidenceLabel(confidence: number) {
    return `${Math.round(confidence * 100)}%`;
  }

  function fieldValueLabel(field: ExtractedField) {
    if (field.value === null || field.value === undefined || field.value === "") return "Needs review";
    return String(field.value);
  }

  function fieldEditValue(field: ExtractedField) {
    if (field.value === null || field.value === undefined) return "";
    return String(field.value);
  }

  onMount(() => {
    void refresh();
    updateActivePathname();
    window.addEventListener("hashchange", updateActivePathname);

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
      window.removeEventListener("hashchange", updateActivePathname);
    };
  });
</script>

<AppShell
  nav={desktopNav}
  pathname={activePathname}
  brandHref="#import"
  footer={{ title: "ERP Shell Desktop", subtitle: runtime.mode === "tauri" ? "Desktop companion" : "Browser preview" }}
  status={{
    role: runtime.mode === "tauri" ? "desktop" : "preview",
    center: sync.pendingDrafts ? `${sync.pendingDrafts} pending drafts` : statusLabel[sync.state],
    right: "microservices.sh · erp"
  }}
>
  {#snippet crumbs()}
    <span class="mono">ERP Shell Desktop</span>
  {/snippet}

  {#snippet actions()}
    <Button onclick={refreshRuntime} size="sm">Runtime</Button>
    <Button size="sm" onclick={chooseFolder} disabled={busy}>Folder</Button>
    <Button variant="primary" size="sm" onclick={chooseFiles} disabled={busy}>{busy ? "Scanning" : "Select Files"}</Button>
  {/snippet}

  <section class="desktop-page" aria-label="Desktop intake workspace">
    <PageHeader
      eyebrow="Connected companion"
      title="Local intake bridge"
      description="Import scanned documents into a local draft queue, review extraction state, then sync approved records into ERP Shell."
    >
      {#snippet meta()}
        <span>{folder?.path ?? "No folder selected"}</span>
        <span>{importMessage}</span>
      {/snippet}
    </PageHeader>

    <MetricStrip {metrics} />

    <div class="content-grid">
      <section id="import" class="import-section" aria-labelledby="import-title">
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
            onclick={chooseFiles}
            ondragover={handleBrowserDrag}
            ondragleave={() => (dragActive = false)}
            ondrop={handleBrowserDrop}
            disabled={busy}
          >
            <span id="import-title" class="drop-title">{dragActive ? "Release to Import" : "Drop or Select Documents"}</span>
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
                  <th>Action</th>
                </tr>
              {/snippet}
              {#each jobs as job}
                <tr>
                  <td data-label="Type"><Badge tone="info">{kindLabel[job.kind]}</Badge></td>
                  <td data-label="Document">
                    <strong class="table-primary">{job.name}</strong>
                    <span class="table-muted">{job.path}</span>
                    <span class="job-hash">sha256 {job.fileHash.slice(0, 10)}</span>
                    {#if job.draft}
                      <button class="inline-action" type="button" onclick={() => void selectJob(job)}>Review draft</button>
                    {/if}
                  </td>
                  <td data-label="Pages" class="table-num">{job.pages}</td>
                  <td data-label="Status"><Badge tone={toneForStatus(job.status)}>{statusLabel[job.status]}</Badge></td>
                  <td data-label="Confidence" class="table-num confidence-cell">
                    <meter min="0" max="1" value={job.confidence} aria-label={`${job.name} confidence`}></meter>
                    <span>{confidenceLabel(job.confidence)}</span>
                  </td>
                  <td data-label="Action" class="table-action">
                    <Button size="sm" onclick={() => void runExtraction(job)} disabled={Boolean(extractingJobId)}>
                      {extractingJobId === job.id ? "Extracting" : job.draft ? "Re-run" : "Extract"}
                    </Button>
                  </td>
                </tr>
              {/each}
            </ResourceTable>
          {:else}
            <EmptyState title="No queued documents" description="Select a folder or drop local files to create draft extraction jobs." />
          {/if}
        </Card>
      </section>

      <div id="runtime" class="side-section side-stack">
        <Card title="Local runtime" class="side-card">
          {#snippet header()}
            <Badge tone={toneForStatus(runtime.ocr)}>{statusLabel[runtime.ocr]}</Badge>
          {/snippet}
          <dl class="status-list">
            <div>
              <dt>OCR</dt>
              <dd><Badge tone={toneForStatus(runtime.ocr)}>{statusLabel[runtime.ocr]}</Badge> {ocrDetail}</dd>
            </div>
            <div>
              <dt>LLM</dt>
              <dd><Badge tone={toneForStatus(runtime.llm)}>{statusLabel[runtime.llm]}</Badge> {llmDetail}</dd>
            </div>
            <div>
              <dt>Model</dt>
              <dd>{runtime.model}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Extraction draft" class="side-card draft-card">
          {#snippet header()}
            <Badge tone={selectedJob ? toneForStatus(selectedJob.status) : "neutral"}>
              {selectedJob ? statusLabel[selectedJob.status] : "No Draft"}
            </Badge>
          {/snippet}

          {#if activeDraft}
            <div class="draft-summary">
              <strong>{selectedJob?.name ?? "Selected document"}</strong>
              <span>{activeDraft.summary ?? "Review extracted fields before sync."}</span>
              <div class="draft-meta">
                <Badge tone={activeDraft.confidence >= 0.85 ? "good" : "warn"}>{confidenceLabel(activeDraft.confidence)}</Badge>
                <span>{activeDraft.schemaId}</span>
                <span>{activeDraft.model ?? activeDraft.runtime}</span>
              </div>
            </div>

            {#if activeDraft.warnings.length}
              <ul class="warning-list" aria-label="Extraction warnings">
                {#each activeDraft.warnings as warning}
                  <li>{warning}</li>
                {/each}
              </ul>
            {/if}

            {#if activeDraft.fields.length}
              <ResourceTable caption="Extracted fields" class="field-table">
                {#snippet head()}
                  <tr>
                    <th>Field</th>
                    <th>Value</th>
                    <th class="table-num">Confidence</th>
                  </tr>
                {/snippet}
                {#each activeDraft.fields as field}
                  {@const fieldKey = `${selectedJob?.id}:${field.name}`}
                  <tr>
                    <td data-label="Field"><code>{field.name}</code></td>
                    <td data-label="Value">
                      <div class="field-edit">
                        <input
                          class="field-input"
                          class:needs-review={field.needsReview}
                          value={fieldEditValue(field)}
                          aria-label={`${field.name} value`}
                          placeholder="Needs review"
                          disabled={!selectedJob ||
                            selectedJob.status === "synced" ||
                            savingFieldKey === fieldKey}
                          onchange={(event) =>
                            selectedJob && void saveField(selectedJob, field, event.currentTarget.value)}
                        />
                        {#if savingFieldKey === fieldKey}
                          <span class="field-state" aria-live="polite">Saving…</span>
                        {:else if savedFieldKey === fieldKey}
                          <span class="field-state field-state--ok" aria-live="polite">Saved</span>
                        {/if}
                      </div>
                      {#if field.source?.text}
                        <span class="field-source">{field.source.text}</span>
                      {/if}
                    </td>
                    <td data-label="Confidence" class="table-num">{confidenceLabel(field.confidence)}</td>
                  </tr>
                {/each}
              </ResourceTable>
            {/if}

            <div class="draft-actions">
              {#if selectedJob && confirmingRejectId === selectedJob.id}
                <span class="confirm-prompt" role="alert">Reject this draft?</span>
                <Button
                  size="sm"
                  disabled={Boolean(decidingJobId)}
                  onclick={() => selectedJob && void rejectDraft(selectedJob)}
                >
                  Confirm reject
                </Button>
                <Button size="sm" disabled={Boolean(decidingJobId)} onclick={cancelReject}>
                  Cancel
                </Button>
              {:else}
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!selectedJob ||
                    Boolean(decidingJobId) ||
                    selectedJob.status === "synced" ||
                    selectedJob.status === "approved"}
                  onclick={() => selectedJob && void approveDraft(selectedJob)}
                >
                  {selectedJob?.status === "approved" ? "Approved ✓" : "Approve"}
                </Button>
                <Button
                  size="sm"
                  disabled={!selectedJob ||
                    Boolean(decidingJobId) ||
                    selectedJob.status === "synced" ||
                    selectedJob.status === "rejected"}
                  onclick={() => selectedJob && armReject(selectedJob)}
                >
                  {selectedJob?.status === "rejected" ? "Rejected" : "Reject"}
                </Button>
              {/if}
            </div>

            {#if activeDraft.rawText}
              <details class="raw-text">
                <summary>Raw OCR text</summary>
                <pre>{activeDraft.rawText}</pre>
              </details>
            {/if}
          {:else}
            <EmptyState title="No extraction draft" description="Run Extract on a scanned image to create a local review draft." />
          {/if}
        </Card>
      </div>

      <div id="sync" class="side-section">
        <Card title="Sync status" class="side-card">
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

      <section id="settings" class="settings-section" aria-label="Runtime settings">
        <Card title="Runtime settings" class="settings-card">
          {#snippet header()}
            <Badge tone={selectedModelInstalled ? "good" : "warn"}>{selectedModelInstalled ? "Model Ready" : "Install Needed"}</Badge>
          {/snippet}

          <form
            class="settings-form"
            onsubmit={(event) => {
              event.preventDefault();
              void saveSettings();
            }}
          >
            <div class="settings-grid">
              <CustomSelect
                id="gemma-model"
                label="Gemma model"
                options={modelSelectOptions}
                value={settingsDraftModel}
                onChange={(value) => (settingsDraftModel = value)}
              />

              <CustomSelect
                id="ocr-language"
                label="OCR language"
                options={ocrSelectOptions}
                value={settingsDraftOcrLanguage}
                onChange={(value) => (settingsDraftOcrLanguage = value)}
              />

              <label class="setting-field custom-model-field" for="custom-gemma-model">
                <span>Custom model tag</span>
                <input id="custom-gemma-model" bind:value={settingsDraftModel} spellcheck="false" />
              </label>
            </div>

            <div class="runtime-checks" aria-label="Runtime checks">
              <span><Badge tone={runtimeSettings.tesseractInstalled ? "good" : "warn"}>{runtimeSettings.tesseractInstalled ? "Ready" : "Optional"}</Badge> Tesseract OCR</span>
              <span><Badge tone={runtimeSettings.ollamaInstalled ? "good" : "bad"}>{runtimeSettings.ollamaInstalled ? "Ready" : "Missing"}</Badge> Ollama</span>
              <span><Badge tone={selectedModelInstalled ? "good" : "warn"}>{selectedModelInstalled ? "Installed" : "Not Installed"}</Badge> {settingsDraftModel}</span>
            </div>

            <div class="settings-actions">
              <Button type="submit" size="sm" disabled={savingSettings || installingModel}>{savingSettings ? "Saving" : "Save Settings"}</Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onclick={() => void installSelectedModel()}
                disabled={installingModel || !settingsDraftModel}
              >
                {installingModel ? "Installing" : selectedModelInstalled ? "Reinstall Model" : "Install Model"}
              </Button>
            </div>

            <p class="settings-message">{settingsMessage}</p>
          </form>
        </Card>
      </section>
    </div>
  </section>
</AppShell>
