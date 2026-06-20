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
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

const DEFAULT_GEMMA_MODEL: &str = "gemma4:e4b";
const OLLAMA_HOST: &str = "127.0.0.1:11434";
const DEFAULT_OCR_LANGUAGE: &str = "eng";
const MAX_GEMMA_IMAGE_PAGES: usize = 4;
const SUGGESTED_GEMMA_MODELS: [&str; 5] = [
    "gemma4:e2b",
    "gemma4:e4b",
    "gemma4:12b",
    "gemma4:26b",
    "gemma4:31b",
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
    tesseract_installed: bool,
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
    let tesseract_ready = tesseract_available();
    let llm_ready = ollama_model_available(&settings.gemma_model);
    let ocr_ready = tesseract_ready || llm_ready;

    Ok(RuntimeStatus {
        ocr: if ocr_ready { "ready" } else { "missing" },
        llm: if llm_ready { "ready" } else { "missing" },
        model: settings.gemma_model,
        mode: "tauri",
        ocr_engine: ocr_engine_label(tesseract_ready, llm_ready).to_string(),
        llm_engine: "ollama".to_string(),
    })
}

fn ocr_engine_label(tesseract_ready: bool, llm_ready: bool) -> &'static str {
    if tesseract_ready {
        return "tesseract pre-pass";
    }
    if llm_ready {
        return "gemma vision fallback";
    }
    "tesseract optional; gemma model needed"
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
fn extract_document(app: tauri::AppHandle, job_id: String) -> Result<ExtractionResult, String> {
    let queue = open_queue(&app)?;
    let settings = queue.runtime_settings()?;
    let job = queue
        .get_job(&job_id)?
        .ok_or_else(|| format!("Draft job not found: {job_id}"))?;

    queue.update_status(&job.id, "extracting", job.confidence)?;

    let (raw_text, mut warnings) =
        extract_document_text(Path::new(&job.path), &settings.ocr_language);
    let mut draft = normalize_document_draft(&job, &raw_text, Vec::new());

    if !raw_text.trim().is_empty() {
        match normalize_with_gemma(&job, &raw_text, &settings.gemma_model) {
            Ok(Some(gemma_draft)) => draft = gemma_draft,
            Ok(None) => warnings.push(format!(
                "Gemma normalization skipped because Ollama model {} is not ready.",
                settings.gemma_model
            )),
            Err(error) => warnings.push(format!("Gemma normalization failed: {error}")),
        }
    } else {
        match normalize_with_gemma_images(&job, Path::new(&job.path), &settings.gemma_model) {
            Ok(Some(gemma_draft)) => draft = gemma_draft,
            Ok(None) => warnings.push(format!(
                "Gemma vision extraction skipped because Ollama model {} is not ready.",
                settings.gemma_model
            )),
            Err(error) => warnings.push(format!("Gemma vision extraction failed: {error}")),
        }
    }

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
        endpoint: format!("{}/api/desktop/import", settings.base_url.trim_end_matches('/')),
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

/// Rasterize each PDF page to a PNG in `out_dir` so the local Tesseract path can
/// OCR it. Pages are returned in page order.
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

fn extract_document_text(path: &Path, ocr_language: &str) -> (String, Vec<String>) {
    let mut warnings = Vec::new();

    // Resolve the document to one or more page images. Scanned images are used
    // directly; PDFs are rasterized to PNG pages first. The scratch directory is
    // held until OCR finishes, then dropped (auto-cleaned).
    let (image_pages, _scratch) = match document_image_pages(path) {
        Ok(result) => result,
        Err(error) => {
            return (String::new(), vec![error]);
        }
    };

    if !tesseract_available() {
        return (
            String::new(),
            vec![
                "Tesseract OCR is not installed or is not on PATH. Gemma vision can still extract scanned documents when the selected Ollama model is installed."
                    .to_string(),
            ],
        );
    }

    let multi_page = image_pages.len() > 1;
    let mut page_texts = Vec::new();
    for (index, page) in image_pages.iter().enumerate() {
        match run_tesseract(page, ocr_language) {
            Ok(text) if !text.trim().is_empty() => page_texts.push(text.trim().to_string()),
            Ok(_) => {
                if multi_page {
                    warnings.push(format!("Page {} returned no OCR text.", index + 1));
                }
            }
            Err(error) => warnings.push(error),
        }
    }

    let combined = page_texts.join("\n\n");
    if combined.trim().is_empty() {
        warnings.push(
            "OCR completed but returned no text; this document needs manual review.".to_string(),
        );
    }

    (combined, warnings)
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

fn tesseract_available() -> bool {
    Command::new("tesseract")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok_and(|status| status.success())
}

fn run_tesseract(path: &Path, ocr_language: &str) -> Result<String, String> {
    let language = normalize_ocr_language(ocr_language);
    let output = Command::new("tesseract")
        .arg(path)
        .arg("stdout")
        .arg("-l")
        .arg(language)
        .arg("--dpi")
        .arg("300")
        .output()
        .map_err(|error| format!("Failed to run Tesseract OCR: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(format!(
            "Tesseract OCR failed for {}{}",
            path.display(),
            if stderr.is_empty() {
                ".".to_string()
            } else {
                format!(": {stderr}")
            }
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
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

fn normalize_with_gemma(
    job: &QueueJob,
    raw_text: &str,
    model: &str,
) -> Result<Option<ExtractionDraft>, String> {
    if !ollama_model_available(model) {
        return Ok(None);
    }

    let response = ollama_chat(model, job, raw_text)?;
    let parsed = parse_json_object(&response)?;
    finalize_gemma_draft(job, model, parsed, Some(raw_text.trim().to_string())).map(Some)
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
    let mut draft = finalize_gemma_draft(job, model, parsed, None)?;
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
            fs::read(page)
                .map(|bytes| base64_encode(&bytes))
                .map_err(|error| format!("Failed to read image page {}: {error}", page.display()))
        })
        .collect()
}

fn finalize_gemma_draft(
    job: &QueueJob,
    model: &str,
    parsed: Value,
    raw_text: Option<String>,
) -> Result<ExtractionDraft, String> {
    let mut draft: ExtractionDraft = serde_json::from_value(parsed).map_err(|error| {
        format!("Gemma response did not match extraction draft schema: {error}")
    })?;

    draft.schema_id = schema_id_for_job(job).to_string();
    draft.target_type = target_type_for_job(job).to_string();
    draft.runtime = "sidecar".to_string();
    draft.model = Some(model.to_string());
    if let Some(raw_text) = raw_text.filter(|value| !value.trim().is_empty()) {
        draft.raw_text = Some(raw_text);
    }
    draft.confidence = draft.confidence.clamp(0.0, 1.0);

    Ok(draft)
}

fn configured_gemma_model() -> String {
    std::env::var("MICROSERVICES_DESKTOP_GEMMA_MODEL")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_GEMMA_MODEL.to_string())
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

fn ollama_chat(model: &str, job: &QueueJob, raw_text: &str) -> Result<String, String> {
    let system_prompt = [
        "You convert OCR text from scanned business documents into strict JSON.",
        "Return only JSON with: schemaId, targetType, fields, tables, rawText, summary, confidence, runtime, model, warnings.",
        "Every field must include name, value, confidence, and needsReview when uncertain.",
        "Do not invent values; use null with low confidence when the source is unclear.",
    ]
    .join(" ");
    let body = json!({
        "model": model,
        "stream": false,
        "options": { "temperature": 0 },
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": format!(
                    "Schema: {}\nTarget type: {}\nRuntime: sidecar\nDocument: {}\n\nOCR text:\n{}",
                    schema_id_for_job(job),
                    target_type_for_job(job),
                    job.name,
                    raw_text
                )
            }
        ]
    });
    let response = ollama_http(
        "POST",
        "/api/chat",
        Some(&body.to_string()),
        Duration::from_secs(60),
    )?;
    let json = serde_json::from_str::<Value>(&response)
        .map_err(|error| format!("Ollama returned invalid JSON: {error}"))?;

    json.pointer("/message/content")
        .and_then(Value::as_str)
        .map(str::to_string)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Ollama response did not include message content.".to_string())
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

    let prompt = gemma_image_prompt(job);
    let body = json!({
        "model": model,
        "prompt": prompt,
        "images": images,
        "stream": false,
        "format": "json",
        "options": { "temperature": 0 }
    });
    let response = ollama_http(
        "POST",
        "/api/generate",
        Some(&body.to_string()),
        Duration::from_secs(120),
    )?;
    let json = serde_json::from_str::<Value>(&response)
        .map_err(|error| format!("Ollama returned invalid JSON: {error}"))?;

    json.get("response")
        .and_then(Value::as_str)
        .map(str::to_string)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Ollama response did not include generated content.".to_string())
}

