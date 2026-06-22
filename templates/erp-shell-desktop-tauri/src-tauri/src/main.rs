#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{BufReader, Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

// Default to the QAT (quantization-aware-trained) E4B build: ~e4b quality with
// ~72% less memory than the plain checkpoint. e2b-it-qat is the faster option.
const DEFAULT_GEMMA_MODEL: &str = "gemma4:e4b-it-qat";
const OLLAMA_HOST: &str = "127.0.0.1:11434";
const DEFAULT_OCR_LANGUAGE: &str = "eng";
const MAX_GEMMA_IMAGE_PAGES: usize = 4;
// How long Ollama keeps the model resident after a request. A short default
// frees the multi-GB model promptly (review takes longer than this anyway), so a
// memory-constrained Mac is not left under pressure after a run. Override with
// MICROSERVICES_DESKTOP_KEEP_ALIVE (e.g. "10m") on a roomy machine for warm runs.
const OLLAMA_KEEP_ALIVE: &str = "30s";
// Phone photos are ~15-20 MP; the vision model downscales internally, so a full
// upload just wastes transfer + inference time. Cap the longest edge before send.
const MAX_VISION_EDGE: u32 = 1568;
const PREVIEW_MAX_EDGE: u32 = 1400;
const SUGGESTED_GEMMA_MODELS: [&str; 5] = [
    "gemma4:e2b-it-qat",
    "gemma4:e4b-it-qat",
    "gemma4:e2b",
    "gemma4:e4b",
    "gemma4:12b",
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeStatus {
    ocr: &'static str,
    llm: &'static str,
    model: String,
    mode: &'static str,
    ocr_engine: String,
    llm_engine: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeSettings {
    gemma_model: String,
    ocr_language: String,
    suggested_models: Vec<String>,
    installed_models: Vec<String>,
    selected_model_installed: bool,
    ollama_installed: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelInstallResult {
    model: String,
    output: String,
    settings: RuntimeSettings,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelProbeResult {
    model: String,
    ready: bool,
    latency_ms: u64,
    output: String,
    warnings: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportStatus {
    base_url: String,
    state: &'static str,
    pending_drafts: u32,
    imported_drafts: u32,
    token_configured: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ErpImportSettings {
    base_url: String,
    token_configured: bool,
}

struct ErpImportTransport {
    base_url: String,
    token: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ErpImportRequest {
    endpoint: String,
    token: String,
    payload: ErpImportPayload,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ErpImportPayload {
    local_job_id: String,
    file_name: String,
    file_hash: String,
    kind: String,
    status: String,
    confidence: f32,
    pages: u32,
    draft: ExtractionDraft,
    submitted_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportFolder {
    path: String,
    document_count: u32,
    new_documents: u32,
    duplicate_documents: u32,
    skipped_documents: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportResult {
    folder: ImportFolder,
    jobs: Vec<QueueJob>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct QueueJob {
    id: String,
    name: String,
    kind: String,
    status: String,
    confidence: f32,
    pages: u32,
    file_hash: String,
    path: String,
    imported_at: u64,
    draft: Option<ExtractionDraft>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct SourceRegion {
    page: Option<u32>,
    text: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExtractedField {
    name: String,
    value: Value,
    confidence: f32,
    source: Option<SourceRegion>,
    needs_review: Option<bool>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExtractedTable {
    name: String,
    columns: Vec<String>,
    rows: Vec<serde_json::Map<String, Value>>,
    confidence: f32,
    source: Option<SourceRegion>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExtractionDraft {
    schema_id: String,
    target_type: String,
    fields: Vec<ExtractedField>,
    tables: Vec<ExtractedTable>,
    raw_text: Option<String>,
    summary: Option<String>,
    confidence: f32,
    runtime: String,
    model: Option<String>,
    warnings: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExtractionResult {
    job: QueueJob,
    draft: ExtractionDraft,
}

#[tauri::command]
fn runtime_status(app: tauri::AppHandle) -> Result<RuntimeStatus, String> {
    let settings = open_queue(&app)?.runtime_settings()?;
    // Gemma vision is the single OCR + extraction engine: the selected local
    // Ollama model reads the page image directly, so OCR readiness == model
    // readiness. No separate OCR binary is involved.
    let llm_ready = ollama_model_available(&settings.gemma_model);

    Ok(RuntimeStatus {
        ocr: if llm_ready { "ready" } else { "missing" },
        llm: if llm_ready { "ready" } else { "missing" },
        model: settings.gemma_model,
        mode: "tauri",
        ocr_engine: ocr_engine_label(llm_ready).to_string(),
        llm_engine: "ollama".to_string(),
    })
}

fn ocr_engine_label(llm_ready: bool) -> &'static str {
    if llm_ready {
        return "gemma vision";
    }
    "install the gemma model to enable extraction"
}

#[tauri::command]
fn import_status(app: tauri::AppHandle) -> Result<ImportStatus, String> {
    let queue = open_queue(&app)?;
    let settings = queue.erp_import_settings()?;
    let pending_drafts = queue.approved_count()?;
    let imported_drafts = queue.imported_count()?;

    Ok(ImportStatus {
        state: if settings.token_configured && !settings.base_url.trim().is_empty() {
            "connected"
        } else {
            "not-configured"
        },
        base_url: settings.base_url,
        pending_drafts,
        imported_drafts,
        token_configured: settings.token_configured,
    })
}

#[tauri::command]
fn sync_status(app: tauri::AppHandle) -> Result<ImportStatus, String> {
    import_status(app)
}

#[tauri::command]
fn erp_import_settings(app: tauri::AppHandle) -> Result<ErpImportSettings, String> {
    open_queue(&app)?.erp_import_settings()
}

#[tauri::command]
fn save_erp_import_settings(
    app: tauri::AppHandle,
    base_url: String,
    token: String,
) -> Result<ErpImportSettings, String> {
    let queue = open_queue(&app)?;
    queue.save_erp_import_settings(&base_url, &token)?;
    queue.erp_import_settings()
}

#[tauri::command]
async fn select_import_folder(app: tauri::AppHandle) -> Result<Option<ImportResult>, String> {
    let Some(folder_path) = app
        .dialog()
        .file()
        .set_title("Select document import folder")
        .blocking_pick_folder()
    else {
        return Ok(None);
    };

    let path = folder_path
        .into_path()
        .map_err(|error| format!("Selected folder is not a local path: {error}"))?;

    import_folder(&app, path).map(Some)
}

#[tauri::command]
async fn select_import_files(app: tauri::AppHandle) -> Result<Option<ImportResult>, String> {
    let Some(file_paths) = app
        .dialog()
        .file()
        .set_title("Select documents to import")
        .add_filter(
            "Documents",
            &["pdf", "png", "jpg", "jpeg", "webp", "tif", "tiff", "bmp"],
        )
        .blocking_pick_files()
    else {
        return Ok(None);
    };

    let paths = file_paths
        .into_iter()
        .map(|file_path| {
            file_path
                .into_path()
                .map_err(|error| format!("Selected file is not a local path: {error}"))
        })
        .collect::<Result<Vec<_>, _>>()?;

    import_paths(&app, paths).map(Some)
}

#[tauri::command]
fn import_folder_path(app: tauri::AppHandle, path: String) -> Result<ImportResult, String> {
    import_paths(&app, vec![PathBuf::from(path)])
}

#[tauri::command]
fn import_document_paths(
    app: tauri::AppHandle,
    paths: Vec<String>,
) -> Result<ImportResult, String> {
    import_paths(
        &app,
        paths.into_iter().map(PathBuf::from).collect::<Vec<_>>(),
    )
}

#[tauri::command]
fn queue_documents(app: tauri::AppHandle) -> Result<Vec<QueueJob>, String> {
    open_queue(&app)?.list_jobs()
}

#[tauri::command]
fn runtime_settings(app: tauri::AppHandle) -> Result<RuntimeSettings, String> {
    open_queue(&app)?.runtime_settings()
}

#[tauri::command]
fn save_runtime_settings(
    app: tauri::AppHandle,
    gemma_model: String,
    ocr_language: String,
) -> Result<RuntimeSettings, String> {
    let queue = open_queue(&app)?;
    queue.save_runtime_settings(&gemma_model, &ocr_language)?;
    queue.runtime_settings()
}

#[tauri::command]
async fn install_gemma_model(
    app: tauri::AppHandle,
    model: String,
) -> Result<ModelInstallResult, String> {
    validate_model_name(&model)?;
    let pull_model = model.clone();
    let output = tauri::async_runtime::spawn_blocking(move || {
        Command::new("ollama").arg("pull").arg(&pull_model).output()
    })
    .await
    .map_err(|error| format!("Failed to join Ollama install task: {error}"))?
    .map_err(|error| format!("Failed to run Ollama. Install Ollama first: {error}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !output.status.success() {
        return Err(format!(
            "Ollama failed to install {model}{}",
            if stderr.is_empty() {
                ".".to_string()
            } else {
                format!(": {stderr}")
            }
        ));
    }

    let queue = open_queue(&app)?;
    let current = queue.runtime_settings()?;
    queue.save_runtime_settings(&model, &current.ocr_language)?;
    let settings = queue.runtime_settings()?;

    Ok(ModelInstallResult {
        model,
        output: if stdout.is_empty() { stderr } else { stdout },
        settings,
    })
}

#[tauri::command]
async fn test_gemma_model(model: String) -> Result<ModelProbeResult, String> {
    validate_model_name(&model)?;
    let selected_model = model.trim().to_string();
    tauri::async_runtime::spawn_blocking(move || probe_gemma_model(&selected_model))
        .await
        .map_err(|error| format!("Failed to join Ollama test task: {error}"))?
}

#[tauri::command]
async fn extract_document(
    app: tauri::AppHandle,
    job_id: String,
) -> Result<ExtractionResult, String> {
    // The Gemma vision call blocks for tens of seconds. Run it (and the SQLite
    // work) on a blocking thread so the webview stays responsive — the status
    // bar can repaint and the app never appears to hang during a run.
    tauri::async_runtime::spawn_blocking(move || extract_document_blocking(&app, &job_id))
        .await
        .map_err(|error| format!("Failed to join extraction task: {error}"))?
}

fn extract_document_blocking(
    app: &tauri::AppHandle,
    job_id: &str,
) -> Result<ExtractionResult, String> {
    let queue = open_queue(app)?;
    let settings = queue.runtime_settings()?;
    let job = queue
        .get_job(job_id)?
        .ok_or_else(|| format!("Draft job not found: {job_id}"))?;

    queue.update_status(&job.id, "extracting", job.confidence)?;

    // Single engine: hand the page image(s) straight to the local Gemma vision
    // model. When the model is not installed (or the call fails) we fall back to
    // a deterministic empty draft so the job stays reviewable instead of lost.
    let mut warnings = Vec::new();
    let mut draft = match normalize_with_gemma_images(
        &job,
        Path::new(&job.path),
        &settings.gemma_model,
    ) {
        Ok(Some(gemma_draft)) => gemma_draft,
        Ok(None) => {
            warnings.push(format!(
                "Gemma vision extraction skipped because Ollama model {} is not installed. Install it from Runtime Settings.",
                settings.gemma_model
            ));
            normalize_document_draft(&job, "", Vec::new())
        }
        Err(error) => {
            warnings.push(format!("Gemma vision extraction failed: {error}"));
            normalize_document_draft(&job, "", Vec::new())
        }
    };

    if !warnings.is_empty() {
        draft.warnings.extend(warnings);
        draft.warnings.sort();
        draft.warnings.dedup();
    }

    let saved = queue.update_extraction(&job.id, "review", draft.confidence, &draft)?;
    Ok(ExtractionResult { job: saved, draft })
}

#[tauri::command]
fn document_draft(
    app: tauri::AppHandle,
    job_id: String,
) -> Result<Option<ExtractionDraft>, String> {
    Ok(open_queue(&app)?
        .get_job(&job_id)?
        .and_then(|job| job.draft))
}

#[tauri::command]
async fn document_preview(app: tauri::AppHandle, job_id: String) -> Result<Option<String>, String> {
    // PDF rasterization + image encode are blocking; keep them off the UI thread.
    tauri::async_runtime::spawn_blocking(move || document_preview_blocking(&app, &job_id))
        .await
        .map_err(|error| format!("Failed to join preview task: {error}"))?
}

/// In-memory cache of rendered page previews, keyed by document content hash, so
/// re-opening Review never re-rasterizes a PDF or re-decodes a photo.
fn preview_cache() -> &'static std::sync::Mutex<std::collections::HashMap<String, String>> {
    static CACHE: std::sync::OnceLock<std::sync::Mutex<std::collections::HashMap<String, String>>> =
        std::sync::OnceLock::new();
    CACHE.get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()))
}

fn document_preview_blocking(
    app: &tauri::AppHandle,
    job_id: &str,
) -> Result<Option<String>, String> {
    let queue = open_queue(app)?;
    let Some(job) = queue.get_job(job_id)? else {
        return Ok(None);
    };

    // Same file bytes -> same preview; cache by content hash so the heavy
    // rasterize/decode happens at most once per document, not on every visit.
    let cache_key = job.file_hash.clone();
    if let Some(cached) = preview_cache()
        .lock()
        .ok()
        .and_then(|cache| cache.get(&cache_key).cloned())
    {
        return Ok(Some(cached));
    }

    let path = PathBuf::from(&job.path);
    if !path.exists() {
        return Ok(None);
    }

    let (pages, _scratch) = document_image_pages(&path)?;
    let Some(first) = pages.first() else {
        return Ok(None);
    };
    let bytes = fs::read(first).map_err(|error| format!("Failed to read preview page: {error}"))?;
    let Some(jpeg) = preview_jpeg(&bytes) else {
        return Ok(None);
    };
    let data_url = format!("data:image/jpeg;base64,{}", base64_encode(&jpeg));

    if let Ok(mut cache) = preview_cache().lock() {
        cache.insert(cache_key, data_url.clone());
    }
    Ok(Some(data_url))
}

#[tauri::command]
fn enqueue_sample_documents() -> Vec<QueueJob> {
    sample_documents()
}

#[tauri::command]
fn update_draft_field(
    app: tauri::AppHandle,
    job_id: String,
    field_name: String,
    value: String,
) -> Result<QueueJob, String> {
    open_queue(&app)?.update_field(&job_id, &field_name, &value)
}

#[tauri::command]
fn approve_job(app: tauri::AppHandle, job_id: String) -> Result<QueueJob, String> {
    open_queue(&app)?.approve(&job_id)
}

#[tauri::command]
fn reject_job(app: tauri::AppHandle, job_id: String, reason: String) -> Result<QueueJob, String> {
    open_queue(&app)?.reject(&job_id, &reason)
}

#[tauri::command]
fn desktop_import_request(
    app: tauri::AppHandle,
    job_id: String,
) -> Result<ErpImportRequest, String> {
    let queue = open_queue(&app)?;
    let settings = queue.erp_import_transport()?;
    let job = queue
        .get_job(&job_id)?
        .ok_or_else(|| format!("Draft job not found: {job_id}"))?;
    if job.status != "approved" {
        return Err(format!(
            "Only approved drafts can be imported into ERP: {job_id}"
        ));
    }
    let draft = job
        .draft
        .clone()
        .ok_or_else(|| format!("Approved draft has no extraction payload: {job_id}"))?;

    Ok(ErpImportRequest {
        endpoint: format!(
            "{}/api/desktop/import",
            settings.base_url.trim_end_matches('/')
        ),
        token: settings.token,
        payload: ErpImportPayload {
            local_job_id: job.id,
            file_name: job.name,
            file_hash: job.file_hash,
            kind: job.kind,
            status: "approved".to_string(),
            confidence: job.confidence,
            pages: job.pages,
            draft,
            submitted_at: now_unix_seconds().to_string(),
        },
    })
}

#[tauri::command]
fn mark_job_imported(app: tauri::AppHandle, job_id: String) -> Result<QueueJob, String> {
    open_queue(&app)?.mark_imported(&job_id)
}

fn import_folder(app: &tauri::AppHandle, path: PathBuf) -> Result<ImportResult, String> {
    if !path.is_dir() {
        return Err(format!("Import path is not a folder: {}", path.display()));
    }

    import_paths(app, vec![path])
}

fn import_paths(app: &tauri::AppHandle, paths: Vec<PathBuf>) -> Result<ImportResult, String> {
    let selection = collect_documents_from_paths(&paths)?;
    let queue = open_queue(app)?;
    let mut new_documents = 0;
    let mut duplicate_documents = 0;

    for file_path in &selection.documents {
        let file_hash = hash_file(file_path)?;
        let job = build_job(file_path, file_hash)?;

        if queue.insert_job(&job)? {
            new_documents += 1;
        } else {
            duplicate_documents += 1;
        }
    }

    Ok(ImportResult {
        folder: ImportFolder {
            path: selection.source_label,
            document_count: selection.documents.len() as u32,
            new_documents,
            duplicate_documents,
            skipped_documents: selection.skipped_documents,
        },
        jobs: queue.list_jobs()?,
    })
}

struct ImportSelection {
    source_label: String,
    documents: Vec<PathBuf>,
    skipped_documents: u32,
}

fn collect_documents_from_paths(paths: &[PathBuf]) -> Result<ImportSelection, String> {
    if paths.is_empty() {
        return Err("No import paths were provided.".to_string());
    }

    let mut documents = Vec::new();
    let mut skipped_documents = 0;

    for path in paths {
        if path.is_dir() {
            documents.extend(collect_documents(path)?);
        } else if path.is_file() && is_supported_document(path) {
            documents.push(path.to_path_buf());
        } else {
            skipped_documents += 1;
        }
    }

    documents.sort();

    Ok(ImportSelection {
        source_label: import_source_label(paths),
        documents,
        skipped_documents,
    })
}

fn import_source_label(paths: &[PathBuf]) -> String {
    if let [path] = paths {
        return path.display().to_string();
    }

    format!("{} dropped items", paths.len())
}

fn collect_documents(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut documents = Vec::new();
    let mut pending = vec![root.to_path_buf()];

    while let Some(folder) = pending.pop() {
        let entries = fs::read_dir(&folder)
            .map_err(|error| format!("Failed to read folder {}: {error}", folder.display()))?;

        for entry in entries {
            let entry = entry.map_err(|error| format!("Failed to read folder entry: {error}"))?;
            let path = entry.path();
            let file_type = entry
                .file_type()
                .map_err(|error| format!("Failed to inspect {}: {error}", path.display()))?;

            if file_type.is_dir() {
                pending.push(path);
            } else if file_type.is_file() && is_supported_document(&path) {
                documents.push(path);
            }
        }
    }

    documents.sort();
    Ok(documents)
}

fn is_supported_document(path: &Path) -> bool {
    let Some(extension) = path.extension().and_then(|value| value.to_str()) else {
        return false;
    };

    matches!(
        extension.to_ascii_lowercase().as_str(),
        "pdf" | "png" | "jpg" | "jpeg" | "webp" | "tif" | "tiff" | "bmp" | "heic"
    )
}

fn build_job(path: &Path, file_hash: String) -> Result<QueueJob, String> {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| format!("File has no readable name: {}", path.display()))?
        .to_string();

    Ok(QueueJob {
        id: format!("job_{}", &file_hash[..16]),
        kind: infer_kind(&name).to_string(),
        name,
        status: "ready".to_string(),
        confidence: 0.0,
        pages: estimate_pages(path),
        file_hash,
        path: path.display().to_string(),
        imported_at: now_unix_seconds(),
        draft: None,
    })
}

fn infer_kind(name: &str) -> &'static str {
    let normalized = name.to_ascii_lowercase();

    if normalized.contains("invoice")
        || normalized.contains("receipt")
        || normalized.contains("statement")
    {
        return "invoice";
    }

    if normalized.contains("intake")
        || normalized.contains("onboarding")
        || normalized.contains("form")
    {
        return "intake";
    }

    "support"
}

fn estimate_pages(path: &Path) -> u32 {
    if is_pdf(path) {
        if let Some(count) = pdf_page_count(path) {
            return count.max(1);
        }
    }

    1
}

fn is_pdf(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("pdf"))
}

fn pdf_page_count(path: &Path) -> Option<u32> {
    let output = Command::new("pdfinfo").arg(path).output().ok()?;
    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout
        .lines()
        .find_map(|line| line.strip_prefix("Pages:"))
        .and_then(|value| value.trim().parse::<u32>().ok())
}

fn pdftoppm_available() -> bool {
    Command::new("pdftoppm")
        .arg("-v")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok_and(|status| status.success())
}

/// Rasterize each PDF page to a PNG in `out_dir` so the local Gemma vision model
/// can read it. Pages are returned in page order.
fn rasterize_pdf(path: &Path, out_dir: &Path) -> Result<Vec<PathBuf>, String> {
    let prefix = out_dir.join("page");
    let output = Command::new("pdftoppm")
        .arg("-png")
        .arg("-r")
        .arg("300")
        .arg(path)
        .arg(&prefix)
        .output()
        .map_err(|error| format!("Failed to run pdftoppm for PDF rasterization: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(format!(
            "pdftoppm failed to rasterize {}{}",
            path.display(),
            if stderr.is_empty() {
                ".".to_string()
            } else {
                format!(": {stderr}")
            }
        ));
    }

    let mut pages = Vec::new();
    let entries = fs::read_dir(out_dir)
        .map_err(|error| format!("Failed to read rasterized PDF pages: {error}"))?;
    for entry in entries {
        let entry =
            entry.map_err(|error| format!("Failed to read rasterized PDF page entry: {error}"))?;
        let page = entry.path();
        if page
            .extension()
            .and_then(|value| value.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("png"))
        {
            pages.push(page);
        }
    }

    pages.sort();

    if pages.is_empty() {
        return Err(format!(
            "PDF rasterization produced no pages: {}",
            path.display()
        ));
    }

    Ok(pages)
}

fn document_image_pages(path: &Path) -> Result<(Vec<PathBuf>, Option<tempfile::TempDir>), String> {
    if !path.exists() {
        return Err(format!(
            "Source file is no longer available: {}",
            path.display()
        ));
    }

    if is_ocr_image(path) {
        Ok((vec![path.to_path_buf()], None))
    } else if is_pdf(path) {
        if !pdftoppm_available() {
            return Err(
                "Poppler pdftoppm is not installed or is not on PATH. Install poppler to convert PDFs to images for local extraction."
                    .to_string(),
            );
        }

        match tempfile::tempdir() {
            Ok(dir) => match rasterize_pdf(path, dir.path()) {
                Ok(pages) => Ok((pages, Some(dir))),
                Err(error) => Err(error),
            },
            Err(error) => Err(format!(
                "Failed to create a scratch directory for PDF rasterization: {error}"
            )),
        }
    } else {
        Err(format!(
            "Document extraction supports scanned images and PDFs only. {} is not a supported document type.",
            path.extension()
                .and_then(|value| value.to_str())
                .unwrap_or("unknown")
        ))
    }
}

fn is_ocr_image(path: &Path) -> bool {
    let Some(extension) = path.extension().and_then(|value| value.to_str()) else {
        return false;
    };

    matches!(
        extension.to_ascii_lowercase().as_str(),
        "png" | "jpg" | "jpeg" | "webp" | "tif" | "tiff" | "bmp"
    )
}

fn normalize_document_draft(
    job: &QueueJob,
    raw_text: &str,
    warnings: Vec<String>,
) -> ExtractionDraft {
    let fields = infer_fields(job, raw_text);
    let confidence = average_confidence(&fields);
    let summary = if raw_text.trim().is_empty() {
        Some(format!(
            "{} needs OCR/runtime setup before a document draft can be produced.",
            job.name
        ))
    } else {
        Some(format!(
            "{} converted from scanned image text with {} extracted fields.",
            job.name,
            fields.len()
        ))
    };

    ExtractionDraft {
        schema_id: schema_id_for_job(job).to_string(),
        target_type: target_type_for_job(job).to_string(),
        fields,
        tables: Vec::new(),
        raw_text: if raw_text.trim().is_empty() {
            None
        } else {
            Some(raw_text.trim().to_string())
        },
        summary,
        confidence,
        runtime: "sidecar".to_string(),
        model: None,
        warnings,
    }
}

fn infer_fields(job: &QueueJob, raw_text: &str) -> Vec<ExtractedField> {
    let mut fields = Vec::new();
    let lines = raw_text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>();

    if let Some(first_line) = lines.first() {
        fields.push(text_field(
            "documentTitle",
            (*first_line).to_string(),
            0.62,
            Some(*first_line),
        ));
    }

    if let Some(value) = find_value_after_keywords(
        &lines,
        &["invoice", "receipt", "statement"],
        &["number", "no", "#"],
    ) {
        fields.push(text_field("documentNumber", value, 0.72, None));
    }

    if let Some(value) = find_date(&lines) {
        fields.push(text_field("date", value, 0.68, None));
    }

    if let Some(value) = find_total(&lines) {
        fields.push(text_field("total", value, 0.74, None));
    }

    if fields.is_empty() {
        let fallback = if raw_text.trim().is_empty() {
            job.name.clone()
        } else {
            raw_text.trim().chars().take(500).collect()
        };
        fields.push(text_field("rawText", fallback, 0.25, None));
    }

    fields
}

fn text_field(
    name: &str,
    value: String,
    confidence: f32,
    source_text: Option<&str>,
) -> ExtractedField {
    ExtractedField {
        name: name.to_string(),
        value: Value::String(value),
        confidence,
        source: source_text.map(|text| SourceRegion {
            page: Some(1),
            text: Some(text.chars().take(500).collect()),
        }),
        needs_review: Some(confidence < 0.85),
    }
}

fn average_confidence(fields: &[ExtractedField]) -> f32 {
    if fields.is_empty() {
        return 0.0;
    }

    let total = fields.iter().map(|field| field.confidence).sum::<f32>();
    (total / fields.len() as f32).clamp(0.0, 1.0)
}

fn schema_id_for_job(job: &QueueJob) -> &'static str {
    match job.kind.as_str() {
        "invoice" => "erp.invoice.default",
        "intake" => "erp.intake-form.default",
        _ => "erp.support-evidence.default",
    }
}

fn target_type_for_job(job: &QueueJob) -> &'static str {
    match job.kind.as_str() {
        "invoice" => "invoice",
        "intake" => "intake-form",
        _ => "support-evidence",
    }
}

fn find_value_after_keywords(
    lines: &[&str],
    primary: &[&str],
    secondary: &[&str],
) -> Option<String> {
    for line in lines {
        let normalized = line.to_ascii_lowercase();
        if primary.iter().any(|keyword| normalized.contains(keyword))
            && secondary.iter().any(|keyword| normalized.contains(keyword))
        {
            let value = value_after_separator(line)
                .or_else(|| line.split_whitespace().last().map(str::to_string))
                .unwrap_or_default();
            if value.len() > 1 {
                return Some(value);
            }
        }
    }

    None
}

fn value_after_separator(line: &str) -> Option<String> {
    for marker in [":", "#"] {
        if let Some((_, value)) = line.split_once(marker) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

fn find_date(lines: &[&str]) -> Option<String> {
    for line in lines {
        for token in line.split_whitespace() {
            let cleaned =
                token.trim_matches(|c: char| !c.is_ascii_alphanumeric() && c != '/' && c != '-');
            let digit_count = cleaned.chars().filter(|c| c.is_ascii_digit()).count();
            if digit_count >= 6 && (cleaned.contains('/') || cleaned.contains('-')) {
                return Some(cleaned.to_string());
            }
        }
    }
    None
}

fn find_total(lines: &[&str]) -> Option<String> {
    let mut candidate = None;

    for line in lines {
        let normalized = line.to_ascii_lowercase();
        if normalized.contains("total")
            || normalized.contains("amount due")
            || normalized.contains("balance due")
        {
            if let Some(amount) = last_amount_like_token(line) {
                return Some(amount);
            }
        }

        if let Some(amount) = last_amount_like_token(line) {
            candidate = Some(amount);
        }
    }

    candidate
}

fn last_amount_like_token(line: &str) -> Option<String> {
    line.split_whitespace()
        .rev()
        .map(|token| {
            token.trim_matches(|c: char| {
                !(c.is_ascii_digit() || c == '$' || c == '.' || c == ',' || c == '-')
            })
        })
        .find(|token| {
            let digits = token.chars().filter(|c| c.is_ascii_digit()).count();
            digits > 0 && (token.contains('.') || token.contains('$'))
        })
        .map(str::to_string)
}

fn normalize_with_gemma_images(
    job: &QueueJob,
    path: &Path,
    model: &str,
) -> Result<Option<ExtractionDraft>, String> {
    if !ollama_model_available(model) {
        return Ok(None);
    }

    let (image_pages, _scratch) = document_image_pages(path)?;
    let encoded_pages = encode_image_pages(&image_pages)?;

    let response = ollama_generate_with_images(model, job, &encoded_pages)?;
    let parsed = parse_json_object(&response)?;
    let extraction = extraction_from_object(parsed)?;
    let mut draft = build_validated_draft(job, model, None, extraction);
    llm_log(format!(
        "extracted {} field(s), {} line item(s)",
        draft.fields.len(),
        draft
            .tables
            .iter()
            .map(|table| table.rows.len())
            .sum::<usize>()
    ));
    if image_pages.len() > encoded_pages.len() {
        draft.warnings.push(format!(
            "Gemma vision used the first {} pages out of {}.",
            encoded_pages.len(),
            image_pages.len()
        ));
    }

    Ok(Some(draft))
}

fn encode_image_pages(image_pages: &[PathBuf]) -> Result<Vec<String>, String> {
    image_pages
        .iter()
        .take(MAX_GEMMA_IMAGE_PAGES)
        .map(|page| {
            let bytes = fs::read(page).map_err(|error| {
                format!("Failed to read image page {}: {error}", page.display())
            })?;
            let scaled = downscale_for_vision(&bytes);
            llm_log(format!(
                "page {}: {} -> {} bytes",
                page.display(),
                bytes.len(),
                scaled.len()
            ));
            Ok(base64_encode(&scaled))
        })
        .collect()
}

/// Resize a decoded image so its longest edge is at most `max_edge`, then encode
/// it as JPEG. Returns None on any encode failure.
fn resize_and_jpeg(image: image::DynamicImage, max_edge: u32, quality: u8) -> Option<Vec<u8>> {
    let longest = image.width().max(image.height());
    let scaled = if longest > max_edge {
        let ratio = max_edge as f32 / longest as f32;
        let width = ((image.width() as f32) * ratio).round().max(1.0) as u32;
        let height = ((image.height() as f32) * ratio).round().max(1.0) as u32;
        image.resize(width, height, image::imageops::FilterType::Triangle)
    } else {
        image
    };

    let rgb = scaled.to_rgb8();
    let mut out = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, quality)
        .encode_image(&rgb)
        .ok()?;
    (!out.is_empty()).then_some(out)
}

/// Shrink an oversized page image before sending it to the vision model.
/// Best-effort: if the image is already small enough, or decode/encode fails,
/// the original bytes are returned unchanged.
fn downscale_for_vision(bytes: &[u8]) -> Vec<u8> {
    match image::load_from_memory(bytes) {
        Ok(image) if image.width().max(image.height()) > MAX_VISION_EDGE => {
            resize_and_jpeg(image, MAX_VISION_EDGE, 82).unwrap_or_else(|| bytes.to_vec())
        }
        _ => bytes.to_vec(),
    }
}

/// JPEG preview of a page image for the review screen. Always re-encodes to JPEG
/// so the data URL's media type is correct.
fn preview_jpeg(bytes: &[u8]) -> Option<Vec<u8>> {
    let image = image::load_from_memory(bytes).ok()?;
    resize_and_jpeg(image, PREVIEW_MAX_EDGE, 80)
}

// ── Structured output: what the local model returns ──────────────────
// The model is constrained to a per-document-type JSON Schema (extraction_schema)
// via Ollama's `format`, so it fills a real named template instead of a free
// {name,value} bag. It does NOT return confidence — we compute that from
// deterministic validators, so the review signal is verifiable.
#[derive(Debug, Default)]
struct GemmaExtraction {
    fields: Vec<GemmaField>,
    line_items: Vec<GemmaLineItem>,
    summary: Option<String>,
    // A faithful Markdown transcription of the whole document — the verification
    // view (read against the image) and the searchable source text.
    markdown: Option<String>,
}

#[derive(Debug)]
struct GemmaField {
    name: String,
    value: Value,
}

#[derive(Debug)]
struct GemmaLineItem {
    description: Value,
    quantity: Value,
    amount: Value,
}

/// Fields we ask the model to fill per document type, which are required (forcing
/// the model to at least attempt them), and whether the doc has a line-item table.
struct DocumentSchema {
    fields: &'static [&'static str],
    required: &'static [&'static str],
    line_items: bool,
}

fn document_schema_def(kind: &str) -> DocumentSchema {
    match kind {
        "invoice" => DocumentSchema {
            fields: &[
                "documentNumber",
                "documentDate",
                "dueDate",
                "vendor",
                "billTo",
                "currency",
                "subtotal",
                "tax",
                "total",
            ],
            required: &["documentNumber", "documentDate", "total"],
            line_items: true,
        },
        "intake" => DocumentSchema {
            fields: &[
                "fullName", "email", "phone", "company", "address", "date", "notes",
            ],
            required: &["fullName"],
            line_items: false,
        },
        _ => DocumentSchema {
            fields: &["subject", "reference", "date", "customer", "description"],
            required: &["subject", "description"],
            line_items: false,
        },
    }
}

/// Per-document-type JSON Schema sent as Ollama's `format`. Named properties (and
/// a few required ones) push the small model to fill a complete template rather
/// than returning a single field — and kill the "invent the schema" brittleness.
fn extraction_schema(kind: &str) -> Value {
    let def = document_schema_def(kind);
    let mut properties = serde_json::Map::new();
    for field in def.fields {
        properties.insert((*field).to_string(), json!({ "type": "string" }));
    }
    if def.line_items {
        properties.insert(
            "lineItems".to_string(),
            json!({
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "description": { "type": "string" },
                        "quantity": { "type": "string" },
                        "amount": { "type": "string" }
                    },
                    "required": ["description", "amount"]
                }
            }),
        );
    }
    properties.insert("summary".to_string(), json!({ "type": "string" }));
    properties.insert("markdown".to_string(), json!({ "type": "string" }));

    let mut required: Vec<Value> = def
        .required
        .iter()
        .map(|field| Value::String((*field).to_string()))
        .collect();
    required.push(Value::String("summary".to_string()));
    required.push(Value::String("markdown".to_string()));

    json!({
        "type": "object",
        "properties": Value::Object(properties),
        "required": Value::Array(required)
    })
}

/// Convert the model's named-field object into our generic extraction shape:
/// every scalar property becomes a field, `lineItems` becomes the table, and
/// `summary` is pulled out separately.
fn extraction_from_object(value: Value) -> Result<GemmaExtraction, String> {
    let Value::Object(map) = value else {
        return Err("Gemma structured response must be a JSON object.".to_string());
    };

    let mut fields = Vec::new();
    let mut line_items = Vec::new();
    let mut summary = None;
    let mut markdown = None;

    for (key, val) in map {
        match key.as_str() {
            "fields" => append_legacy_fields(val, &mut fields)?,
            "lineItems" | "line_items" => append_line_items(val, &mut line_items)?,
            "summary" => summary = Some(value_to_plain_string(&val)),
            // Pulled out here so the full transcript never lands in `fields` as a
            // giant value via the catch-all arm below.
            "markdown" | "transcript" => markdown = Some(value_to_plain_string(&val)),
            _ => fields.push(GemmaField {
                name: key,
                value: Value::String(value_to_plain_string(&val)),
            }),
        }
    }

    Ok(GemmaExtraction {
        fields,
        line_items,
        summary,
        markdown,
    })
}

fn append_legacy_fields(value: Value, fields: &mut Vec<GemmaField>) -> Result<(), String> {
    let Value::Array(items) = value else {
        if value.is_null() {
            return Ok(());
        }
        return Err("Gemma legacy fields response must be an array.".to_string());
    };

    for item in items {
        let Value::Object(row) = item else {
            return Err("Gemma legacy field entries must be objects.".to_string());
        };
        let name = row.get("name").and_then(Value::as_str).unwrap_or("").trim();
        if name.is_empty() {
            return Err("Gemma legacy field entries must include a non-empty name.".to_string());
        }
        fields.push(GemmaField {
            name: name.to_string(),
            value: row.get("value").cloned().unwrap_or(Value::Null),
        });
    }

    Ok(())
}

fn append_line_items(value: Value, line_items: &mut Vec<GemmaLineItem>) -> Result<(), String> {
    let Value::Array(items) = value else {
        if value.is_null() {
            return Ok(());
        }
        return Err("Gemma lineItems response must be an array.".to_string());
    };

    for item in items {
        let Value::Object(row) = item else {
            return Err("Gemma lineItems entries must be objects.".to_string());
        };
        line_items.push(GemmaLineItem {
            description: row.get("description").cloned().unwrap_or(Value::Null),
            quantity: row.get("quantity").cloned().unwrap_or(Value::Null),
            amount: row
                .get("amount")
                .or_else(|| row.get("unitPrice"))
                .cloned()
                .unwrap_or(Value::Null),
        });
    }

    Ok(())
}

fn fill_missing_schema_fields(kind: &str, fields: &mut Vec<GemmaField>) -> Vec<String> {
    let mut added = Vec::new();
    for name in document_schema_def(kind).fields {
        if !fields.iter().any(|field| field.name == *name) {
            fields.push(GemmaField {
                name: (*name).to_string(),
                value: Value::String(String::new()),
            });
            added.push((*name).to_string());
        }
    }
    added
}

struct FieldOutcome {
    confidence: f32,
    needs_review: bool,
    warning: Option<String>,
}

/// Deterministic per-field validation. Confidence reflects whether the value
/// passes a real check (date parses, amount is numeric, total reconciles with
/// the line items) — not the model's self-assessment.
fn validate_field(name: &str, value: &str, line_total: Option<f64>) -> FieldOutcome {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return FieldOutcome {
            confidence: 0.0,
            needs_review: true,
            warning: Some(format!("Field '{name}' is empty and needs manual entry.")),
        };
    }

    let key = name.to_ascii_lowercase();

    if key.contains("date") {
        // Dates are inherently ambiguous (19/6, 6/19/26, "Jun 19 2026"), so a
        // failed parse is NOT proof the value is wrong — flag it for a glance,
        // don't claim it is invalid.
        return if looks_like_date(trimmed) {
            FieldOutcome {
                confidence: 0.9,
                needs_review: false,
                warning: None,
            }
        } else {
            FieldOutcome {
                confidence: 0.6,
                needs_review: true,
                warning: None,
            }
        };
    }

    if key == "currency" {
        let ok = trimmed.len() == 3 && trimmed.chars().all(|c| c.is_ascii_alphabetic());
        return FieldOutcome {
            confidence: if ok { 0.9 } else { 0.5 },
            needs_review: !ok,
            warning: None,
        };
    }

    if key.contains("total")
        || key.contains("amount")
        || key.contains("subtotal")
        || key.contains("tax")
        || key.contains("price")
        || key.contains("balance")
    {
        return match parse_amount(trimmed) {
            Some(amount) => {
                if key.contains("total") {
                    if let Some(sum) = line_total {
                        return if (amount - sum).abs() <= 0.01 {
                            FieldOutcome {
                                confidence: 0.99,
                                needs_review: false,
                                warning: None,
                            }
                        } else {
                            FieldOutcome {
                                confidence: 0.5,
                                needs_review: true,
                                warning: Some(format!(
                                    "Total {amount:.2} does not match the line-item sum {sum:.2}."
                                )),
                            }
                        };
                    }
                }
                FieldOutcome {
                    confidence: 0.9,
                    needs_review: false,
                    warning: None,
                }
            }
            None => FieldOutcome {
                confidence: 0.35,
                needs_review: true,
                warning: Some(format!(
                    "Field '{name}' value '{trimmed}' is not a valid amount."
                )),
            },
        };
    }

    // Present, non-empty free text: usable, but still worth a human glance.
    FieldOutcome {
        confidence: 0.75,
        needs_review: false,
        warning: None,
    }
}

/// Parse a printed money value (`$1,240.00`, `1 240,00`-free) into a number.
fn parse_amount(value: &str) -> Option<f64> {
    let cleaned: String = value
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '.' || *c == '-')
        .collect();
    if cleaned.is_empty() || cleaned == "-" || cleaned == "." {
        return None;
    }
    cleaned.parse::<f64>().ok()
}

/// Lenient date detector: accepts numeric dates with 2–3 groups (`19/6`,
/// `2026-06-20`, `6/19/26`) and month-name dates (`Jun 19 2026`,
/// `19 June 2026`). Errs toward "yes" — the goal is to avoid false "not a date"
/// flags, not to fully validate the calendar.
fn looks_like_date(value: &str) -> bool {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return false;
    }

    let lower = trimmed.to_ascii_lowercase();
    const MONTHS: [&str; 12] = [
        "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
    ];
    let has_month = MONTHS.iter().any(|month| lower.contains(month));

    let digit_groups: Vec<&str> = trimmed
        .split(|c: char| !c.is_ascii_digit())
        .filter(|group| !group.is_empty())
        .collect();

    if has_month && !digit_groups.is_empty() {
        return true;
    }

    let has_separator = trimmed.contains('/') || trimmed.contains('-') || trimmed.contains('.');
    has_separator && (2..=3).contains(&digit_groups.len())
}

fn line_items_total(items: &[GemmaLineItem]) -> Option<f64> {
    let amounts: Vec<f64> = items
        .iter()
        .filter_map(|item| parse_amount(&value_to_plain_string(&item.amount)))
        .collect();
    if amounts.is_empty() {
        None
    } else {
        Some(amounts.iter().sum())
    }
}

fn value_to_plain_string(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        Value::Null => String::new(),
        Value::Bool(flag) => flag.to_string(),
        Value::Number(number) => number.to_string(),
        other => other.to_string(),
    }
}

