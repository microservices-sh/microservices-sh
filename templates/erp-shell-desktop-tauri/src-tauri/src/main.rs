#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::{params, Connection};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeStatus {
    ocr: &'static str,
    llm: &'static str,
    model: &'static str,
    mode: &'static str,
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

#[derive(Serialize)]
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
}

#[tauri::command]
fn runtime_status() -> RuntimeStatus {
    RuntimeStatus {
        ocr: "ready",
        llm: "missing",
        model: "Gemma local adapter pending",
        mode: "tauri",
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
        imported_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_draft_jobs_imported_at
        ON draft_jobs(imported_at DESC);
      ",
        )
        .map_err(|error| format!("Failed to initialize draft queue: {error}"))?;

        Ok(Self { conn })
    }

    fn insert_job(&self, job: &QueueJob) -> Result<bool, String> {
        let changed = self
            .conn
            .execute(
                "
        INSERT OR IGNORE INTO draft_jobs
          (id, file_path, file_name, file_hash, kind, status, confidence, pages, imported_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
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
                    job.imported_at
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
        SELECT id, file_name, kind, status, confidence, pages, file_hash, file_path, imported_at
        FROM draft_jobs
        ORDER BY imported_at DESC, file_name ASC
        ",
            )
            .map_err(|error| format!("Failed to prepare draft queue query: {error}"))?;

        let rows = statement
            .query_map([], |row| {
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
                })
            })
            .map_err(|error| format!("Failed to read draft queue: {error}"))?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("Failed to decode draft queue: {error}"))
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
        },
    ]
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
}