fn gemma_image_prompt(job: &QueueJob) -> String {
    let schema_context = format!(
        "Schema: {}. Target type: {}. Document name: {}.",
        schema_id_for_job(job),
        target_type_for_job(job),
        job.name
    );

    [
        "Read the attached scanned business document image(s).",
        "Return only JSON with: schemaId, targetType, fields, tables, rawText, summary, confidence, runtime, model, warnings.",
        "Every field must include name, value, confidence, and needsReview when uncertain.",
        "Do not invent values; use null with low confidence when the source is unclear.",
        schema_context.as_str(),
    ]
    .join(" ")
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
    stream
        .write_all(request.as_bytes())
        .map_err(|error| format!("Failed to write Ollama request: {error}"))?;

    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .map_err(|error| format!("Failed to read Ollama response: {error}"))?;
    let (headers, payload) = response
        .split_once("\r\n\r\n")
        .ok_or_else(|| "Ollama response was malformed.".to_string())?;
    let status = headers.lines().next().unwrap_or_default();
    if !status.contains(" 200 ") {
        return Err(format!("Ollama request failed: {status}"));
    }

    Ok(payload.to_string())
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
            return Err("Configure the desktop import token before importing approved drafts.".to_string());
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
            tesseract_installed: tesseract_available(),
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

fn main() {
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
            extract_document,
            document_draft,
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
    fn extract_document_text_rejects_unsupported_type() {
        let workspace = tempdir().expect("temp workspace");
        let path = workspace.path().join("notes.txt");
        fs::write(&path, b"plain text").expect("note fixture");

        let (text, warnings) = extract_document_text(&path, "eng");
        assert!(text.is_empty());
        assert!(warnings
            .iter()
            .any(|warning| warning.contains("not a supported document type")));
    }
}
