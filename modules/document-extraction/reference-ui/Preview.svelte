<!--
  Document Extraction surface - demonstrates the local-first workflow without
  actually downloading model weights or calling a provider. Host state supplies
  runtime/model availability, sample documents, extraction jobs, and lifecycle
  handlers. The UI keeps model downloads and gateway use explicit.
-->
<script lang="ts">
  import { Badge, Button, Eyebrow } from "@microservices-sh/ui";

  type ExtractionMode = "local-only" | "hybrid" | "sidecar" | "gateway-only";
  type RuntimeId = "browser-local" | "sidecar-ollama" | "sidecar-openai-compatible" | "gateway";
  type ModelStatus = "not-installed" | "downloading" | "installed" | "connected" | "offline" | "available";
  type JobStatus = "pending" | "extracting" | "needs_review" | "approved" | "rejected" | "failed";

  type ModelOption = {
    id: string;
    label: string;
    runtime: RuntimeId;
    model: string;
    size: string;
    status: ModelStatus;
    progress?: number;
    endpoint?: string;
    approvalRequired?: boolean;
  };

  type DocumentSample = {
    id: string;
    name: string;
    targetType: string;
    mimeType: string;
    pages: number;
    bytes: number;
  };

  type ExtractedField = {
    name: string;
    value: string | number | boolean | null;
    confidence: number;
    source: string;
    needsReview?: boolean;
  };

  type ExtractionJob = {
    id: string;
    documentName: string;
    targetType: string;
    status: JobStatus;
    mode: ExtractionMode;
    runtime: RuntimeId;
    model: string;
    confidence: number;
    warnings: string[];
    fields: ExtractedField[];
    createdAt: string;
  };

  let {
    samples = [],
    models = [],
    jobs = [],
    busy = false,
    ondownload,
    onconnect,
    onselectmodel,
    onextract,
    onapprove,
    onreject
  }: {
    samples?: DocumentSample[];
    models?: ModelOption[];
    jobs?: ExtractionJob[];
    busy?: boolean;
    ondownload?: (modelId: string) => void;
    onconnect?: (modelId: string) => void;
    onselectmodel?: (modelId: string) => void;
    onextract?: (input: { documentId: string; modelId: string; mode: ExtractionMode; schemaId: string; runtime: RuntimeId }) => void;
    onapprove?: (jobId: string) => void;
    onreject?: (jobId: string) => void;
  } = $props();

  const modes: Array<{ id: ExtractionMode; label: string; detail: string }> = [
    { id: "hybrid", label: "Hybrid", detail: "local first, governed fallback" },
    { id: "local-only", label: "Local", detail: "browser or sidecar only" },
    { id: "sidecar", label: "Sidecar", detail: "Ollama, LM Studio, vLLM" },
    { id: "gateway-only", label: "Gateway", detail: "AI gateway only" }
  ];

  let selectedDocumentId = $state("");
  let selectedModelId = $state("");
  let selectedMode = $state<ExtractionMode>("hybrid");
  let selectedSchema = $state("invoice");

  const selectedDocument = $derived(samples.find((sample) => sample.id === selectedDocumentId) ?? samples[0]);
  const selectedModel = $derived(models.find((model) => model.id === selectedModelId) ?? models[0]);
  const activeJob = $derived(jobs[0]);
  const reviewLocked = $derived(!activeJob || activeJob.status === "approved" || activeJob.status === "rejected");
  const modelReady = $derived(Boolean(selectedModel && ["installed", "connected", "available"].includes(selectedModel.status)));
  const canExtract = $derived(Boolean(selectedDocument && selectedModel && modelReady && !busy));

  function chooseDocument(sample: DocumentSample) {
    selectedDocumentId = sample.id;
    selectedSchema = sample.targetType;
  }

  function chooseModel(model: ModelOption) {
    selectedModelId = model.id;
    onselectmodel?.(model.id);
  }

  function runExtraction() {
    if (!selectedDocument || !selectedModel || !modelReady) return;
    onextract?.({
      documentId: selectedDocument.id,
      modelId: selectedModel.id,
      mode: selectedMode,
      schemaId: selectedSchema,
      runtime: selectedModel.runtime
    });
  }

  function formatBytes(bytes: number) {
    return bytes < 1_000_000 ? `${Math.round(bytes / 1000)} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`;
  }

  function confidence(value: number) {
    return `${Math.round(value * 100)}%`;
  }

  function runtimeLabel(runtime: RuntimeId) {
    if (runtime === "browser-local") return "browser";
    if (runtime === "sidecar-ollama") return "ollama";
    if (runtime === "sidecar-openai-compatible") return "openai-compatible";
    return "gateway";
  }

  function statusTone(status: ModelStatus | JobStatus): "neutral" | "good" | "warn" | "bad" | "info" {
    if (status === "installed" || status === "connected" || status === "available" || status === "approved") return "good";
    if (status === "downloading" || status === "extracting" || status === "pending") return "info";
    if (status === "not-installed" || status === "needs_review" || status === "offline") return "warn";
    if (status === "failed" || status === "rejected") return "bad";
    return "neutral";
  }
