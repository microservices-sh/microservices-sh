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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeStatus {
    ocr: &'static str,
    llm: &'static str,
    model: String,
    mode: &'static str,
    ocr_engine: &'static str,
    llm_engine: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SyncStatus {
    base_url: String,
    state: &'static str,
    pending_drafts: u32,
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
fn runtime_status() -> RuntimeStatus {
    let gemma_model = configured_gemma_model();
    let llm_ready = ollama_model_available(&gemma_model);

    RuntimeStatus {
        ocr: if tesseract_available() { "ready" } else { "missing" },
        llm: if llm_ready { "ready" } else { "missing" },
        model: gemma_model,
        mode: "tauri",
        ocr_engine: "tesseract",
        llm_engine: "ollama",
    }
}

#[tauri::command]
fn sync_status(app: tauri::AppHandle) -> Result<SyncStatus, String> {
    let pending_drafts = open_queue(&app)?.pending_count()?;

    Ok(SyncStatus {
        base_url: std::env::var("MICROSERVICES_DESKTOP_SYNC_URL")
            .unwrap_or_else(|_| "http://localhost:5174".to_string()),
        state: "not-configured",
        pending_drafts,
    })
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
fn extract_document(app: tauri::AppHandle, job_id: String) -> Result<ExtractionResult, String> {
    let queue = open_queue(&app)?;
    let job = queue
        .get_job(&job_id)?
        .ok_or_else(|| format!("Draft job not found: {job_id}"))?;

    queue.update_status(&job.id, "extracting", job.confidence)?;

    let (raw_text, mut warnings) = extract_document_text(Path::new(&job.path));
    let mut draft = normalize_document_draft(&job, &raw_text, Vec::new());

    if !raw_text.trim().is_empty() {
        match normalize_with_gemma(&job, &raw_text) {
            Ok(Some(gemma_draft)) => draft = gemma_draft,
            Ok(None) => warnings.push(format!(
                "Gemma normalization skipped because Ollama model {} is not ready.",
                configured_gemma_model()
            )),
            Err(error) => warnings.push(format!("Gemma normalization failed: {error}")),
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
fn document_draft(app: tauri::AppHandle, job_id: String) -> Result<Option<ExtractionDraft>, String> {
    Ok(open_queue(&app)?.get_job(&job_id)?.and_then(|job| job.draft))
}

#[tauri::command]
fn enqueue_sample_documents() -> Vec<QueueJob> {
    sample_documents()
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
    if path
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("pdf"))
    {
        return 1;
    }

    1
}

fn extract_document_text(path: &Path) -> (String, Vec<String>) {
    let mut warnings = Vec::new();

    if !path.exists() {
        return (
            String::new(),
            vec![format!("Source file is no longer available: {}", path.display())],
        );
    }

    if !is_ocr_image(path) {
        return (
            String::new(),
            vec![format!(
                "OCR currently supports scanned image files only. PDF/image conversion for {} is planned next.",
                path.extension()
                    .and_then(|value| value.to_str())
                    .unwrap_or("unknown")
            )],
        );
    }

    if !tesseract_available() {
        return (
            String::new(),
            vec![
                "Tesseract OCR is not installed or is not on PATH. Install it to convert scanned images locally."
                    .to_string(),
            ],
        );
    }

    match run_tesseract(path) {
        Ok(text) if !text.trim().is_empty() => (text, warnings),
        Ok(_) => {
            warnings.push("OCR completed but returned no text; this scan needs manual review.".to_string());
            (String::new(), warnings)
        }
        Err(error) => {
            warnings.push(error);
            (String::new(), warnings)
        }
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

fn tesseract_available() -> bool {
    Command::new("tesseract")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok_and(|status| status.success())
}

fn run_tesseract(path: &Path) -> Result<String, String> {
    let language = std::env::var("MICROSERVICES_DESKTOP_OCR_LANG")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "eng".to_string());
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

    if let Some(value) = find_value_after_keywords(&lines, &["invoice", "receipt", "statement"], &["number", "no", "#"]) {
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

fn text_field(name: &str, value: String, confidence: f32, source_text: Option<&str>) -> ExtractedField {
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

fn find_value_after_keywords(lines: &[&str], primary: &[&str], secondary: &[&str]) -> Option<String> {
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
            let cleaned = token.trim_matches(|c: char| !c.is_ascii_alphanumeric() && c != '/' && c != '-');
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
        .map(|token| token.trim_matches(|c: char| {
            !(c.is_ascii_digit() || c == '$' || c == '.' || c == ',' || c == '-')
        }))
        .find(|token| {
            let digits = token.chars().filter(|c| c.is_ascii_digit()).count();
            digits > 0 && (token.contains('.') || token.contains('$'))
        })
        .map(str::to_string)
}

fn normalize_with_gemma(job: &QueueJob, raw_text: &str) -> Result<Option<ExtractionDraft>, String> {
    let model = configured_gemma_model();
    if !ollama_model_available(&model) {
        return Ok(None);
    }

    let response = ollama_chat(&model, job, raw_text)?;
    let parsed = parse_json_object(&response)?;
    let mut draft: ExtractionDraft = serde_json::from_value(parsed)
        .map_err(|error| format!("Gemma response did not match extraction draft schema: {error}"))?;

    draft.schema_id = schema_id_for_job(job).to_string();
    draft.target_type = target_type_for_job(job).to_string();
    draft.runtime = "sidecar".to_string();
    draft.model = Some(model);
    draft.raw_text = Some(raw_text.trim().to_string());
    draft.confidence = draft.confidence.clamp(0.0, 1.0);

    Ok(Some(draft))
}

fn configured_gemma_model() -> String {
    std::env::var("MICROSERVICES_DESKTOP_GEMMA_MODEL")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_GEMMA_MODEL.to_string())
}

fn ollama_model_available(model: &str) -> bool {
    let Ok(response) = ollama_http("GET", "/api/tags", None, Duration::from_millis(500)) else {
        return false;
    };
    let Ok(json) = serde_json::from_str::<Value>(&response) else {
        return false;
    };

    json.get("models")
        .and_then(Value::as_array)
        .is_some_and(|models| {
            models.iter().any(|entry| {
                entry
                    .get("name")
                    .and_then(Value::as_str)
                    .is_some_and(|name| name == model || name.starts_with(&format!("{model}:")))
            })
        })
}

fn ollama_chat(model: &str, job: &QueueJob, raw_text: &str) -> Result<String, String> {
    let body = json!({
        "model": model,
        "stream": false,
        "options": { "temperature": 0 },
        "messages": [
            {
                "role": "system",
                "content": [
                    "You convert OCR text from scanned business documents into strict JSON.",
                    "Return only JSON with: schemaId, targetType, fields, tables, rawText, summary, confidence, runtime, model, warnings.",
                    "Every field must include name, value, confidence, and needsReview when uncertain.",
                    "Do not invent values; use null with low confidence when the source is unclear."
                ].join(" ")
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

    fn pending_count(&self) -> Result<u32, String> {
        self.conn
            .query_row(
                "SELECT COUNT(*) FROM draft_jobs WHERE status != 'synced'",
                [],
                |row| row.get::<_, u32>(0),
            )
            .map_err(|error| format!("Failed to count pending drafts: {error}"))
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
        conn.execute(&format!("ALTER TABLE draft_jobs ADD COLUMN {name} {definition}"), [])
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
        draft: draft_json
            .and_then(|value| serde_json::from_str::<ExtractionDraft>(&value).ok()),
    })
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

fn sample_draft(name: &str, target_type: &str, schema_id: &str, confidence: f32) -> ExtractionDraft {
    ExtractionDraft {
        schema_id: schema_id.to_string(),
        target_type: target_type.to_string(),
        fields: vec![
            text_field("documentTitle", name.to_string(), confidence, Some(name)),
            text_field("total", "$1,240.00".to_string(), confidence, Some("Total $1,240.00")),
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
            sync_status,
            select_import_folder,
            import_folder_path,
            import_document_paths,
            queue_documents,
            extract_document,
            document_draft,
            enqueue_sample_documents
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
            saved.draft.as_ref().and_then(|draft| draft.raw_text.as_deref()),
            Some("Repair Shop\nReceipt # RS-9\nTotal $88.00")
        );

        let reopened = DraftQueue::open(workspace.path().join("drafts.sqlite3")).expect("reopen queue");
        let persisted = reopened.get_job(&job.id).expect("persisted job").expect("job");
        assert_eq!(persisted.draft.expect("draft").warnings, vec!["sample warning"]);
    }
}