/// Turn the model's structured output into a stored draft, assigning every
/// field a validator-backed confidence and collecting validator warnings.
fn build_validated_draft(
    job: &QueueJob,
    model: &str,
    raw_text: Option<String>,
    mut extraction: GemmaExtraction,
) -> ExtractionDraft {
    let returned_no_fields = extraction.fields.is_empty();
    let schema_placeholder_fields = fill_missing_schema_fields(&job.kind, &mut extraction.fields);

    let line_total = line_items_total(&extraction.line_items);
    let mut warnings = Vec::new();
    let mut fields = Vec::new();

    for raw in &extraction.fields {
        let value = value_to_plain_string(&raw.value);
        let outcome = validate_field(&raw.name, &value, line_total);
        if let Some(warning) = outcome.warning {
            if !schema_placeholder_fields
                .iter()
                .any(|name| name == &raw.name)
            {
                warnings.push(warning);
            }
        }
        fields.push(ExtractedField {
            name: raw.name.clone(),
            value: Value::String(value),
            confidence: outcome.confidence,
            source: None,
            needs_review: Some(outcome.needs_review),
        });
    }

    if returned_no_fields {
        warnings
            .push("The model returned no fields; this document needs manual review.".to_string());
    }

    let tables = build_line_item_table(&extraction.line_items);
    let confidence = average_confidence(&fields);

    // Prefer the model's Markdown transcription as the stored source text; fall
    // back to whatever raw_text the caller supplied.
    let transcript = extraction
        .markdown
        .take()
        .filter(|value| !value.trim().is_empty())
        .or(raw_text);

    ExtractionDraft {
        schema_id: schema_id_for_job(job).to_string(),
        target_type: target_type_for_job(job).to_string(),
        fields,
        tables,
        raw_text: transcript,
        summary: extraction
            .summary
            .filter(|value| !value.trim().is_empty())
            .or_else(|| Some(format!("{} extracted with {model}.", job.name))),
        confidence,
        runtime: "sidecar".to_string(),
        model: Some(model.to_string()),
        warnings,
    }
}

