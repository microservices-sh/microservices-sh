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
    getErpImportSettings,
    getImportStatus,
    getRuntimeSettings,
    getRuntimeStatus,
    importDocumentPaths,
    installGemmaModel,
    loadDocumentDraft,
    loadQueueDocuments,
    listenForDroppedDocuments,
    rejectJob,
    saveErpImportSettings,
    saveRuntimeSettings,
    selectImportFiles,
    selectImportFolder,
    submitApprovedDraft,
    testGemmaModel,
    type ErpImportSettings,
    updateDraftField,
    type ExtractionDraft,
    type ExtractedField,
    type ImportStatus,
    type ImportFolder,
    type ImportResult,
    type ModelProbeResult,
    type QueueJob,
    type RuntimeSettings,
    type RuntimeStatus,
  } from "./lib/desktop";

  type StatusKey = RuntimeStatus["ocr"] | ImportStatus["state"] | QueueJob["status"];

  let runtime: RuntimeStatus = {
    ocr: "checking",
    llm: "checking",
    model: "Checking",
    mode: "browser-preview",
    ocrEngine: "gemma vision",
    llmEngine: "ollama"
  };
  let runtimeSettings: RuntimeSettings = {
    gemmaModel: "gemma4:e4b",
    ocrLanguage: "eng",
    suggestedModels: ["gemma4:e2b", "gemma4:e4b", "gemma4:12b", "gemma4:26b", "gemma4:31b"],
    installedModels: [],
    selectedModelInstalled: false,
    ollamaInstalled: false
  };
  let erpImport: ImportStatus = {
    baseUrl: "http://localhost:5173",
    state: "not-configured",
    pendingDrafts: 0,
    importedDrafts: 0,
    tokenConfigured: false
  };
  let erpImportSettings: ErpImportSettings = { baseUrl: "http://localhost:5173", tokenConfigured: false };
  let folder: ImportFolder | null = null;
  let jobs: QueueJob[] = [];
  let busy = false;
  let extractingJobId: string | null = null;
  let savingFieldKey: string | null = null;
  let savedFieldKey: string | null = null;
  let decidingJobId: string | null = null;
  let confirmingRejectId: string | null = null;
  let installingModel = false;
  let testingModel = false;
  let savingSettings = false;
  let savingImportSettings = false;
  let submittingImportJobId: string | null = null;
  let dragActive = false;
  let activePathname = "#import";
  let selectedJobId: string | null = null;
  let selectedDraft: ExtractionDraft | null = null;
  let settingsDraftModel = "gemma4:e4b";
  let settingsDraftOcrLanguage = "eng";
  let erpImportBaseUrl = "http://localhost:5173";
  let erpImportToken = "";
  let settingsMessage = "Runtime settings are local to this desktop app.";
  let modelTest: ModelProbeResult | null = null;
  let modelTestMessage = "Run a model test after changing the selected Gemma tag.";
  let importMessage = "Select a folder to create local draft jobs.";
  let erpSubmitMessage = "Approved drafts submit to the remote ERP database. Local storage remains draft-only.";
  let metrics: Metric[] = [];

  const pageDetails: Record<string, { eyebrow: string; title: string; description: string }> = {
    "#import": {
      eyebrow: "Document intake",
      title: "Import queue",
      description: "Collect PDFs and scanned images into the local draft database before extraction."
    },
    "#review": {
      eyebrow: "Human approval",
      title: "Review drafts",
      description: "Inspect extracted fields, correct low-confidence values, then approve or reject the local draft."
    },
    "#runtime": {
      eyebrow: "Local AI runtime",
      title: "Local runtime",
      description: "Check OCR and Ollama readiness, then run a live probe against the selected Gemma model."
    },
    "#erp-import": {
      eyebrow: "Remote ERP handoff",
      title: "ERP import",
      description: "Submit approved local drafts to the authenticated ERP Worker and remote D1-backed queue."
    },
    "#settings": {
      eyebrow: "Runtime configuration",
      title: "Runtime settings",
      description: "Choose the Gemma model, OCR language, and local model installation target for this desktop app."
    }
  };

  const desktopNav = [
    {
      section: "Intake",
      items: [
        { href: "#import", label: "Import Queue", icon: "folder" },
        { href: "#review", label: "Review Drafts", icon: "clipboard" }
      ]
    },
    {
      section: "Runtime",
      items: [
        { href: "#runtime", label: "Local Runtime", icon: "bot" },
        { href: "#settings", label: "Runtime Settings", icon: "settings" }
      ]
    },
    {
      section: "ERP",
      items: [
        { href: "#erp-import", label: "ERP Import", icon: "workflow" }
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
    synced: "Imported"
  };

  const kindLabel: Record<QueueJob["kind"], string> = {
    invoice: "Invoice",
    intake: "Intake",
    support: "Support"
  };

  $: reviewCount = jobs.filter((job) => job.status === "review").length;
  $: approvedCount = jobs.filter((job) => job.status === "approved").length;
  $: importedDraftCount = jobs.filter((job) => job.status === "synced").length;
  $: duplicateCount = folder?.duplicateDocuments ?? 0;
  $: skippedCount = folder?.skippedDocuments ?? 0;
  $: importedCount = folder?.newDocuments ?? jobs.length;
  $: selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs.find((job) => job.draft) ?? null;
  $: activeDraft = selectedJob?.draft ?? selectedDraft;
  $: activePage = pageDetails[activePathname] ? activePathname : "#import";
  $: page = pageDetails[activePage];
  $: pageMetaPrimary =
    activePage === "#runtime" || activePage === "#settings"
      ? settingsDraftModel
      : activePage === "#erp-import"
        ? erpImport.baseUrl
        : folder?.path ?? "No folder selected";
  $: pageMetaSecondary =
    activePage === "#runtime"
      ? modelTestMessage
      : activePage === "#settings"
        ? settingsMessage
        : activePage === "#erp-import"
          ? erpSubmitMessage
          : importMessage;
  $: modelOptions = Array.from(
    new Set(
      [...runtimeSettings.suggestedModels, ...runtimeSettings.installedModels, settingsDraftModel]
        .map((model) => model.trim())
        .filter(Boolean)
    )
  );
  $: selectedModelInstalled = isModelInstalled(settingsDraftModel);
  $: modelSelectOptions = modelOptions.map(modelOption);
  $: ocrSelectOptions = ocrLanguageOptions;
  $: llmDetail = runtimeLlmDetail();
  $: ocrDetail = runtimeOcrDetail();
  $: if (modelTest && modelTest.model !== settingsDraftModel) {
    modelTest = null;
    modelTestMessage = "Run a model test after changing the selected Gemma tag.";
  }
  $: metrics = [
    { label: "Queued", value: jobs.length, tone: jobs.length > 0 ? "info" : "neutral", hint: "local drafts" },
    { label: "Imported", value: importedCount, tone: importedCount > 0 ? "good" : "neutral", hint: "new documents" },
    { label: "Duplicates", value: duplicateCount, tone: duplicateCount > 0 ? "warn" : "neutral", hint: "hash matches" },
    { label: "Skipped", value: skippedCount, tone: skippedCount > 0 ? "warn" : "neutral", hint: "unsupported paths" },
    { label: "Review", value: reviewCount, tone: reviewCount > 0 ? "warn" : "neutral", hint: "needs approval" },
    { label: "Approved", value: approvedCount, tone: approvedCount > 0 ? "good" : "neutral", hint: "ready to submit" }
  ];

  async function refresh() {
    const [runtimeStatus, importStatus, queued, settings, importSettings] = await Promise.all([
      getRuntimeStatus(),
      getImportStatus(),
      jobs.length ? Promise.resolve(jobs) : loadQueueDocuments(),
      getRuntimeSettings(),
      getErpImportSettings()
    ]);
    runtime = runtimeStatus;
    erpImport = importStatus;
    jobs = queued;
    applyRuntimeSettings(settings);
    applyErpImportSettings(importSettings);
    selectedJobId = selectedJobId ?? queued.find((job) => job.draft)?.id ?? queued[0]?.id ?? null;
  }

  function approvedImportCount() {
    return jobs.filter((item) => item.status === "approved").length;
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
    if (selectedModelInstalled) return "Gemma vision";
    return "Install the Gemma model to enable extraction";
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
    erpImport = {
      ...erpImport,
      pendingDrafts: result.jobs.filter((job) => job.status === "approved").length,
      importedDrafts: result.jobs.filter((job) => job.status === "synced").length
    };
    importMessage = [
      `${result.folder.newDocuments} new`,
      `${result.folder.duplicateDocuments} duplicates`,
      `${result.folder.skippedDocuments} skipped`
    ].join(", ");
  }

  async function selectJob(job: QueueJob) {
    selectedJobId = job.id;
    selectedDraft = job.draft ?? (await loadDocumentDraft(job.id));
    navigateToPage("#review");
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
      erpImport = { ...erpImport, pendingDrafts: approvedImportCount(), importedDrafts: importedDraftCount };
      importMessage = `${result.job.name} converted to a review draft`;
      runtime = await getRuntimeStatus();
      navigateToPage("#review");
    } catch (error) {
      importMessage = error instanceof Error ? error.message : "Extraction failed";
    } finally {
      extractingJobId = null;
    }
  }

  function mergeJob(updated: QueueJob) {
    const nextJobs = jobs.map((item) => (item.id === updated.id ? updated : item));
    jobs = nextJobs;
    if (updated.id === selectedJobId) selectedDraft = updated.draft ?? selectedDraft;
    erpImport = {
      ...erpImport,
      pendingDrafts: nextJobs.filter((item) => item.status === "approved").length,
      importedDrafts: nextJobs.filter((item) => item.status === "synced").length
    };
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
      importMessage = `${job.name} approved for ERP import`;
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

  async function submitApprovedToErp(job: QueueJob) {
    if (submittingImportJobId) return;

    submittingImportJobId = job.id;
    erpSubmitMessage = `Submitting ${job.name} to ERP`;
    try {
      const imported = await submitApprovedDraft(job.id);
      mergeJob(imported);
      erpImport = await getImportStatus();
      erpSubmitMessage = `${job.name} was imported into the remote ERP queue`;
    } catch (error) {
      erpSubmitMessage = error instanceof Error ? error.message : "ERP import failed";
    } finally {
      submittingImportJobId = null;
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

  function applyErpImportSettings(settings: ErpImportSettings) {
    erpImportSettings = settings;
    erpImportBaseUrl = settings.baseUrl;
    erpImportToken = "";
  }

  async function saveImportSettings() {
    savingImportSettings = true;
    erpSubmitMessage = "Saving ERP import settings";

    try {
      const settings = await saveErpImportSettings(erpImportBaseUrl, erpImportToken);
      applyErpImportSettings(settings);
      erpImport = await getImportStatus();
      erpSubmitMessage = settings.tokenConfigured
        ? "ERP import settings saved"
        : "ERP app URL saved. Add an import token before submitting approved drafts.";
    } catch (error) {
      erpSubmitMessage = error instanceof Error ? error.message : "ERP import settings save failed";
    } finally {
      savingImportSettings = false;
    }
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

  async function testSelectedModel() {
    if (testingModel) return;

    testingModel = true;
    modelTest = null;
    modelTestMessage = `Testing ${settingsDraftModel} with local Ollama`;

    try {
      const result = await testGemmaModel(settingsDraftModel);
      modelTest = result;
      runtime = await getRuntimeStatus();
      modelTestMessage = result.ready
        ? `${result.model} responded in ${result.latencyMs} ms`
        : `${result.model} did not complete the readiness probe`;
    } catch (error) {
      modelTestMessage = error instanceof Error ? error.message : "Model test failed";
    } finally {
      testingModel = false;
    }
  }

  function navigateToPage(href: string) {
    if (window.location.hash === href) {
      activePathname = href;
      return;
    }
    window.location.hash = href;
  }

  function updateActivePathname() {
    const next = window.location.hash || "#import";
    activePathname = pageDetails[next] ? next : "#import";
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
  pathname={activePage}
  brandHref="#import"
  footer={{ title: "ERP Shell Desktop", subtitle: runtime.mode === "tauri" ? "Desktop companion" : "Browser preview" }}
  status={{
    role: runtime.mode === "tauri" ? "desktop" : "preview",
    center: erpImport.pendingDrafts ? `${erpImport.pendingDrafts} approved drafts` : statusLabel[erpImport.state],
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

  <section class="desktop-page" aria-label={page.title}>
    <PageHeader
      eyebrow={page.eyebrow}
      title={page.title}
      description={page.description}
    >
      {#snippet meta()}
        <span>{pageMetaPrimary}</span>
        <span>{pageMetaSecondary}</span>
      {/snippet}
    </PageHeader>

    {#if activePage === "#import" || activePage === "#review"}
      <MetricStrip {metrics} />
    {/if}

    {#if activePage === "#import"}
    <div class="page-panel">
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
    </div>

    {:else if activePage === "#runtime"}
      <div id="runtime" class="runtime-page-grid">
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

        <Card title="Selected LLM test" class="side-card">
          {#snippet header()}
            <Badge tone={modelTest?.ready ? "good" : testingModel ? "warn" : selectedModelInstalled ? "info" : "warn"}>
              {modelTest?.ready ? "Responding" : testingModel ? "Testing" : selectedModelInstalled ? "Installed" : "Install Needed"}
            </Badge>
          {/snippet}

          <dl class="status-list">
            <div>
              <dt>Selected</dt>
              <dd>{settingsDraftModel}</dd>
            </div>
            <div>
              <dt>Ollama</dt>
              <dd><Badge tone={runtimeSettings.ollamaInstalled ? "good" : "bad"}>{runtimeSettings.ollamaInstalled ? "Ready" : "Missing"}</Badge> local HTTP {runtime.llmEngine ?? "ollama"}</dd>
            </div>
            <div>
              <dt>Probe</dt>
              <dd>{modelTest ? `${modelTest.latencyMs} ms · ${modelTest.output}` : "Not tested in this session"}</dd>
            </div>
          </dl>

          {#if modelTest?.warnings.length}
            <ul class="warning-list model-warning-list" aria-label="Model test warnings">
              {#each modelTest.warnings as warning}
                <li>{warning}</li>
              {/each}
            </ul>
          {/if}

          <div class="settings-actions runtime-actions">
            <Button type="button" variant="primary" size="sm" onclick={() => void testSelectedModel()} disabled={testingModel || !settingsDraftModel}>
              {testingModel ? "Testing" : "Test Selected Model"}
            </Button>
            <Button href="#settings" size="sm">Change Model</Button>
          </div>

          <p class="settings-message" aria-live="polite">{modelTestMessage}</p>
        </Card>
      </div>

    {:else if activePage === "#review"}
      <div id="review" class="review-page-grid">
        <Card title="Extraction draft" class="side-card draft-card">
          {#snippet header()}
            <Badge tone={selectedJob ? toneForStatus(selectedJob.status) : "neutral"}>
              {selectedJob ? statusLabel[selectedJob.status] : "No Draft"}
            </Badge>
          {/snippet}

          {#if activeDraft}
            <div class="draft-summary">
              <strong>{selectedJob?.name ?? "Selected document"}</strong>
              <span>{activeDraft.summary ?? "Review extracted fields before ERP import."}</span>
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
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!selectedJob ||
                    selectedJob.status !== "approved" ||
                    Boolean(submittingImportJobId)}
                  onclick={() => selectedJob && void submitApprovedToErp(selectedJob)}
                >
                  {submittingImportJobId === selectedJob?.id ? "Submitting" : "Submit to ERP"}
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

        <Card title="Draft queue" class="side-card review-picker-card">
          {#snippet header()}
            <Badge tone={reviewCount ? "warn" : approvedCount ? "good" : "neutral"}>
              {reviewCount ? `${reviewCount} Review` : approvedCount ? `${approvedCount} Approved` : "Empty"}
            </Badge>
          {/snippet}

          {#if jobs.length}
            <div class="review-job-list" aria-label="Draft queue">
              {#each jobs as job}
                <button
                  type="button"
                  class="review-job"
                  class:is-active={job.id === selectedJob?.id}
                  onclick={() => void selectJob(job)}
                >
                  <span>
                    <strong>{job.name}</strong>
                    <small>{kindLabel[job.kind]} · {confidenceLabel(job.confidence)}</small>
                  </span>
                  <Badge tone={toneForStatus(job.status)}>{statusLabel[job.status]}</Badge>
                </button>
              {/each}
            </div>
          {:else}
            <EmptyState title="No drafts" description="Import documents first, then extract them for review." />
          {/if}
        </Card>
      </div>

    {:else if activePage === "#erp-import"}
      <div id="erp-import" class="side-section">
        <Card title="ERP import" class="side-card">
          {#snippet header()}
            <Badge tone={toneForStatus(erpImport.state)}>{statusLabel[erpImport.state]}</Badge>
          {/snippet}
          <dl class="status-list">
            <div>
              <dt>Target</dt>
              <dd>{erpImport.baseUrl}</dd>
            </div>
            <div>
              <dt>Approved</dt>
              <dd>{erpImport.pendingDrafts}</dd>
            </div>
            <div>
              <dt>Imported</dt>
              <dd>{erpImport.importedDrafts}</dd>
            </div>
            <div>
              <dt>Token</dt>
              <dd>{erpImportSettings.tokenConfigured ? "Configured" : "Not configured"}</dd>
            </div>
          </dl>

          <form
            class="settings-form import-settings-form"
            onsubmit={(event) => {
              event.preventDefault();
              void saveImportSettings();
            }}
          >
            <label class="setting-field" for="erp-import-url">
              <span>ERP app URL</span>
              <input
                id="erp-import-url"
                type="url"
                required
                autocomplete="url"
                spellcheck="false"
                bind:value={erpImportBaseUrl}
              />
            </label>

            <label class="setting-field" for="erp-import-token">
              <span>Import token</span>
              <input
                id="erp-import-token"
                type="password"
                autocomplete="off"
                spellcheck="false"
                placeholder={erpImportSettings.tokenConfigured ? "Saved; leave blank to keep it" : "Paste DESKTOP_IMPORT_TOKEN"}
                bind:value={erpImportToken}
              />
            </label>

            <div class="settings-actions">
              <Button type="submit" size="sm" disabled={savingImportSettings}>
                {savingImportSettings ? "Saving" : "Save Import Settings"}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={!selectedJob ||
                  selectedJob.status !== "approved" ||
                  Boolean(submittingImportJobId)}
                onclick={() => selectedJob && void submitApprovedToErp(selectedJob)}
              >
                {submittingImportJobId ? "Submitting" : "Submit Selected"}
              </Button>
            </div>

            <p class="settings-message" aria-live="polite">{erpSubmitMessage}</p>
          </form>
        </Card>
      </div>

    {:else if activePage === "#settings"}
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
                onChange={(value) => {
                  settingsDraftModel = value;
                  modelTestMessage = "Run a model test after changing the selected Gemma tag.";
                }}
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
                <input
                  id="custom-gemma-model"
                  bind:value={settingsDraftModel}
                  spellcheck="false"
                  oninput={() => (modelTestMessage = "Run a model test after changing the selected Gemma tag.")}
                />
              </label>
            </div>

            <div class="runtime-checks" aria-label="Runtime checks">
              <span><Badge tone={runtimeSettings.ollamaInstalled ? "good" : "bad"}>{runtimeSettings.ollamaInstalled ? "Ready" : "Missing"}</Badge> Ollama</span>
              <span><Badge tone={selectedModelInstalled ? "good" : "warn"}>{selectedModelInstalled ? "Installed" : "Not Installed"}</Badge> {settingsDraftModel}</span>
            </div>

            <div class="settings-actions">
              <Button type="submit" size="sm" disabled={savingSettings || installingModel || testingModel}>{savingSettings ? "Saving" : "Save Settings"}</Button>
              <Button
                type="button"
                size="sm"
                onclick={() => void testSelectedModel()}
                disabled={testingModel || savingSettings || !settingsDraftModel}
              >
                {testingModel ? "Testing" : "Test Model"}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onclick={() => void installSelectedModel()}
                disabled={installingModel || testingModel || !settingsDraftModel}
              >
                {installingModel ? "Installing" : selectedModelInstalled ? "Reinstall Model" : "Install Model"}
              </Button>
            </div>

            <p class="settings-message">{settingsMessage}</p>
            <p class="settings-message" aria-live="polite">{modelTestMessage}</p>
          </form>
        </Card>
      </section>
    {/if}
  </section>
</AppShell>