</script>

<header class="de-head">
  <Eyebrow>Document extraction</Eyebrow>
  <h1 class="de-title">Document Extraction</h1>
  <p class="de-lede">Local-first scan intake with explicit model setup, OCR/LLM normalization, source evidence, and human approval before data reaches another module.</p>
  <ol class="de-steps">
    <li><span class="mono">01</span><strong>Set runtime</strong><em>Gemma local, sidecar, or governed fallback</em></li>
    <li><span class="mono">02</span><strong>Extract draft</strong><em>fields, confidence, evidence, warnings</em></li>
    <li><span class="mono">03</span><strong>Approve output</strong><em>write only after staff review</em></li>
  </ol>
</header>

<section class="de-panel" aria-labelledby="de_runtime">
  <div class="de-panel__rail" aria-hidden="true"></div>
  <div class="de-section-head">
    <div>
      <p class="de-kicker mono">Runtime policy</p>
      <h2 id="de_runtime">Gemma setup and selection</h2>
    </div>
    <Badge tone={modelReady ? "good" : "warn"}>{modelReady ? "ready" : "setup required"}</Badge>
  </div>

  <div class="de-mode-grid" role="group" aria-label="Extraction mode">
    {#each modes as mode}
      <button type="button" class="de-mode" class:on={selectedMode === mode.id} onclick={() => (selectedMode = mode.id)}>
        <span>{mode.label}</span>
        <small>{mode.detail}</small>
      </button>
    {/each}
  </div>

  <div class="de-model-grid">
    {#each models as model (model.id)}
      <article class="de-model" class:chosen={selectedModel?.id === model.id}>
        <div class="de-model__top">
          <div>
            <h3>{model.label}</h3>
            <p class="mono">{model.model}</p>
          </div>
          <Badge tone={statusTone(model.status)}>{model.status}</Badge>
        </div>
        <dl class="de-model__meta">
          <div><dt>runtime</dt><dd>{runtimeLabel(model.runtime)}</dd></div>
          <div><dt>size</dt><dd>{model.size}</dd></div>
          {#if model.endpoint}<div><dt>endpoint</dt><dd>{model.endpoint}</dd></div>{/if}
        </dl>
        {#if model.status === "downloading"}
          <progress class="de-progress" value={model.progress ?? 0} max="100">{model.progress ?? 0}%</progress>
        {/if}
        <div class="de-model__actions">
          {#if model.status === "not-installed"}
            <Button size="sm" variant="primary" onclick={() => ondownload?.(model.id)}>Download model</Button>
          {:else if model.status === "offline"}
            <Button size="sm" variant="primary" onclick={() => onconnect?.(model.id)}>Connect sidecar</Button>
          {:else if model.status === "downloading"}
            <span class="de-note mono">{model.progress ?? 0}%</span>
          {:else}
            <Button size="sm" variant={selectedModel?.id === model.id ? "primary" : "ghost"} onclick={() => chooseModel(model)}>Use model</Button>
          {/if}
          {#if model.approvalRequired}<span class="de-approval mono">approval gate</span>{/if}
        </div>
      </article>
    {/each}
  </div>
</section>

<section class="de-workbench" aria-label="Extraction workbench">
  <div class="de-picker">
    <div class="de-section-head">
      <div>
        <p class="de-kicker mono">Source document</p>
        <h2>Scan queue</h2>
      </div>
      <select class="de-select" bind:value={selectedSchema} aria-label="Target schema">
        <option value="invoice">invoice</option>
        <option value="receipt">receipt</option>
        <option value="intake-form">intake-form</option>
        <option value="customer-document">customer-document</option>
        <option value="support-evidence">support-evidence</option>
        <option value="custom">custom</option>
      </select>
    </div>

    <div class="de-docs">
      {#each samples as sample (sample.id)}
        <button type="button" class="de-doc" class:on={selectedDocument?.id === sample.id} onclick={() => chooseDocument(sample)}>
          <span class="de-doc__mark mono">{sample.mimeType.includes("pdf") ? "PDF" : "IMG"}</span>
          <span class="de-doc__body">
            <strong>{sample.name}</strong>
            <small>{sample.targetType} / {sample.pages}p / {formatBytes(sample.bytes)}</small>
          </span>
        </button>
      {/each}
    </div>

    <div class="de-runbar">
      <Button variant="primary" disabled={!canExtract} onclick={runExtraction}>{busy ? "Extracting..." : "Run extraction"}</Button>
      <span class="de-runbar__hint mono">
        {#if !selectedModel}
          select model
        {:else if !modelReady}
          model setup required
        {:else}
          {selectedMode} via {runtimeLabel(selectedModel.runtime)}
        {/if}
      </span>
    </div>
  </div>

  <aside class="de-queue" aria-label="Extraction jobs">
    <p class="de-kicker mono">Jobs</p>
    {#if jobs.length}
      <ul>
        {#each jobs as job (job.id)}
          <li class:active={activeJob?.id === job.id}>
            <span>
              <strong>{job.documentName}</strong>
              <small class="mono">{job.id} / {runtimeLabel(job.runtime)}</small>
            </span>
            <Badge tone={statusTone(job.status)}>{job.status}</Badge>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="de-empty">No extraction jobs yet.</p>
    {/if}
  </aside>
</section>

<section class="de-review" aria-labelledby="de_review">
  <div class="de-section-head">
    <div>
      <p class="de-kicker mono">Review queue</p>
      <h2 id="de_review">{activeJob ? activeJob.documentName : "No active draft"}</h2>
    </div>
    {#if activeJob}<Badge tone={statusTone(activeJob.status)}>{activeJob.status}</Badge>{/if}
  </div>

  {#if activeJob}
    <div class="de-review__meta">
      <span class="mono">{activeJob.mode}</span>
      <span class="mono">{runtimeLabel(activeJob.runtime)}</span>
      <span class="mono">{activeJob.model}</span>
      <span class="mono">confidence {confidence(activeJob.confidence)}</span>
    </div>

    {#if activeJob.warnings.length}
      <ul class="de-warnings">
        {#each activeJob.warnings as warning}<li>{warning}</li>{/each}
      </ul>
    {/if}

    <div class="de-field-list" role="table" aria-label="Extracted fields">
      <div class="de-field-row de-field-row--head" role="row">
        <span role="columnheader">Field</span>
        <span role="columnheader">Value</span>
        <span role="columnheader">Confidence</span>
        <span role="columnheader">Evidence</span>
      </div>
      {#each activeJob.fields as field}
        <div class="de-field-row" class:flag={field.needsReview} role="row">
          <span role="cell">{field.name}</span>
          <span class="de-field-value" role="cell">{String(field.value ?? "missing")}</span>
          <span role="cell" class="de-conf"><meter min="0" max="1" value={field.confidence}></meter>{confidence(field.confidence)}</span>
          <span role="cell" class="de-evidence">{field.source}</span>
        </div>
      {/each}
    </div>

    <div class="de-actions">
      <Button variant="primary" disabled={reviewLocked} onclick={() => activeJob && onapprove?.(activeJob.id)}>Approve output</Button>
      <Button variant="ghost" disabled={reviewLocked} onclick={() => activeJob && onreject?.(activeJob.id)}>Reject draft</Button>
    </div>
  {:else}
    <p class="de-empty">Run extraction to create a reviewable draft.</p>
  {/if}
</section>

<style>
  .de-head { margin-bottom: 1.45rem; }
  .de-title { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.7rem, 3vw, 2.3rem); letter-spacing: 0; margin: 0.35rem 0 0.5rem; }
  .de-lede { color: var(--color-ink-soft); max-width: 68ch; margin: 0 0 0.9rem; font-size: 1rem; }
  .de-steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 0.55rem; max-width: 760px; }
  .de-steps li { display: grid; grid-template-columns: auto 1fr; gap: 0.65rem; align-items: start; color: var(--color-ink-soft); font-size: 0.86rem; }
  .de-steps span { color: var(--color-green); font-size: 0.72rem; padding-top: 0.12rem; }
  .de-steps strong { display: block; color: var(--color-ink); font-weight: 650; }
  .de-steps em { display: block; font-style: normal; color: var(--color-ink-faint); }

  .de-panel,
  .de-picker,
  .de-queue,
  .de-review {
    border: 1px solid var(--color-line-strong);
    background: linear-gradient(180deg, var(--color-panel), var(--color-panel-subtle));
    border-radius: 12px;
  }

  .de-panel { position: relative; overflow: hidden; padding: 1.15rem 1.2rem 1.25rem 1.4rem; }
  .de-panel__rail { position: absolute; inset: 0 auto 0 0; width: 3px; background: linear-gradient(180deg, var(--color-green), transparent); opacity: 0.75; }
  .de-section-head { display: flex; align-items: start; justify-content: space-between; gap: 0.85rem; margin-bottom: 0.9rem; }
  .de-section-head h2 { margin: 0.18rem 0 0; font-size: 1.02rem; line-height: 1.2; letter-spacing: 0; }
  .de-kicker { margin: 0; color: var(--color-ink-faint); font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }

  .de-mode-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.45rem; margin-bottom: 0.9rem; }
  .de-mode { min-block-size: 66px; text-align: left; border: 1px solid var(--color-line-strong); border-radius: 9px; background: var(--color-paper); color: var(--color-ink); padding: 0.58rem 0.7rem; cursor: pointer; }
  .de-mode span { display: block; font-weight: 700; font-size: 0.86rem; }
  .de-mode small { display: block; color: var(--color-ink-faint); line-height: 1.25; margin-top: 0.15rem; }
  .de-mode.on { border-color: var(--color-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-green) 15%, transparent); }

  .de-model-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 0.65rem; }
  .de-model { display: grid; gap: 0.75rem; min-block-size: 214px; background: var(--color-paper); border: 1px solid var(--color-line-strong); border-radius: 11px; padding: 0.85rem; }
  .de-model.chosen { border-color: var(--color-green); }
  .de-model__top { display: flex; align-items: start; justify-content: space-between; gap: 0.7rem; }
  .de-model h3 { margin: 0 0 0.18rem; font-size: 0.96rem; letter-spacing: 0; }
  .de-model p { margin: 0; color: var(--color-ink-faint); font-size: 0.72rem; overflow-wrap: anywhere; }
  .de-model__meta { display: grid; gap: 0.28rem; margin: 0; font-size: 0.78rem; }
  .de-model__meta div { display: grid; grid-template-columns: 4.6rem 1fr; gap: 0.5rem; min-width: 0; }
  .de-model__meta dt { color: var(--color-ink-faint); text-transform: uppercase; font-size: 0.62rem; letter-spacing: 0.06em; }
  .de-model__meta dd { margin: 0; color: var(--color-ink-soft); overflow-wrap: anywhere; }
  .de-progress { inline-size: 100%; accent-color: var(--color-green); }
  .de-model__actions { display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap; margin-top: auto; }
  .de-note, .de-approval { font-size: 0.7rem; color: var(--color-ink-faint); }
  .de-approval { color: var(--color-amber); }

  .de-workbench { display: grid; grid-template-columns: minmax(0, 1fr) minmax(240px, 0.42fr); gap: 0.85rem; margin-top: 0.9rem; align-items: start; }
  .de-picker, .de-queue, .de-review { padding: 1rem; }
  .de-select { background: var(--color-paper); border: 1px solid var(--color-line-strong); color: var(--color-ink); border-radius: 8px; padding: 0.42rem 0.55rem; font: inherit; font-size: 0.82rem; }
  .de-docs { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.5rem; }
  .de-doc { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 0.65rem; text-align: left; border: 1px solid var(--color-line-strong); border-radius: 10px; background: var(--color-paper); color: var(--color-ink); padding: 0.65rem 0.72rem; cursor: pointer; min-inline-size: 0; }
  .de-doc.on { border-color: var(--color-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-green) 14%, transparent); }
  .de-doc__mark { display: inline-grid; place-items: center; inline-size: 38px; block-size: 38px; border: 1px solid var(--color-line-strong); border-radius: 8px; color: var(--color-green); font-size: 0.72rem; }
  .de-doc__body { min-width: 0; display: grid; gap: 0.14rem; }
  .de-doc strong { font-size: 0.86rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .de-doc small { color: var(--color-ink-faint); font-size: 0.72rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .de-runbar { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.85rem; }
  .de-runbar__hint { color: var(--color-ink-faint); font-size: 0.72rem; }

  .de-queue ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.45rem; }
  .de-queue li { display: flex; justify-content: space-between; align-items: center; gap: 0.65rem; background: var(--color-paper); border: 1px solid var(--color-line-strong); border-radius: 9px; padding: 0.55rem 0.65rem; }
  .de-queue li.active { border-color: var(--color-green); }
  .de-queue strong { display: block; font-size: 0.82rem; }
  .de-queue small { display: block; color: var(--color-ink-faint); font-size: 0.68rem; }
  .de-empty { color: var(--color-ink-faint); font-size: 0.84rem; margin: 0; }

  .de-review { margin-top: 0.9rem; }
  .de-review__meta { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.75rem; }
  .de-review__meta span { border: 1px solid var(--color-line-strong); background: var(--color-paper); border-radius: 999px; padding: 0.22rem 0.55rem; color: var(--color-ink-soft); font-size: 0.7rem; }
  .de-warnings { margin: 0 0 0.75rem; padding: 0; list-style: none; display: grid; gap: 0.35rem; }
  .de-warnings li { border: 1px solid rgba(187, 85, 4, 0.24); background: var(--color-amber-soft); color: var(--color-amber); border-radius: 8px; padding: 0.45rem 0.6rem; font-size: 0.78rem; }

  .de-field-list { display: grid; overflow: auto; scrollbar-gutter: stable; border: 1px solid var(--color-line-strong); border-radius: 10px; background: var(--color-paper); }
  .de-field-row { display: grid; grid-template-columns: minmax(120px, 0.7fr) minmax(130px, 1fr) minmax(110px, 0.7fr) minmax(220px, 1.3fr); gap: 0.75rem; align-items: center; min-inline-size: 720px; padding: 0.62rem 0.75rem; border-top: 1px solid var(--color-line); font-size: 0.82rem; }
  .de-field-row:first-child { border-top: 0; }
  .de-field-row--head { color: var(--color-ink-faint); text-transform: uppercase; letter-spacing: 0.06em; font-size: 0.64rem; font-weight: 700; background: var(--color-panel-subtle); }
  .de-field-row.flag { background: color-mix(in srgb, var(--color-amber-soft) 42%, var(--color-paper)); }
  .de-field-value { font-weight: 700; color: var(--color-ink); }
  .de-conf { display: flex; align-items: center; gap: 0.45rem; color: var(--color-ink-soft); }
  .de-conf meter { inline-size: 58px; block-size: 0.55rem; }
  .de-evidence { color: var(--color-ink-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .de-actions { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-top: 0.85rem; }

  @media (max-width: 820px) {
    .de-workbench { grid-template-columns: 1fr; }
    .de-section-head { align-items: stretch; flex-direction: column; }
    .de-select { inline-size: 100%; }
  }
</style>