fn build_line_item_table(items: &[GemmaLineItem]) -> Vec<ExtractedTable> {
    if items.is_empty() {
        return Vec::new();
    }

    let rows = items
        .iter()
        .map(|item| {
            let mut row = serde_json::Map::new();
            row.insert(
                "description".to_string(),
                Value::String(value_to_plain_string(&item.description)),
            );
            row.insert(
                "quantity".to_string(),
                Value::String(value_to_plain_string(&item.quantity)),
            );
            row.insert(
                "amount".to_string(),
                Value::String(value_to_plain_string(&item.amount)),
            );
            row
        })
        .collect();

    // Confidence = fraction of rows whose amount parses as a number.
    let parsed = items
        .iter()
        .filter(|item| parse_amount(&value_to_plain_string(&item.amount)).is_some())
        .count();
    let confidence = (parsed as f32 / items.len() as f32).clamp(0.0, 1.0);

    vec![ExtractedTable {
        name: "lineItems".to_string(),
        columns: vec![
            "description".to_string(),
            "quantity".to_string(),
            "amount".to_string(),
        ],
        rows,
        confidence,
        source: None,
    }]
}

fn configured_gemma_model() -> String {
    std::env::var("MICROSERVICES_DESKTOP_GEMMA_MODEL")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_GEMMA_MODEL.to_string())
}

fn configured_keep_alive() -> String {
    std::env::var("MICROSERVICES_DESKTOP_KEEP_ALIVE")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| OLLAMA_KEEP_ALIVE.to_string())
}

fn configured_ocr_language() -> String {
    std::env::var("MICROSERVICES_DESKTOP_OCR_LANG")
        .ok()
        .map(|value| normalize_ocr_language(&value))
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_OCR_LANGUAGE.to_string())
}

fn configured_erp_import_url() -> String {
    std::env::var("MICROSERVICES_DESKTOP_IMPORT_URL")
        .ok()
        .and_then(|value| normalize_erp_import_url(&value).ok())
        .unwrap_or_else(|| "http://localhost:5173".to_string())
}

fn normalize_erp_import_url(value: &str) -> Result<String, String> {
    let trimmed = value.trim().trim_end_matches('/').to_string();
    if trimmed.is_empty() {
        return Err("Enter the ERP app URL before saving import settings.".to_string());
    }
    if trimmed.len() > 240 || !(trimmed.starts_with("https://") || trimmed.starts_with("http://")) {
        return Err("ERP app URL must start with http:// or https://.".to_string());
    }
    Ok(trimmed)
}

fn normalize_ocr_language(value: &str) -> String {
    value
        .trim()
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || *ch == '_' || *ch == '-')
        .take(24)
        .collect::<String>()
}

fn validate_model_name(model: &str) -> Result<(), String> {
    let trimmed = model.trim();
    if trimmed.is_empty() {
        return Err("Select a Gemma model before installing.".to_string());
    }

    if trimmed.len() > 96
        || !trimmed
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, ':' | '.' | '_' | '-'))
    {
        return Err(
            "Model names may only contain letters, numbers, colon, dot, dash, and underscore."
                .to_string(),
        );
    }

    Ok(())
}

fn ollama_installed() -> bool {
    Command::new("ollama")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok_and(|status| status.success())
}

fn ollama_model_available(model: &str) -> bool {
    ollama_local_models()
        .iter()
        .any(|name| name == model || name.starts_with(&format!("{model}:")))
}

fn ollama_local_models() -> Vec<String> {
    let Ok(response) = ollama_http("GET", "/api/tags", None, Duration::from_millis(700)) else {
        return Vec::new();
    };
    let Ok(json) = serde_json::from_str::<Value>(&response) else {
        return Vec::new();
    };

    let mut models = json
        .get("models")
        .and_then(Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(|entry| {
                    entry
                        .get("name")
                        .and_then(Value::as_str)
                        .map(str::to_string)
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    models.sort();
    models
}

fn probe_gemma_model(model: &str) -> Result<ModelProbeResult, String> {
    let mut warnings = Vec::new();
    if !ollama_installed() {
        warnings.push(
            "Ollama CLI is not on PATH; the local HTTP service may still be reachable.".to_string(),
        );
    }

    if !ollama_model_available(model) {
        return Err(format!(
            "Selected model {model} is not installed in Ollama. Install it before testing."
        ));
    }

    let started = Instant::now();
    let output = ollama_generate_probe(model)?;
    let elapsed = started.elapsed().as_millis();

    Ok(ModelProbeResult {
        model: model.to_string(),
        ready: true,
        latency_ms: if elapsed > u64::MAX as u128 {
            u64::MAX
        } else {
            elapsed as u64
        },
        output,
        warnings,
    })
}

fn ollama_generate_probe(model: &str) -> Result<String, String> {
    let body = json!({
        "model": model,
        "prompt": "Reply with exactly: ready",
        "stream": false,
        "options": {
            "temperature": 0,
            "num_predict": 8
        }
    });
    let response = ollama_http(
        "POST",
        "/api/generate",
        Some(&body.to_string()),
        Duration::from_secs(60),
    )?;
    let json = serde_json::from_str::<Value>(&response)
        .map_err(|error| format!("Ollama returned invalid JSON: {error}"))?;

    json.get("response")
        .and_then(Value::as_str)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Ollama test response did not include generated content.".to_string())
}

fn ollama_generate_with_images(
    model: &str,
    job: &QueueJob,
    images: &[String],
) -> Result<String, String> {
    if images.is_empty() {
        return Err(
            "No scanned page images were available for Gemma vision extraction.".to_string(),
        );
    }

    let total_b64: usize = images.iter().map(String::len).sum();
    llm_log(format!(
        "vision extract: model={model} pages={} image_b64={total_b64}B doc={}",
        images.len(),
        job.name
    ));

    let prompt = gemma_image_prompt(job);
    let body = json!({
        "model": model,
        "prompt": prompt,
        "images": images,
        "stream": false,
        "format": extraction_schema(&job.kind),
        "keep_alive": configured_keep_alive(),
        "options": { "temperature": 0 }
    });
    let started = Instant::now();
    let response = ollama_http(
        "POST",
        "/api/generate",
        Some(&body.to_string()),
        Duration::from_secs(120),
    )?;
    llm_log(format!(
        "vision extract: {} response bytes in {} ms",
        response.len(),
        started.elapsed().as_millis()
    ));

    let json = serde_json::from_str::<Value>(&response).map_err(|error| {
        let preview: String = response.chars().take(200).collect();
        format!("Ollama returned invalid JSON: {error} (body starts: {preview:?})")
    })?;

    json.get("response")
        .and_then(Value::as_str)
        .map(str::to_string)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Ollama response did not include generated content.".to_string())
}

fn gemma_image_prompt(job: &QueueJob) -> String {
    let def = document_schema_def(&job.kind);
    let field_list = def.fields.join(", ");
    let line_items_line = if def.line_items {
        " Also return `lineItems`: one {description, quantity, amount} object for every row in the document's table."
    } else {
        ""
    };

    format!(
        "Read the attached scanned business document image(s) — a {kind}. \
First, transcribe the ENTIRE document into `markdown`: a faithful, readable Markdown copy (headings, paragraphs, and any tables as Markdown tables), preserving the wording and order as printed. \
Then extract every value you can read. Fill each of these fields when it appears in the document: {field_list}. \
Copy values exactly as printed; use an empty string for any field that is absent, and do not invent values.{line_items_line} \
Also write a short `summary`.",
        kind = target_type_for_job(job),
        field_list = field_list,
        line_items_line = line_items_line,
    )
}

fn base64_encode(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut output = String::with_capacity(bytes.len().div_ceil(3) * 4);

    for chunk in bytes.chunks(3) {
        let b0 = chunk[0];
        let b1 = *chunk.get(1).unwrap_or(&0);
        let b2 = *chunk.get(2).unwrap_or(&0);

        output.push(TABLE[(b0 >> 2) as usize] as char);
        output.push(TABLE[(((b0 & 0b0000_0011) << 4) | (b1 >> 4)) as usize] as char);
        if chunk.len() > 1 {
            output.push(TABLE[(((b1 & 0b0000_1111) << 2) | (b2 >> 6)) as usize] as char);
        } else {
            output.push('=');
        }
        if chunk.len() > 2 {
            output.push(TABLE[(b2 & 0b0011_1111) as usize] as char);
        } else {
            output.push('=');
        }
    }

    output
}

/// Lightweight stderr logging for the local LLM path. Visible in `cargo run`,
/// the headless `extract` subcommand, and `tauri dev` consoles; a no-op cost in
/// a bundled release (stderr is just not surfaced).
fn llm_log(message: impl AsRef<str>) {
    eprintln!("[llm] {}", message.as_ref());
}

fn ollama_http(
    method: &str,
    path: &str,
    body: Option<&str>,
    timeout: Duration,
) -> Result<String, String> {
    let address = OLLAMA_HOST
        .to_socket_addrs()
        .map_err(|error| format!("Failed to resolve Ollama host: {error}"))?
        .next()
        .ok_or_else(|| "Failed to resolve Ollama host.".to_string())?;
    let mut stream = TcpStream::connect_timeout(&address, timeout)
        .map_err(|error| format!("Ollama is not reachable at http://{OLLAMA_HOST}: {error}"))?;
    stream
        .set_read_timeout(Some(timeout))
        .map_err(|error| format!("Failed to set Ollama read timeout: {error}"))?;
    stream
        .set_write_timeout(Some(timeout))
        .map_err(|error| format!("Failed to set Ollama write timeout: {error}"))?;

    let body = body.unwrap_or("");
    let request = format!(
        "{method} {path} HTTP/1.1\r\nHost: {OLLAMA_HOST}\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{body}",
        body.len()
    );
    llm_log(format!(
        "{method} {path} (request body {} bytes)",
        body.len()
    ));
    stream
        .write_all(request.as_bytes())
        .map_err(|error| format!("Failed to write Ollama request: {error}"))?;

    // Read raw bytes (not a UTF-8 String) so a chunked body's framing is decoded
    // byte-exactly before we ever try to treat it as text/JSON.
    let mut raw = Vec::new();
    stream
        .read_to_end(&mut raw)
        .map_err(|error| format!("Failed to read Ollama response: {error}"))?;

    let separator = b"\r\n\r\n";
    let split_at = raw
        .windows(separator.len())
        .position(|window| window == separator)
        .ok_or_else(|| "Ollama response was malformed (no header terminator).".to_string())?;
    let header_text = String::from_utf8_lossy(&raw[..split_at]);
    let body_bytes = &raw[split_at + separator.len()..];

    let status_line = header_text.lines().next().unwrap_or_default();
    // Ollama's /api/generate streams its body with Transfer-Encoding: chunked
    // even when stream=false, so the body is `<hex-size>\r\n<bytes>\r\n...0\r\n\r\n`.
    // Feeding that straight to serde_json fails at column 1 on the size prefix.
    let chunked = header_text.lines().any(|line| {
        let lower = line.to_ascii_lowercase();
        lower.starts_with("transfer-encoding:") && lower.contains("chunked")
    });
    llm_log(format!(
        "{path} -> {status_line} | {} | {} raw body bytes",
        if chunked { "chunked" } else { "content-length" },
        body_bytes.len()
    ));

    if !status_line.contains(" 200 ") {
        let preview: String = String::from_utf8_lossy(body_bytes)
            .chars()
            .take(300)
            .collect();
        return Err(format!("Ollama request failed: {status_line} — {preview}"));
    }

    let payload = if chunked {
        decode_chunked(body_bytes)?
    } else {
        body_bytes.to_vec()
    };
    Ok(String::from_utf8_lossy(&payload).into_owned())
}

/// Minimal HTTP/1.1 chunked transfer-encoding decoder: concatenate each
/// `<hex-size>\r\n<size bytes>\r\n` chunk until the terminating zero-size chunk.
fn decode_chunked(mut data: &[u8]) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    loop {
        let line_end = data
            .windows(2)
            .position(|window| window == b"\r\n")
            .ok_or_else(|| "Chunked response ended before a size line.".to_string())?;
        let size_field = String::from_utf8_lossy(&data[..line_end]);
        // A chunk size line may carry `;extensions`; only the hex size matters.
        let size_hex = size_field.split(';').next().unwrap_or("").trim();
        let size = usize::from_str_radix(size_hex, 16).map_err(|error| {
            format!("Chunked response had an invalid size '{size_hex}': {error}")
        })?;
        data = &data[line_end + 2..];
        if size == 0 {
            break;
        }
        if data.len() < size {
            return Err("Chunked response was truncated before a chunk completed.".to_string());
        }
        out.extend_from_slice(&data[..size]);
        data = &data[size..];
        if data.starts_with(b"\r\n") {
            data = &data[2..];
        }
    }
    Ok(out)
}

fn parse_json_object(text: &str) -> Result<Value, String> {
    let trimmed = text.trim();
    let json_text = if let Some(start) = trimmed.find("```json") {
        let after_marker = &trimmed[start + 7..];
        after_marker
            .split("```")
            .next()
            .unwrap_or(after_marker)
            .trim()
    } else if let Some(start) = trimmed.find("```") {
        let after_marker = &trimmed[start + 3..];
        after_marker
            .split("```")
            .next()
            .unwrap_or(after_marker)
            .trim()
    } else {
        trimmed
    };

    serde_json::from_str(json_text)
        .map_err(|error| format!("Failed to parse Gemma JSON draft: {error}"))
}

fn hash_file(path: &Path) -> Result<String, String> {
    let file =
        File::open(path).map_err(|error| format!("Failed to open {}: {error}", path.display()))?;
    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = [0; 64 * 1024];

    loop {
        let bytes_read = reader
            .read(&mut buffer)
            .map_err(|error| format!("Failed to read {}: {error}", path.display()))?;

        if bytes_read == 0 {
            break;
        }

        hasher.update(&buffer[..bytes_read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

fn now_unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default()
}

fn open_queue(app: &tauri::AppHandle) -> Result<DraftQueue, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;

    fs::create_dir_all(&data_dir).map_err(|error| {
        format!(
            "Failed to create app data directory {}: {error}",
            data_dir.display()
        )
    })?;

    DraftQueue::open(data_dir.join("drafts.sqlite3"))
}

struct DraftQueue {
    conn: Connection,
}

impl DraftQueue {
    fn open(path: PathBuf) -> Result<Self, String> {
        let conn = Connection::open(&path)
            .map_err(|error| format!("Failed to open draft queue {}: {error}", path.display()))?;

        conn.execute_batch(
            "
      CREATE TABLE IF NOT EXISTS draft_jobs (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_hash TEXT NOT NULL UNIQUE,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        confidence REAL NOT NULL,
        pages INTEGER NOT NULL,
        imported_at INTEGER NOT NULL,
        draft_json TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_draft_jobs_imported_at
        ON draft_jobs(imported_at DESC);
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS draft_edits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL,
        field_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        edited_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_draft_edits_job_id
        ON draft_edits(job_id, edited_at DESC);
      ",
        )
        .map_err(|error| format!("Failed to initialize draft queue: {error}"))?;

        ensure_column(&conn, "draft_json", "TEXT")?;

        Ok(Self { conn })
    }

    fn insert_job(&self, job: &QueueJob) -> Result<bool, String> {
        let changed = self
            .conn
            .execute(
                "
        INSERT OR IGNORE INTO draft_jobs
          (id, file_path, file_name, file_hash, kind, status, confidence, pages, imported_at, draft_json)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        ",
                params![
                    job.id,
                    job.path,
                    job.name,
                    job.file_hash,
                    job.kind,
                    job.status,
                    job.confidence,
                    job.pages,
                    job.imported_at,
                    serialize_draft(&job.draft)?
                ],
            )
            .map_err(|error| format!("Failed to insert draft job: {error}"))?;

        Ok(changed == 1)
    }

    fn list_jobs(&self) -> Result<Vec<QueueJob>, String> {
        let mut statement = self
            .conn
            .prepare(
                "
        SELECT id, file_name, kind, status, confidence, pages, file_hash, file_path, imported_at, draft_json
        FROM draft_jobs
        ORDER BY imported_at DESC, file_name ASC
        ",
            )
            .map_err(|error| format!("Failed to prepare draft queue query: {error}"))?;

        let rows = statement
            .query_map([], row_to_job)
            .map_err(|error| format!("Failed to read draft queue: {error}"))?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("Failed to decode draft queue: {error}"))
    }

    fn get_job(&self, job_id: &str) -> Result<Option<QueueJob>, String> {
        let mut statement = self
            .conn
            .prepare(
                "
        SELECT id, file_name, kind, status, confidence, pages, file_hash, file_path, imported_at, draft_json
        FROM draft_jobs
        WHERE id = ?1
        ",
            )
            .map_err(|error| format!("Failed to prepare draft lookup: {error}"))?;

        let mut rows = statement
            .query_map(params![job_id], row_to_job)
            .map_err(|error| format!("Failed to query draft job: {error}"))?;

        rows.next()
            .transpose()
            .map_err(|error| format!("Failed to decode draft job: {error}"))
    }

    fn update_status(&self, job_id: &str, status: &str, confidence: f32) -> Result<(), String> {
        self.conn
            .execute(
                "UPDATE draft_jobs SET status = ?1, confidence = ?2 WHERE id = ?3",
                params![status, confidence, job_id],
            )
            .map_err(|error| format!("Failed to update draft job status: {error}"))?;
        Ok(())
    }

    fn update_extraction(
        &self,
        job_id: &str,
        status: &str,
        confidence: f32,
        draft: &ExtractionDraft,
    ) -> Result<QueueJob, String> {
        let changed = self
            .conn
            .execute(
                "
        UPDATE draft_jobs
        SET status = ?1, confidence = ?2, draft_json = ?3
        WHERE id = ?4
        ",
                params![
                    status,
                    confidence,
                    serde_json::to_string(draft)
                        .map_err(|error| format!("Failed to encode extraction draft: {error}"))?,
                    job_id
                ],
            )
            .map_err(|error| format!("Failed to save extraction draft: {error}"))?;

        if changed == 0 {
            return Err(format!("Draft job not found: {job_id}"));
        }

        self.get_job(job_id)?
            .ok_or_else(|| format!("Draft job not found after update: {job_id}"))
    }

    /// Apply an operator correction to a single extracted field. Edits are
    /// audited and the corrected field is no longer flagged for review.
    fn update_field(
        &self,
        job_id: &str,
        field_name: &str,
        value: &str,
    ) -> Result<QueueJob, String> {
        let job = self
            .get_job(job_id)?
            .ok_or_else(|| format!("Draft job not found: {job_id}"))?;
        let mut draft = job
            .draft
            .clone()
            .ok_or_else(|| format!("Draft job has no extraction draft to edit: {job_id}"))?;

        let field = draft
            .fields
            .iter_mut()
            .find(|field| field.name == field_name)
            .ok_or_else(|| format!("Field not found on extraction draft: {field_name}"))?;
        let old_value = value_to_text(&field.value);
        field.value = Value::String(value.to_string());
        field.needs_review = Some(false);

        self.record_edit(job_id, field_name, old_value.as_deref(), Some(value))?;
        self.update_extraction(job_id, &job.status, job.confidence, &draft)
    }

    /// Approve a reviewed draft so only operator-approved records can be
    /// submitted to the ERP Worker. Approval is audited.
    fn approve(&self, job_id: &str) -> Result<QueueJob, String> {
        let job = self
            .get_job(job_id)?
            .ok_or_else(|| format!("Draft job not found: {job_id}"))?;
        if job.draft.is_none() {
            return Err(format!(
                "Cannot approve a job without an extraction draft: {job_id}"
            ));
        }

        self.record_edit(job_id, "*status", Some(&job.status), Some("approved"))?;
        self.update_status(job_id, "approved", job.confidence)?;
        self.get_job(job_id)?
            .ok_or_else(|| format!("Draft job not found after approve: {job_id}"))
    }

    /// Reject a draft with an audited reason. Rejected drafts never import.
    fn reject(&self, job_id: &str, reason: &str) -> Result<QueueJob, String> {
        let job = self
            .get_job(job_id)?
            .ok_or_else(|| format!("Draft job not found: {job_id}"))?;

        let reason = reason.trim();
        let audited_reason = if reason.is_empty() {
            "rejected"
        } else {
            reason
        };
        self.record_edit(job_id, "*status", Some(&job.status), Some(audited_reason))?;
        self.update_status(job_id, "rejected", job.confidence)?;
        self.get_job(job_id)?
            .ok_or_else(|| format!("Draft job not found after reject: {job_id}"))
    }

    fn record_edit(
        &self,
        job_id: &str,
        field_name: &str,
        old_value: Option<&str>,
        new_value: Option<&str>,
    ) -> Result<(), String> {
        self.conn
            .execute(
                "
        INSERT INTO draft_edits (job_id, field_name, old_value, new_value, edited_at)
        VALUES (?1, ?2, ?3, ?4, ?5)
        ",
                params![job_id, field_name, old_value, new_value, now_unix_seconds()],
            )
            .map_err(|error| format!("Failed to record draft edit: {error}"))?;
        Ok(())
    }

    // Used by tests today; kept for the upcoming audit-trail view (M4 import).
    #[allow(dead_code)]
    #[cfg(test)]
    fn edit_count(&self, job_id: &str) -> Result<u32, String> {
        self.conn
            .query_row(
                "SELECT COUNT(*) FROM draft_edits WHERE job_id = ?1",
                params![job_id],
                |row| row.get::<_, u32>(0),
            )
            .map_err(|error| format!("Failed to count draft edits: {error}"))
    }

    #[cfg(test)]
    fn pending_count(&self) -> Result<u32, String> {
        self.conn
            .query_row(
                "SELECT COUNT(*) FROM draft_jobs WHERE status NOT IN ('synced', 'rejected')",
                [],
                |row| row.get::<_, u32>(0),
            )
            .map_err(|error| format!("Failed to count pending drafts: {error}"))
    }

    fn approved_count(&self) -> Result<u32, String> {
        self.conn
            .query_row(
                "SELECT COUNT(*) FROM draft_jobs WHERE status = 'approved'",
                [],
                |row| row.get::<_, u32>(0),
            )
            .map_err(|error| format!("Failed to count approved drafts: {error}"))
    }

    fn imported_count(&self) -> Result<u32, String> {
        self.conn
            .query_row(
                "SELECT COUNT(*) FROM draft_jobs WHERE status = 'synced'",
                [],
                |row| row.get::<_, u32>(0),
            )
            .map_err(|error| format!("Failed to count imported drafts: {error}"))
    }

    fn erp_import_settings(&self) -> Result<ErpImportSettings, String> {
        let base_url = self
            .setting("erp_import_base_url")?
            .unwrap_or_else(configured_erp_import_url);
        let token = self
            .setting("erp_import_token")?
            .or_else(|| std::env::var("MICROSERVICES_DESKTOP_IMPORT_TOKEN").ok())
            .unwrap_or_default();

        Ok(ErpImportSettings {
            base_url,
            token_configured: !token.trim().is_empty(),
        })
    }

    fn save_erp_import_settings(&self, base_url: &str, token: &str) -> Result<(), String> {
        let normalized_base_url = normalize_erp_import_url(base_url)?;
        self.set_setting("erp_import_base_url", &normalized_base_url)?;

        let trimmed_token = token.trim();
        if !trimmed_token.is_empty() {
            self.set_setting("erp_import_token", trimmed_token)?;
        }

        Ok(())
    }

    fn erp_import_transport(&self) -> Result<ErpImportTransport, String> {
        let settings = self.erp_import_settings()?;
        let token = self
            .setting("erp_import_token")?
            .or_else(|| std::env::var("MICROSERVICES_DESKTOP_IMPORT_TOKEN").ok())
            .unwrap_or_default();

        if settings.base_url.trim().is_empty() {
            return Err("Configure the ERP app URL before importing approved drafts.".to_string());
        }
        if token.trim().is_empty() {
            return Err(
                "Configure the desktop import token before importing approved drafts.".to_string(),
            );
        }

        Ok(ErpImportTransport {
            base_url: settings.base_url,
            token,
        })
    }

    fn mark_imported(&self, job_id: &str) -> Result<QueueJob, String> {
        let job = self
            .get_job(job_id)?
            .ok_or_else(|| format!("Draft job not found: {job_id}"))?;
        if job.status == "synced" {
            return Ok(job);
        }
        if job.status != "approved" {
            return Err(format!(
                "Only approved drafts can be marked imported: {job_id}"
            ));
        }

        self.record_edit(job_id, "*status", Some(&job.status), Some("synced"))?;
        self.update_status(job_id, "synced", job.confidence)?;
        self.get_job(job_id)?
            .ok_or_else(|| format!("Draft job not found after import: {job_id}"))
    }

    fn runtime_settings(&self) -> Result<RuntimeSettings, String> {
        let gemma_model = self
            .setting("gemma_model")?
            .unwrap_or_else(configured_gemma_model);
        let ocr_language = self
            .setting("ocr_language")?
            .unwrap_or_else(configured_ocr_language);
        let installed_models = ollama_local_models();

        Ok(RuntimeSettings {
            selected_model_installed: installed_models.iter().any(|model| {
                model == &gemma_model || model.starts_with(&format!("{gemma_model}:"))
            }),
            gemma_model,
            ocr_language,
            suggested_models: SUGGESTED_GEMMA_MODELS
                .iter()
                .map(|model| (*model).to_string())
                .collect(),
            installed_models,
            ollama_installed: ollama_installed(),
        })
    }

    fn save_runtime_settings(&self, gemma_model: &str, ocr_language: &str) -> Result<(), String> {
        validate_model_name(gemma_model)?;
        let normalized_language = normalize_ocr_language(ocr_language);
        if normalized_language.is_empty() {
            return Err("Select an OCR language before saving settings.".to_string());
        }

        self.set_setting("gemma_model", gemma_model.trim())?;
        self.set_setting("ocr_language", &normalized_language)?;
        Ok(())
    }

    fn setting(&self, key: &str) -> Result<Option<String>, String> {
        let mut statement = self
            .conn
            .prepare("SELECT value FROM app_settings WHERE key = ?1")
            .map_err(|error| format!("Failed to prepare settings lookup: {error}"))?;
        let mut rows = statement
            .query_map(params![key], |row| row.get::<_, String>(0))
            .map_err(|error| format!("Failed to query settings: {error}"))?;

        rows.next()
            .transpose()
            .map_err(|error| format!("Failed to decode settings: {error}"))
    }

    fn set_setting(&self, key: &str, value: &str) -> Result<(), String> {
        self.conn
            .execute(
                "
        INSERT INTO app_settings (key, value)
        VALUES (?1, ?2)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        ",
                params![key, value],
            )
            .map_err(|error| format!("Failed to save settings: {error}"))?;
        Ok(())
    }
}

fn ensure_column(conn: &Connection, name: &str, definition: &str) -> Result<(), String> {
    let mut statement = conn
        .prepare("PRAGMA table_info(draft_jobs)")
        .map_err(|error| format!("Failed to inspect draft queue schema: {error}"))?;
    let columns = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| format!("Failed to read draft queue schema: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to decode draft queue schema: {error}"))?;

    if !columns.iter().any(|column| column == name) {
        conn.execute(
            &format!("ALTER TABLE draft_jobs ADD COLUMN {name} {definition}"),
            [],
        )
        .map_err(|error| format!("Failed to migrate draft queue schema: {error}"))?;
    }

    Ok(())
}

fn row_to_job(row: &rusqlite::Row<'_>) -> rusqlite::Result<QueueJob> {
    let draft_json: Option<String> = row.get(9)?;
    Ok(QueueJob {
        id: row.get(0)?,
        name: row.get(1)?,
        kind: row.get(2)?,
        status: row.get(3)?,
        confidence: row.get(4)?,
        pages: row.get(5)?,
        file_hash: row.get(6)?,
        path: row.get(7)?,
        imported_at: row.get(8)?,
        draft: draft_json.and_then(|value| serde_json::from_str::<ExtractionDraft>(&value).ok()),
    })
}

fn value_to_text(value: &Value) -> Option<String> {
    match value {
        Value::Null => None,
        Value::String(text) => Some(text.clone()),
        other => Some(other.to_string()),
    }
}

fn serialize_draft(draft: &Option<ExtractionDraft>) -> Result<Option<String>, String> {
    draft
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(|error| format!("Failed to encode extraction draft: {error}"))
}

fn sample_documents() -> Vec<QueueJob> {
    vec![
        QueueJob {
            id: "job_101".to_string(),
            name: "vendor-invoice-0426.pdf".to_string(),
            kind: "invoice".to_string(),
            status: "review".to_string(),
            confidence: 0.91,
            pages: 2,
            file_hash: "sample_invoice".to_string(),
            path: "~/Documents/client-imports/vendor-invoice-0426.pdf".to_string(),
            imported_at: 0,
            draft: Some(sample_draft(
                "vendor-invoice-0426.pdf",
                "invoice",
                "erp.invoice.default",
                0.91,
            )),
        },
        QueueJob {
            id: "job_102".to_string(),
            name: "new-client-intake.jpg".to_string(),
            kind: "intake".to_string(),
            status: "ready".to_string(),
            confidence: 0.84,
            pages: 1,
            file_hash: "sample_intake".to_string(),
            path: "~/Documents/client-imports/new-client-intake.jpg".to_string(),
            imported_at: 0,
            draft: None,
        },
        QueueJob {
            id: "job_103".to_string(),
            name: "repair-receipt.png".to_string(),
            kind: "support".to_string(),
            status: "extracting".to_string(),
            confidence: 0.72,
            pages: 1,
            file_hash: "sample_repair".to_string(),
            path: "~/Documents/client-imports/repair-receipt.png".to_string(),
            imported_at: 0,
            draft: None,
        },
        QueueJob {
            id: "job_104".to_string(),
            name: "deposit-statement.pdf".to_string(),
            kind: "invoice".to_string(),
            status: "synced".to_string(),
            confidence: 0.96,
            pages: 3,
            file_hash: "sample_statement".to_string(),
            path: "~/Documents/client-imports/deposit-statement.pdf".to_string(),
            imported_at: 0,
            draft: Some(sample_draft(
                "deposit-statement.pdf",
                "invoice",
                "erp.invoice.default",
                0.96,
            )),
        },
    ]
}

fn sample_draft(
    name: &str,
    target_type: &str,
    schema_id: &str,
    confidence: f32,
) -> ExtractionDraft {
    ExtractionDraft {
        schema_id: schema_id.to_string(),
        target_type: target_type.to_string(),
        fields: vec![
            text_field("documentTitle", name.to_string(), confidence, Some(name)),
            text_field(
                "total",
                "$1,240.00".to_string(),
                confidence,
                Some("Total $1,240.00"),
            ),
        ],
        tables: Vec::new(),
        raw_text: Some(format!("{name}\nTotal $1,240.00")),
        summary: Some("Sample local extraction draft for browser preview.".to_string()),
        confidence,
        runtime: "sidecar".to_string(),
        model: Some(DEFAULT_GEMMA_MODEL.to_string()),
        warnings: Vec::new(),
    }
}

/// Run the Gemma vision extraction pipeline for a single document without
/// launching the Tauri GUI. This is the core of the headless `extract`
/// subcommand and the `--ignored` integration test, so the same code path the
/// desktop app uses can be exercised on a machine that has no display server.
fn extract_path_headless(path: &Path, model: &str) -> Result<ExtractionDraft, String> {
    let hash = hash_file(path)?;
    let job = build_job(path, hash)?;
    llm_log(format!(
        "headless extract: {} (kind={}, model={model})",
        path.display(),
        job.kind
    ));
    match normalize_with_gemma_images(&job, path, model)? {
        Some(draft) => {
            llm_log(format!(
                "headless extract: produced {} field(s), confidence {:.2}",
                draft.fields.len(),
                draft.confidence
            ));
            Ok(draft)
        }
        None => Err(format!(
            "Gemma model '{model}' is not available. Start Ollama and run `ollama pull {model}` before extracting."
        )),
    }
}

/// Headless `extract` subcommand: `erp-shell-desktop extract <file> [--model <tag>]`.
/// Prints the extraction draft as JSON to stdout. Returns the process exit code.
fn run_extract_cli(args: &[String]) -> i32 {
    let mut path: Option<&str> = None;
    let mut model: Option<String> = None;
    let mut index = 0;
    while index < args.len() {
        match args[index].as_str() {
            "--model" => {
                index += 1;
                match args.get(index) {
                    Some(value) => model = Some(value.clone()),
                    None => {
                        eprintln!("--model requires a model tag, e.g. --model gemma4:e4b");
                        return 2;
                    }
                }
            }
            "-h" | "--help" => {
                println!(
                    "Usage: erp-shell-desktop extract <document> [--model <ollama-tag>]\n\
                     Reads a scanned image or PDF with the local Gemma vision model and prints the draft JSON.\n\
                     Requires Ollama running with the selected model installed (and poppler for PDFs)."
                );
                return 0;
            }
            other if other.starts_with('-') => {
                eprintln!("Unknown flag: {other}");
                return 2;
            }
            other => {
                if path.is_none() {
                    path = Some(other);
                } else {
                    eprintln!("Unexpected extra argument: {other}");
                    return 2;
                }
            }
        }
        index += 1;
    }

    let Some(path) = path else {
        eprintln!("Usage: erp-shell-desktop extract <document> [--model <ollama-tag>]");
        return 2;
    };

    let model = model.unwrap_or_else(configured_gemma_model);
    match extract_path_headless(Path::new(path), &model) {
        Ok(draft) => match serde_json::to_string_pretty(&draft) {
            Ok(json) => {
                println!("{json}");
                0
            }
            Err(error) => {
                eprintln!("Failed to serialize extraction draft: {error}");
                1
            }
        },
        Err(error) => {
            eprintln!("Extraction failed: {error}");
            1
        }
    }
}

fn main() {
    // Headless mode: `erp-shell-desktop extract <file>` runs the Gemma vision
    // pipeline and exits without starting Tauri (no display server needed).
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) == Some("extract") {
        std::process::exit(run_extract_cli(&args[2..]));
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            runtime_status,
            import_status,
            sync_status,
            erp_import_settings,
            save_erp_import_settings,
            select_import_folder,
            select_import_files,
            import_folder_path,
            import_document_paths,
            queue_documents,
            runtime_settings,
            save_runtime_settings,
            install_gemma_model,
            test_gemma_model,
            extract_document,
            document_draft,
            document_preview,
            enqueue_sample_documents,
            update_draft_field,
            approve_job,
            reject_job,
            desktop_import_request,
            mark_job_imported
        ])
        .run(tauri::generate_context!())
        .expect("failed to run ERP Shell Desktop");
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn collect_documents_accepts_folders_files_and_rejects_unsupported_paths() {
        let workspace = tempdir().expect("temp workspace");
        let root = workspace.path();
        let nested = root.join("nested");
        fs::create_dir_all(&nested).expect("nested folder");

        let invoice = root.join("vendor-invoice.pdf");
        let receipt = nested.join("repair-receipt.JPG");
        let note = root.join("notes.txt");

        fs::write(&invoice, b"invoice").expect("invoice fixture");
        fs::write(&receipt, b"receipt").expect("receipt fixture");
        fs::write(&note, b"notes").expect("note fixture");

        let selection = collect_documents_from_paths(&[
            root.to_path_buf(),
            note.clone(),
            root.join("missing.pdf"),
        ])
        .expect("document selection");

        let mut expected_documents = vec![invoice, receipt];
        expected_documents.sort();

        assert_eq!(selection.documents, expected_documents);
        assert_eq!(selection.skipped_documents, 2);
        assert_eq!(selection.source_label, "3 dropped items");
    }

    #[test]
    fn draft_queue_dedupes_by_file_hash() {
        let workspace = tempdir().expect("temp workspace");
        let file_path = workspace.path().join("vendor-invoice.pdf");
        fs::write(&file_path, b"same invoice bytes").expect("invoice fixture");

        let queue = DraftQueue::open(workspace.path().join("drafts.sqlite3")).expect("draft queue");
        let job = build_job(&file_path, hash_file(&file_path).expect("hash")).expect("queue job");

        assert!(queue.insert_job(&job).expect("first insert"));
        assert!(!queue.insert_job(&job).expect("duplicate insert"));
        assert_eq!(queue.pending_count().expect("pending count"), 1);

        let jobs = queue.list_jobs().expect("queued jobs");
        assert_eq!(jobs.len(), 1);
        assert_eq!(jobs[0].file_hash, job.file_hash);
    }

    #[test]
    fn heuristic_invoice_draft_extracts_reviewable_fields() {
        let workspace = tempdir().expect("temp workspace");
        let file_path = workspace.path().join("vendor-invoice.png");
        fs::write(&file_path, b"fake image bytes").expect("image fixture");
        let job = build_job(&file_path, "abc1234567890def".to_string()).expect("queue job");
        let raw_text = "Acme Supplies\nInvoice #: INV-42\nDate: 2026-06-20\nTotal $123.45";

        let draft = normalize_document_draft(&job, raw_text, Vec::new());
        let field_names = draft
            .fields
            .iter()
            .map(|field| field.name.as_str())
            .collect::<Vec<_>>();

        assert_eq!(draft.target_type, "invoice");
        assert_eq!(draft.schema_id, "erp.invoice.default");
        assert!(field_names.contains(&"documentTitle"));
        assert!(field_names.contains(&"documentNumber"));
        assert!(field_names.contains(&"date"));
        assert!(field_names.contains(&"total"));
        assert!(draft.confidence > 0.6);
        assert_eq!(draft.raw_text.as_deref(), Some(raw_text));
    }

    #[test]
    fn draft_queue_persists_extraction_draft() {
        let workspace = tempdir().expect("temp workspace");
        let file_path = workspace.path().join("repair-receipt.png");
        fs::write(&file_path, b"same receipt bytes").expect("receipt fixture");

        let queue = DraftQueue::open(workspace.path().join("drafts.sqlite3")).expect("draft queue");
        let job = build_job(&file_path, hash_file(&file_path).expect("hash")).expect("queue job");
        assert!(queue.insert_job(&job).expect("insert"));

        let draft = normalize_document_draft(
            &job,
            "Repair Shop\nReceipt # RS-9\nTotal $88.00",
            vec!["sample warning".to_string()],
        );
        let saved = queue
            .update_extraction(&job.id, "review", draft.confidence, &draft)
            .expect("draft saved");

        assert_eq!(saved.status, "review");
        assert!(saved.draft.is_some());
        assert_eq!(
            saved
                .draft
                .as_ref()
                .and_then(|draft| draft.raw_text.as_deref()),
            Some("Repair Shop\nReceipt # RS-9\nTotal $88.00")
        );

        let reopened =
            DraftQueue::open(workspace.path().join("drafts.sqlite3")).expect("reopen queue");
        let persisted = reopened
            .get_job(&job.id)
            .expect("persisted job")
            .expect("job");
        assert_eq!(
            persisted.draft.expect("draft").warnings,
            vec!["sample warning"]
        );
    }

    #[test]
    fn runtime_settings_persist_selected_model_and_ocr_language() {
        let workspace = tempdir().expect("temp workspace");
        let queue = DraftQueue::open(workspace.path().join("drafts.sqlite3")).expect("draft queue");

        queue
            .save_runtime_settings("gemma4:12b", "eng")
            .expect("settings saved");

        let reopened =
            DraftQueue::open(workspace.path().join("drafts.sqlite3")).expect("reopen queue");
        let settings = reopened.runtime_settings().expect("runtime settings");

        assert_eq!(settings.gemma_model, "gemma4:12b");
        assert_eq!(settings.ocr_language, "eng");
        assert!(settings
            .suggested_models
            .contains(&"gemma4:e4b".to_string()));
    }

    #[test]
    fn runtime_settings_rejects_unsafe_model_names() {
        let workspace = tempdir().expect("temp workspace");
        let queue = DraftQueue::open(workspace.path().join("drafts.sqlite3")).expect("draft queue");

        let error = queue
            .save_runtime_settings("gemma4:e4b;rm", "eng")
            .expect_err("unsafe model rejected");

        assert!(error.contains("Model names may only contain"));
    }

    fn seed_review_job(queue: &DraftQueue, name: &str) -> QueueJob {
        let job = build_job(Path::new(name), format!("{name:0>16}")).expect("queue job");
        assert!(queue.insert_job(&job).expect("insert"));
        let draft = normalize_document_draft(
            &job,
            "Acme Supplies\nInvoice #: INV-7\nTotal $100.00",
            Vec::new(),
        );
        queue
            .update_extraction(&job.id, "review", draft.confidence, &draft)
            .expect("review draft")
    }

    #[test]
    fn update_field_records_edit_and_clears_review() {
        let workspace = tempdir().expect("temp workspace");
        let path = workspace.path().join("drafts.sqlite3");
        let queue = DraftQueue::open(path.clone()).expect("draft queue");
        let job = seed_review_job(&queue, "vendor-invoice.png");

        let updated = queue
            .update_field(&job.id, "total", "$100.00")
            .expect("field updated");

        let field = updated
            .draft
            .as_ref()
            .expect("draft")
            .fields
            .iter()
            .find(|field| field.name == "total")
            .expect("total field");
        assert_eq!(field.value, Value::String("$100.00".to_string()));
        assert_eq!(field.needs_review, Some(false));
        assert_eq!(updated.status, "review");
        assert_eq!(queue.edit_count(&job.id).expect("edit count"), 1);

        let reopened = DraftQueue::open(path).expect("reopen queue");
        let persisted = reopened.get_job(&job.id).expect("persisted").expect("job");
        let persisted_total = persisted
            .draft
            .expect("draft")
            .fields
            .into_iter()
            .find(|field| field.name == "total")
            .expect("total field");
        assert_eq!(persisted_total.value, Value::String("$100.00".to_string()));
    }

    #[test]
    fn approve_requires_draft_and_marks_status() {
        let workspace = tempdir().expect("temp workspace");
        let queue = DraftQueue::open(workspace.path().join("drafts.sqlite3")).expect("draft queue");

        let bare = build_job(
            Path::new("intake-form.png"),
            "barejob0000000000".to_string(),
        )
        .expect("queue job");
        assert!(queue.insert_job(&bare).expect("insert"));
        assert!(queue.approve(&bare.id).is_err());

        let job = seed_review_job(&queue, "deposit-statement.png");
        let approved = queue.approve(&job.id).expect("approved");
        assert_eq!(approved.status, "approved");
        assert_eq!(queue.edit_count(&job.id).expect("edit count"), 1);
    }

    #[test]
    fn import_settings_and_mark_imported_keep_local_state_draft_only() {
        let workspace = tempdir().expect("temp workspace");
        let queue = DraftQueue::open(workspace.path().join("drafts.sqlite3")).expect("draft queue");
        let job = seed_review_job(&queue, "approved-invoice.png");

        queue
            .save_erp_import_settings("http://localhost:5173/", "dev-token")
            .expect("import settings saved");
        let settings = queue.erp_import_settings().expect("import settings");
        assert_eq!(settings.base_url, "http://localhost:5173");
        assert!(settings.token_configured);

        assert!(queue.mark_imported(&job.id).is_err());
        let approved = queue.approve(&job.id).expect("approved");
        assert_eq!(approved.status, "approved");
        assert_eq!(queue.approved_count().expect("approved count"), 1);

        let imported = queue.mark_imported(&job.id).expect("imported");
        assert_eq!(imported.status, "synced");
        assert_eq!(queue.approved_count().expect("approved count"), 0);
        assert_eq!(queue.imported_count().expect("imported count"), 1);
    }

    #[test]
    fn reject_excludes_job_from_pending() {
        let workspace = tempdir().expect("temp workspace");
        let queue = DraftQueue::open(workspace.path().join("drafts.sqlite3")).expect("draft queue");
        let job = seed_review_job(&queue, "repair-receipt.png");

        assert_eq!(queue.pending_count().expect("pending"), 1);
        let rejected = queue.reject(&job.id, "duplicate scan").expect("rejected");
        assert_eq!(rejected.status, "rejected");
        assert_eq!(queue.pending_count().expect("pending"), 0);
    }

    #[test]
    fn document_image_pages_rejects_unsupported_type() {
        let workspace = tempdir().expect("temp workspace");
        let path = workspace.path().join("notes.txt");
        fs::write(&path, b"plain text").expect("note fixture");

        let error = document_image_pages(&path).expect_err("unsupported type rejected");
        assert!(error.contains("not a supported document type"));
    }

    #[test]
    fn decode_chunked_reassembles_streamed_body() {
        // Ollama's /api/generate returns its JSON body chunked even with
        // stream=false; the decoder must drop the size lines and concatenate
        // the data across multiple chunks.
        let raw = b"f\r\n{\"response\":\"he\r\nb\r\nllo world\"}\r\n0\r\n\r\n";
        let decoded = decode_chunked(raw).expect("decode chunked body");
        assert_eq!(
            String::from_utf8(decoded).expect("utf8"),
            "{\"response\":\"hello world\"}"
        );
    }

    #[test]
    fn decode_chunked_handles_single_chunk() {
        let raw = b"5\r\nhello\r\n0\r\n\r\n";
        assert_eq!(
            String::from_utf8(decode_chunked(raw).expect("decode")).expect("utf8"),
            "hello"
        );
    }

    #[test]
    fn downscale_caps_oversized_image_dimensions() {
        let big = image::RgbImage::from_pixel(3000, 2000, image::Rgb([240, 240, 240]));
        let mut png = Vec::new();
        image::DynamicImage::ImageRgb8(big)
            .write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
            .expect("encode png fixture");

        let scaled = downscale_for_vision(&png);
        let decoded = image::load_from_memory(&scaled).expect("downscaled output decodes");
        assert_eq!(decoded.width(), MAX_VISION_EDGE);
        assert!(decoded.height() <= MAX_VISION_EDGE);
    }

    #[test]
    fn parse_amount_handles_printed_money() {
        assert_eq!(parse_amount("$1,240.00"), Some(1240.0));
        assert_eq!(parse_amount("1200"), Some(1200.0));
        assert_eq!(parse_amount("n/a"), None);
        assert_eq!(parse_amount(""), None);
    }

    #[test]
    fn looks_like_date_accepts_common_formats() {
        assert!(looks_like_date("2026-06-20"));
        assert!(looks_like_date("06/20/2026"));
        assert!(looks_like_date("19/6"), "partial day/month dates are valid");
        assert!(looks_like_date("Jun 19 2026"), "month-name dates are valid");
        assert!(looks_like_date("19 June 2026"));
        assert!(!looks_like_date("2026"), "a bare year is not a date");
        assert!(!looks_like_date("hello"));
    }

    #[test]
    fn validate_field_uses_deterministic_checks() {
        let ok = validate_field("total", "$100.00", Some(100.0));
        assert!(ok.confidence > 0.9 && !ok.needs_review && ok.warning.is_none());

        let mismatch = validate_field("total", "$120.00", Some(100.0));
        assert!(mismatch.needs_review && mismatch.warning.is_some());

        let empty = validate_field("vendor", "   ", None);
        assert_eq!(empty.confidence, 0.0);
        assert!(empty.needs_review);

        // An unparseable date is flagged for review but NOT claimed invalid.
        let unclear_date = validate_field("date", "sometime", None);
        assert!(unclear_date.needs_review && unclear_date.warning.is_none());

        // A plausible partial date passes cleanly (regression for '19/6').
        let partial_date = validate_field("date", "19/6", None);
        assert!(!partial_date.needs_review && partial_date.warning.is_none());
    }

    #[test]
    fn build_validated_draft_reconciles_total_and_builds_table() {
        let job = build_job(
            Path::new("vendor-invoice.png"),
            "abc1234567890def".to_string(),
        )
        .expect("job");
        let extraction = GemmaExtraction {
            fields: vec![
                GemmaField {
                    name: "date".to_string(),
                    value: Value::String("2026-06-20".to_string()),
                },
                GemmaField {
                    name: "total".to_string(),
                    value: Value::String("$30.00".to_string()),
                },
            ],
            line_items: vec![
                GemmaLineItem {
                    description: Value::String("Item A".to_string()),
                    quantity: Value::String("1".to_string()),
                    amount: Value::String("$10.00".to_string()),
                },
                GemmaLineItem {
                    description: Value::String("Item B".to_string()),
                    quantity: Value::String("2".to_string()),
                    amount: Value::String("$20.00".to_string()),
                },
            ],
            summary: Some("Invoice".to_string()),
            markdown: Some("# Invoice\n\nTotal: $30.00".to_string()),
        };

        let draft = build_validated_draft(&job, "gemma4:e4b", None, extraction);

        let total = draft
            .fields
            .iter()
            .find(|field| field.name == "total")
            .expect("total field");
        assert!(
            total.confidence > 0.95,
            "reconciled total should be high confidence"
        );
        assert_eq!(total.needs_review, Some(false));
        assert_eq!(draft.tables.len(), 1);
        assert_eq!(draft.tables[0].rows.len(), 2);
        assert_eq!(
            draft.raw_text.as_deref(),
            Some("# Invoice\n\nTotal: $30.00"),
            "the Markdown transcript becomes the draft's source text"
        );
        assert!(
            draft.warnings.is_empty(),
            "a clean invoice should produce no validator warnings, got: {:?}",
            draft.warnings
        );
    }

    #[test]
    fn extraction_pulls_markdown_out_of_fields() {
        let value = json!({
            "total": "$30.00",
            "markdown": "# Invoice\n\n| Item | Amt |\n|---|---|\n| A | $30 |",
            "summary": "Invoice"
        });
        let extraction = extraction_from_object(value).expect("named response parses");
        assert_eq!(
            extraction.fields.len(),
            1,
            "markdown + summary are not fields"
        );
        assert!(extraction
            .markdown
            .as_deref()
            .expect("markdown present")
            .contains("# Invoice"));
    }

    #[test]
    fn extraction_from_object_reads_named_fields_and_line_items() {
        let value = json!({
            "documentNumber": "INV-42",
            "total": "$30.00",
            "markdown": "# Invoice\n\nTotal: $30.00",
            "lineItems": [
                { "description": "A", "quantity": "1", "amount": "$10.00" },
                { "description": "B", "quantity": "2", "amount": "$20.00" }
            ],
            "summary": "Invoice"
        });

        let extraction = extraction_from_object(value).expect("named response parses");
        assert_eq!(
            extraction.fields.len(),
            2,
            "summary + lineItems are not fields"
        );
        assert_eq!(extraction.line_items.len(), 2);
        assert_eq!(extraction.summary.as_deref(), Some("Invoice"));
        assert_eq!(
            extraction.markdown.as_deref(),
            Some("# Invoice\n\nTotal: $30.00")
        );
    }

    #[test]
    fn extraction_from_object_rejects_invalid_shape() {
        let error = extraction_from_object(json!(["not", "an", "object"]))
            .expect_err("non-object response rejected");

        assert!(error.contains("must be a JSON object"));
    }

    #[test]
    fn extraction_from_object_supports_legacy_field_array() {
        let value = json!({
            "fields": [
                { "name": "documentNumber", "value": "INV-42" },
                { "name": "total", "value": "$30.00" }
            ],
            "lineItems": [
                { "description": "A", "quantity": "1", "amount": "$30.00" }
            ],
            "summary": "Invoice"
        });

        let extraction = extraction_from_object(value).expect("legacy response parses");

        assert_eq!(extraction.fields.len(), 2);
        assert_eq!(extraction.fields[0].name, "documentNumber");
        assert_eq!(value_to_plain_string(&extraction.fields[1].value), "$30.00");
        assert_eq!(extraction.line_items.len(), 1);
    }

    #[test]
    fn build_validated_draft_fills_missing_schema_fields_for_review() {
        let job = build_job(
            Path::new("vendor-invoice.png"),
            "abc1234567890def".to_string(),
        )
        .expect("job");
        let extraction = extraction_from_object(json!({
            "documentNumber": "INV-42",
            "total": "$30.00",
            "markdown": "Invoice transcript",
            "summary": "Invoice"
        }))
        .expect("named response parses");

        let draft = build_validated_draft(&job, "gemma4:e4b-it-qat", None, extraction);
        let due_date = draft
            .fields
            .iter()
            .find(|field| field.name == "dueDate")
            .expect("missing schema field is present");

        assert_eq!(due_date.value, Value::String(String::new()));
        assert_eq!(due_date.needs_review, Some(true));
        assert_eq!(draft.raw_text.as_deref(), Some("Invoice transcript"));
    }

    #[test]
    fn schema_is_typed_per_document_kind() {
        let invoice = extraction_schema("invoice");
        let required: Vec<&str> = invoice["required"]
            .as_array()
            .expect("required array")
            .iter()
            .filter_map(Value::as_str)
            .collect();
        assert!(required.contains(&"total"));
        assert!(required.contains(&"summary"));
        assert!(required.contains(&"markdown"));
        assert!(invoice["properties"].get("vendor").is_some());
        assert!(invoice["properties"].get("lineItems").is_some());
        assert!(invoice["properties"].get("markdown").is_some());

        let intake = extraction_schema("intake");
        assert!(intake["properties"].get("fullName").is_some());
        assert!(
            intake["properties"].get("lineItems").is_none(),
            "intake forms have no line-item table"
        );
    }

    // Live end-to-end check against a real local Gemma vision model. Skipped by
    // default because it needs Ollama running with the model installed and a real
    // document image. On a configured machine (e.g. a Mac):
    //   MICROSERVICES_DESKTOP_TEST_IMAGE=/path/to/phone-photo.jpg \
    //     cargo test --manifest-path src-tauri/Cargo.toml -- --ignored
    #[test]
    #[ignore = "requires a running local Ollama + gemma vision model and a real document image"]
    fn headless_extract_reads_document_with_local_model() {
        let image = std::env::var("MICROSERVICES_DESKTOP_TEST_IMAGE")
            .expect("set MICROSERVICES_DESKTOP_TEST_IMAGE to a real document image or PDF path");
        let model = configured_gemma_model();

        let draft =
            extract_path_headless(Path::new(&image), &model).expect("headless extraction succeeds");

        assert_eq!(draft.model.as_deref(), Some(model.as_str()));
        assert!(
            !draft.fields.is_empty(),
            "expected the model to extract at least one field"
        );
    }
}
