// File operations for beautiFULLshot export and project system

use std::collections::VecDeque;
use std::fs;
use std::io::{Cursor, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};
use tauri_plugin_dialog::DialogExt;

/// Maximum size for a single asset (screenshot/background image) — prevents
/// DoS from excessively large exports or a crafted archive entry.
const MAX_FILE_SIZE: usize = 50 * 1024 * 1024;

/// Maximum size for the whole .bshot archive file on disk, checked before it
/// is ever read into memory.
const MAX_ARCHIVE_FILE_SIZE: u64 = 200 * 1024 * 1024;

/// Highest `.bshot` project.json schema version this build understands.
const SUPPORTED_PROJECT_VERSION: u32 = 2;

const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "bmp"];

/// How long a read grant stays redeemable. A grant exists to cover the round
/// trip from an OS event to the frontend's `invoke`, which is milliseconds;
/// anything still unredeemed after this was abandoned (the user cancelled the
/// unsaved-changes prompt, a modal held the transition lock, the frontend
/// only handled the first of several dropped paths, …). Expiring them bounds
/// the window in which a leaked grant could be replayed.
const GRANT_TTL: Duration = Duration::from_secs(60);

/// Hard cap on outstanding grants. Reaching it evicts the oldest, so a
/// pathological sequence of drops cannot grow the queue without bound.
const MAX_PENDING_GRANTS: usize = 32;

/// A one-use authorization to read a specific canonical path, with the
/// instant it was issued so it can expire.
struct PathGrant {
    path: PathBuf,
    issued_at: Instant,
}

/// Outstanding read grants, oldest first. A `VecDeque` rather than a `HashSet`
/// because grants now carry an issue time and are evicted oldest-first — the
/// list is capped at `MAX_PENDING_GRANTS`, so linear scans are trivial.
#[derive(Default)]
pub struct PathGrants {
    grants: VecDeque<PathGrant>,
}

impl PathGrants {
    /// Drop everything past its TTL. Called on every mutation so expiry
    /// happens without a timer thread.
    fn evict_expired(&mut self, now: Instant) {
        self.grants
            .retain(|g| now.duration_since(g.issued_at) < GRANT_TTL);
    }

    fn insert(&mut self, path: PathBuf, now: Instant) {
        self.evict_expired(now);
        // Re-granting the same path refreshes it rather than queuing a
        // duplicate, so N drops of one file can't consume N slots.
        self.grants.retain(|g| g.path != path);
        while self.grants.len() >= MAX_PENDING_GRANTS {
            self.grants.pop_front();
        }
        self.grants.push_back(PathGrant {
            path,
            issued_at: now,
        });
    }

    /// Consume the grant for `path` if one is live. Returns false when the
    /// path was never granted or its grant has expired.
    fn consume(&mut self, path: &Path, now: Instant) -> bool {
        self.evict_expired(now);
        match self.grants.iter().position(|g| g.path == path) {
            Some(index) => {
                self.grants.remove(index);
                true
            }
            None => false,
        }
    }

    /// Revoke a specific unused grant — the frontend calls this for dropped
    /// paths it decided not to open, so an unhandled path in a multi-file
    /// drop doesn't stay redeemable for the rest of the TTL.
    fn revoke(&mut self, path: &Path, now: Instant) {
        self.evict_expired(now);
        self.grants.retain(|g| g.path != path);
    }

    #[cfg(test)]
    fn len(&self) -> usize {
        self.grants.len()
    }
}

// ─── App State ──────────────────────────────────────────────────────
// Tracks the path of the project the app currently has open, set only by
// code paths that themselves vetted the path (dialog pick, validated drop,
// or a successful save). `delete_file` trusts this instead of trusting
// whatever path the renderer sends it.
#[derive(Default)]
pub struct AppState {
    pub active_project_path: Mutex<Option<PathBuf>>,
    /// Canonicalized paths the *trusted* side has authorized the renderer to
    /// read exactly once, each with an expiry. Populated only from Rust-owned
    /// OS events (the native drag-drop handler and the file-association open
    /// handler), never from an `invoke` argument. `read_dropped_project` and
    /// `read_dropped_image` consume a grant instead of trusting the path they
    /// are handed, so a compromised renderer cannot name an arbitrary file and
    /// have it read.
    ///
    /// A grant authorizes a *read* only. Delete authority comes from
    /// `active_project_path`, which the frontend sets through a separate
    /// explicit command after an open actually succeeds — so a leaked or
    /// replayed read grant can never escalate into a delete.
    pub pending_path_grants: Mutex<PathGrants>,
    /// The last path *this process* successfully read and parsed as a project
    /// (via the native Open dialog or a granted drop/file-association read).
    ///
    /// This is the sole thing `set_active_project` will promote, which is what
    /// keeps delete authority Rust-derived: the renderer chooses *whether* the
    /// project it just opened becomes deletable, never *which* path that is.
    /// Naming any other path is rejected even with a valid read grant.
    pub last_read_project: Mutex<Option<PathBuf>>,
}

/// Lock a mutex, tolerating poisoning. A panic while one of these guards is
/// held would otherwise permanently disable the whole file subsystem — every
/// later grant, read, and delete would panic in turn. The data behind these
/// locks is a path list and an `Option<PathBuf>`; neither has an invariant
/// that a partial update could corrupt, so recovering the inner value is
/// safe. Matches the convention already used in overlay.rs.
fn lock_tolerant<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn set_active_project_path(state: &AppState, path: PathBuf) {
    *lock_tolerant(&state.active_project_path) = Some(path);
}

/// Authorize one future renderer read of `path`. Called from Rust-side OS
/// event handlers only. The path is canonicalized here so the grant is
/// recorded in the same normalized form the command will look it up by.
/// Returns whether a grant was issued (false for a path that doesn't
/// resolve to a regular file).
pub fn grant_path_read(state: &AppState, path: &Path) -> bool {
    match canonicalize_existing(path) {
        Ok(canonical) => {
            lock_tolerant(&state.pending_path_grants).insert(canonical, Instant::now());
            true
        }
        Err(_) => false,
    }
}

/// Number of outstanding (unexpired) read grants. Test-only: lets the
/// startup-file tests in lib.rs assert that storing a path issues no grant
/// while taking it does.
#[cfg(test)]
pub fn pending_grant_count(state: &AppState) -> usize {
    let mut grants = lock_tolerant(&state.pending_path_grants);
    grants.evict_expired(Instant::now());
    grants.len()
}

/// Consume a previously issued grant for `canonical`. Returns an error if no
/// live grant exists — the path was never offered by the OS, or its grant
/// expired.
fn consume_path_grant(state: &tauri::State<AppState>, canonical: &Path) -> Result<(), String> {
    if lock_tolerant(&state.pending_path_grants).consume(canonical, Instant::now()) {
        Ok(())
    } else {
        Err("This file was not offered to the app by the system, or the offer expired. Use File > Open to choose it.".to_string())
    }
}

/// Release read grants the frontend decided not to use — the tail of a
/// multi-file drop, or a drop that arrived while a modal held the transition
/// lock. Best-effort: a path that has no grant (already consumed, already
/// expired, never granted) is silently ignored, so the frontend can call this
/// unconditionally in a `finally`.
#[tauri::command]
pub fn revoke_path_grants(state: tauri::State<AppState>, paths: Vec<String>) {
    let now = Instant::now();
    let mut grants = lock_tolerant(&state.pending_path_grants);
    for path in paths {
        // Match how the grant was recorded. If the path no longer resolves,
        // fall back to the literal form so a deleted file's grant is still
        // cleared.
        let target = canonicalize_existing(Path::new(&path)).unwrap_or_else(|_| PathBuf::from(&path));
        grants.revoke(&target, now);
    }
}

/// Record that `path` was successfully read and parsed as a project. Called
/// from the read paths on the Rust side only; the value is what
/// `set_active_project` is allowed to promote.
fn note_read_project(state: &AppState, path: &Path) {
    *lock_tolerant(&state.last_read_project) = Some(path.to_path_buf());
}

/// Promote the project this process most recently read into the *active*
/// project, which is what `delete_file` will act on.
///
/// Delete authority is deliberately split from the read. The renderer decides
/// *whether* to promote (it calls this only once the project has parsed and
/// been restored into the editor), but never *which* path gets promoted —
/// that comes from `last_read_project`, which only Rust writes. An attacker
/// who replays a leaked read grant therefore gains a read and nothing more:
/// to make a file deletable they would have to make it the file this process
/// legitimately just opened.
#[tauri::command]
pub fn set_active_project(state: tauri::State<AppState>, path: String) -> Result<(), String> {
    let canonical = canonicalize_existing(Path::new(&path))?;

    let last_read = lock_tolerant(&state.last_read_project).clone();
    if last_read.as_deref() != Some(canonical.as_path()) {
        return Err("This project was not opened by the app.".to_string());
    }

    *lock_tolerant(&state.active_project_path) = Some(canonical);
    Ok(())
}

/// Clear the tracked active project (called when the frontend closes a project)
#[tauri::command]
pub fn clear_active_project(state: tauri::State<AppState>) {
    *lock_tolerant(&state.active_project_path) = None;
}

// ─── Project Data Structures ───────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CanvasMeta {
    pub original_width: u32,
    pub original_height: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GradientMeta {
    pub id: String,
    pub name: String,
    pub colors: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WallpaperMeta {
    pub id: String,
    pub src: String,
    pub thumbnail: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct CropRectMeta {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct CropMeta {
    #[serde(rename = "aspectRatio")]
    pub aspect_ratio: Option<f64>,
    /// Whether a crop selection was active (drawn but not yet applied) when
    /// the project was saved. Absent on files written before this field
    /// existed, which had no way to represent an in-progress crop.
    #[serde(rename = "isCropping", default)]
    pub is_cropping: bool,
    /// The in-progress selection rectangle, in source-image coordinates.
    #[serde(rename = "cropRect", default)]
    pub crop_rect: Option<CropRectMeta>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BackgroundMeta {
    #[serde(rename = "type")]
    pub bg_type: String,
    pub gradient: Option<GradientMeta>,
    #[serde(rename = "solidColor")]
    pub solid_color: Option<String>,
    pub wallpaper: Option<WallpaperMeta>,
    #[serde(rename = "blurAmount")]
    pub blur_amount: u32,
    #[serde(rename = "shadowBlur")]
    pub shadow_blur: u32,
    #[serde(rename = "cornerRadius")]
    pub corner_radius: u32,
    #[serde(rename = "paddingPercent")]
    pub padding_percent: u32,
    #[serde(rename = "borderWidth")]
    pub border_width: u32,
    #[serde(rename = "borderColor")]
    pub border_color: String,
    #[serde(rename = "borderOpacity")]
    pub border_opacity: u32,
    /// Dominant color computed for the 'auto' background type. Added in v2 —
    /// absent/null on v1 files, recomputed by the frontend in that case.
    #[serde(rename = "autoColor", default)]
    pub auto_color: Option<String>,
    /// Whether a `background.png` entry is present in the archive for a
    /// custom-image background. Added in v2.
    #[serde(rename = "hasCustomImage", default)]
    pub has_custom_image: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ExportSettingsMeta {
    pub format: String,
    pub quality: f64,
    #[serde(rename = "pixelRatio")]
    pub pixel_ratio: u32,
    #[serde(rename = "outputAspectRatio")]
    pub output_aspect_ratio: String,
}

fn default_number_counter() -> u32 {
    1
}

/// A single annotation. Rust does not model each shape variant's fields —
/// the renderer owns that schema — but it does enforce that every entry is
/// a JSON object carrying the `id` and `type` discriminators the renderer
/// unconditionally dereferences. Anything else (null, a scalar, an object
/// missing `type`) is rejected at parse time, so a malformed project fails
/// with an actionable "invalid project" error instead of crashing the
/// editor after the project has already been activated.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AnnotationValue {
    pub id: String,
    #[serde(rename = "type")]
    pub annotation_type: String,
    #[serde(flatten)]
    pub rest: serde_json::Map<String, serde_json::Value>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProjectMetadata {
    pub version: u32,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(rename = "sourceImage")]
    pub source_image: String,
    pub canvas: CanvasMeta,
    pub background: BackgroundMeta,
    /// Annotations are passed through to the frontend without Rust
    /// interpreting each variant's fields, but the *collection* is typed as
    /// a list of objects. A bare `serde_json::Value` here would let
    /// `"annotations": null` (or a string, or a number) deserialize
    /// successfully and only fail later in the renderer when `.map()` is
    /// called on it.
    pub annotations: Vec<AnnotationValue>,
    #[serde(rename = "exportSettings")]
    pub export_settings: ExportSettingsMeta,
    /// Committed crop aspect ratio. Added in v2 — absent on v1 files.
    #[serde(default)]
    pub crop: Option<CropMeta>,
    /// Next number to assign for the "number" annotation tool. Added in v2 —
    /// defaults to 1 (matches pre-v2 behavior) when absent.
    #[serde(rename = "numberCounter", default = "default_number_counter")]
    pub number_counter: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProjectData {
    pub metadata: ProjectMetadata,
    #[serde(rename = "screenshotBytes")]
    pub screenshot_bytes: Vec<u8>,
    /// Present only when `metadata.background.hasCustomImage` is true.
    #[serde(rename = "backgroundImageBytes", default, skip_serializing_if = "Option::is_none")]
    pub background_image_bytes: Option<Vec<u8>>,
}

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum OpenPickResult {
    #[serde(rename_all = "camelCase")]
    Project { path: String, data: ProjectData },
    #[serde(rename_all = "camelCase")]
    Image { path: String, bytes: Vec<u8> },
    Cancelled,
}

// ─── Shared helpers ─────────────────────────────────────────────────

/// Canonicalize `path`'s parent directory (creating it if needed) and join
/// the filename back on — used so a relative/nonexistent-parent path can
/// still be validated, and so downstream ".." checks operate on a resolved
/// path. This does NOT require the file itself to already exist.
fn canonicalize_for_write(path: &Path) -> Result<PathBuf, String> {
    let parent = path.parent().ok_or("Invalid path: no parent directory")?;
    fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    let canonical_parent = parent
        .canonicalize()
        .map_err(|e| format!("Invalid path: {}", e))?;
    let filename = path.file_name().ok_or("Invalid filename")?;
    Ok(canonical_parent.join(filename))
}

/// Canonicalize a path that must already exist on disk — resolves symlinks
/// to their real target so extension/type checks can't be bypassed by a
/// symlink and so path comparisons (e.g. against the active project) are
/// comparing real locations.
fn canonicalize_existing(path: &Path) -> Result<PathBuf, String> {
    let canonical = path
        .canonicalize()
        .map_err(|e| format!("Invalid path: {}", e))?;
    if !canonical.is_file() {
        return Err("Not a regular file".to_string());
    }
    Ok(canonical)
}

fn has_extension(path: &Path, allowed: &[&str]) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| allowed.iter().any(|a| a.eq_ignore_ascii_case(e)))
        .unwrap_or(false)
}

/// Whether `path` carries the `.bshot` extension, case-insensitively. Exposed
/// so the startup/file-association paths in lib.rs classify files exactly the
/// way the read commands do, rather than with their own string matching.
pub fn has_bshot_extension(path: &Path) -> bool {
    has_extension(path, &["bshot"])
}

/// The image extensions the backend will read. Exposed so the frontend's
/// drop handler can be checked against the real list instead of drifting from
/// it (a frontend that accepts `.svg` only to have Rust reject it produces a
/// confusing error).
pub fn is_supported_image(path: &Path) -> bool {
    has_extension(path, IMAGE_EXTENSIONS)
}

/// Read a file into memory without ever allocating more than `MAX_FILE_SIZE`.
/// The size is checked from the open handle's own metadata (not a separate
/// `fs::metadata` call, which a swap between the two could invalidate), and
/// the read is then capped with `Read::take` so a file that grows after the
/// check — or one whose reported length lies, as with some virtual
/// filesystems — still cannot exhaust memory.
fn read_file_bounded(path: &Path) -> Result<Vec<u8>, String> {
    let mut file = fs::File::open(path).map_err(|e| format!("Failed to read file: {}", e))?;
    let len = file
        .metadata()
        .map_err(|e| format!("Failed to read file: {}", e))?
        .len();

    if len > MAX_FILE_SIZE as u64 {
        return Err(format!(
            "File size ({} MB) exceeds maximum allowed ({} MB)",
            len / (1024 * 1024),
            MAX_FILE_SIZE / (1024 * 1024)
        ));
    }

    let mut buf = Vec::with_capacity(len as usize);
    (&mut file)
        .take(MAX_FILE_SIZE as u64 + 1)
        .read_to_end(&mut buf)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    if buf.len() > MAX_FILE_SIZE {
        return Err(format!(
            "File size exceeds maximum allowed ({} MB)",
            MAX_FILE_SIZE / (1024 * 1024)
        ));
    }

    Ok(buf)
}

/// Write `data` to `path` atomically: write to a sibling temp file, flush +
/// fsync, then rename over the target. `fs::rename` replaces the destination
/// on both Unix and Windows, so a crash/disk-full mid-write can never leave
/// a truncated file at the real path.
fn atomic_write(path: &Path, data: &[u8]) -> Result<(), String> {
    let dir = path.parent().ok_or("Invalid path: no parent directory")?;
    let tmp_name = format!(
        ".{}.{}.tmp",
        path.file_name().and_then(|n| n.to_str()).unwrap_or("project"),
        std::process::id()
    );
    let tmp_path = dir.join(tmp_name);

    let write_result = (|| -> Result<(), String> {
        let mut f = fs::File::create(&tmp_path).map_err(|e| format!("Failed to create temp file: {}", e))?;
        f.write_all(data).map_err(|e| format!("Failed to write temp file: {}", e))?;
        f.sync_all().map_err(|e| format!("Failed to flush temp file: {}", e))?;
        Ok(())
    })();

    if let Err(e) = write_result {
        let _ = fs::remove_file(&tmp_path);
        return Err(e);
    }

    if let Err(e) = fs::rename(&tmp_path, path) {
        let _ = fs::remove_file(&tmp_path);
        return Err(format!("Failed to finalize file: {}", e));
    }

    Ok(())
}

/// Read a single ZIP entry with bounds checking: rejects based on the
/// declared uncompressed size before allocating, AND caps the actual bytes
/// read via `Read::take` so a declared size that lies (zip bomb) can't still
/// exhaust memory. `max_size` is a parameter (rather than always the global
/// `MAX_FILE_SIZE`) so it can be exercised with small archives in tests.
fn read_zip_entry_bounded_with_limit<R: Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
    name: &str,
    label: &str,
    max_size: usize,
) -> Result<Vec<u8>, String> {
    let mut file = archive
        .by_name(name)
        .map_err(|_| format!("Project file is missing {}", name))?;

    if file.size() > max_size as u64 {
        return Err(format!(
            "{} ({} MB) exceeds maximum allowed ({} MB)",
            label,
            file.size() / (1024 * 1024),
            max_size / (1024 * 1024)
        ));
    }

    let mut limited = (&mut file).take(max_size as u64 + 1);
    let mut buf = Vec::new();
    limited
        .read_to_end(&mut buf)
        .map_err(|e| format!("Failed to read {}: {}", name, e))?;

    if buf.len() > max_size {
        return Err(format!(
            "{} exceeds maximum allowed size ({} MB)",
            label,
            max_size / (1024 * 1024)
        ));
    }

    Ok(buf)
}

fn read_zip_entry_bounded<R: Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
    name: &str,
    label: &str,
) -> Result<Vec<u8>, String> {
    read_zip_entry_bounded_with_limit(archive, name, label, MAX_FILE_SIZE)
}

/// Validate that `canonical` is an allowed delete target: it must be a
/// `.bshot` file and must exactly match the currently tracked active
/// project path. Extracted from `delete_file` so it can be unit tested
/// without needing a running Tauri app to construct `tauri::State`.
fn validate_delete_target(canonical: &Path, active: &Option<PathBuf>) -> Result<(), String> {
    if !has_extension(canonical, &["bshot"]) {
        return Err("Only beautiFULLshot project files can be deleted this way".to_string());
    }

    match active {
        Some(active_path) if active_path == canonical => Ok(()),
        _ => Err("This file is not the currently open project".to_string()),
    }
}

/// Core .bshot reader shared by the dialog-driven open flow and the
/// drag-drop flow. `path` must already have been canonicalized/validated by
/// the caller.
fn read_project_from_path(path: &Path) -> Result<ProjectData, String> {
    // Size-check and read share one handle, and the read is capped, so the
    // archive can never be allocated in full before being rejected.
    let mut file = fs::File::open(path).map_err(|e| format!("Could not open project file: {}", e))?;
    let len = file
        .metadata()
        .map_err(|e| format!("Could not open project file: {}", e))?
        .len();

    if len > MAX_ARCHIVE_FILE_SIZE {
        return Err(format!(
            "Project file ({} MB) exceeds maximum allowed ({} MB)",
            len / (1024 * 1024),
            MAX_ARCHIVE_FILE_SIZE / (1024 * 1024)
        ));
    }

    let mut file_bytes = Vec::with_capacity(len as usize);
    (&mut file)
        .take(MAX_ARCHIVE_FILE_SIZE + 1)
        .read_to_end(&mut file_bytes)
        .map_err(|e| format!("Could not open project file: {}", e))?;

    if file_bytes.len() as u64 > MAX_ARCHIVE_FILE_SIZE {
        return Err(format!(
            "Project file exceeds maximum allowed ({} MB)",
            MAX_ARCHIVE_FILE_SIZE / (1024 * 1024)
        ));
    }

    let cursor = Cursor::new(file_bytes);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|e| format!("Invalid project file (not a valid ZIP): {}", e))?;

    let json_bytes = read_zip_entry_bounded(&mut archive, "project.json", "project.json")?;
    let metadata: ProjectMetadata = serde_json::from_slice(&json_bytes)
        .map_err(|e| format!("Failed to parse project.json: {}", e))?;

    if metadata.version > SUPPORTED_PROJECT_VERSION {
        return Err(format!(
            "This project was created by a newer version of beautiFULLshot (format v{}). Please update the app.",
            metadata.version
        ));
    }

    let screenshot_bytes = read_zip_entry_bounded(&mut archive, "screenshot.png", "screenshot.png")?;

    let background_image_bytes = if metadata.background.has_custom_image {
        Some(read_zip_entry_bounded(&mut archive, "background.png", "background.png")?)
    } else {
        None
    };

    Ok(ProjectData {
        metadata,
        screenshot_bytes,
        background_image_bytes,
    })
}

// ─── Save File (existing) ──────────────────────────────────────────

/// Save binary data to file at specified path
/// Security: Validates path and enforces size limits; write is atomic.
#[tauri::command]
pub async fn save_file(path: String, data: Vec<u8>) -> Result<String, String> {
    if data.len() > MAX_FILE_SIZE {
        return Err(format!(
            "File size ({} MB) exceeds maximum allowed ({} MB)",
            data.len() / (1024 * 1024),
            MAX_FILE_SIZE / (1024 * 1024)
        ));
    }

    let path = PathBuf::from(&path);
    let canonical_path = canonicalize_for_write(&path)?;

    let path_str = canonical_path.to_string_lossy();
    if path_str.contains("..") {
        return Err("Invalid path: directory traversal not allowed".to_string());
    }

    atomic_write(&canonical_path, &data)?;

    Ok(canonical_path.to_string_lossy().to_string())
}

/// Get (and create if needed) the beautiFULLshot project directory
/// Returns ~/Pictures/beautiFULLshot on all platforms
#[tauri::command]
pub fn get_project_dir() -> Result<String, String> {
    let dir = dirs::picture_dir()
        .map(|p| p.join("beautiFULLshot"))
        .ok_or_else(|| "Could not find Pictures directory".to_string())?;

    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create project directory: {}", e))?;

    Ok(dir.to_string_lossy().to_string())
}

// ─── Project File Operations ───────────────────────────────────────

/// Write a .bshot project file (ZIP archive), atomically.
#[tauri::command]
pub async fn write_project(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    path: String,
    metadata: ProjectMetadata,
    screenshot_bytes: Vec<u8>,
    background_image_bytes: Option<Vec<u8>>,
) -> Result<String, String> {
    let _ = &app;

    if screenshot_bytes.len() > MAX_FILE_SIZE {
        return Err(format!(
            "Screenshot size ({} MB) exceeds maximum allowed ({} MB)",
            screenshot_bytes.len() / (1024 * 1024),
            MAX_FILE_SIZE / (1024 * 1024)
        ));
    }
    if let Some(bytes) = &background_image_bytes {
        if bytes.len() > MAX_FILE_SIZE {
            return Err(format!(
                "Background image size ({} MB) exceeds maximum allowed ({} MB)",
                bytes.len() / (1024 * 1024),
                MAX_FILE_SIZE / (1024 * 1024)
            ));
        }
    }

    let path = PathBuf::from(&path);
    let path = if path.extension().map(|e| e.to_str()) != Some(Some("bshot")) {
        path.with_extension("bshot")
    } else {
        path
    };

    let canonical_path = canonicalize_for_write(&path)?;

    let mut zip_buffer = Cursor::new(Vec::new());
    {
        let mut zip_writer = zip::ZipWriter::new(&mut zip_buffer);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        let json_str = serde_json::to_string_pretty(&metadata)
            .map_err(|e| format!("Failed to serialize project metadata: {}", e))?;
        zip_writer.start_file("project.json", options)
            .map_err(|e| format!("Failed to write project.json header: {}", e))?;
        zip_writer.write_all(json_str.as_bytes())
            .map_err(|e| format!("Failed to write project.json content: {}", e))?;

        zip_writer.start_file("screenshot.png", options)
            .map_err(|e| format!("Failed to write screenshot.png header: {}", e))?;
        zip_writer.write_all(&screenshot_bytes)
            .map_err(|e| format!("Failed to write screenshot.png content: {}", e))?;

        if metadata.background.has_custom_image {
            let bytes = background_image_bytes
                .as_ref()
                .ok_or("hasCustomImage is set but no background image bytes were provided")?;
            zip_writer.start_file("background.png", options)
                .map_err(|e| format!("Failed to write background.png header: {}", e))?;
            zip_writer.write_all(bytes)
                .map_err(|e| format!("Failed to write background.png content: {}", e))?;
        }

        zip_writer.finish()
            .map_err(|e| format!("Failed to finalize ZIP archive: {}", e))?;
    }

    let zip_bytes = zip_buffer.into_inner();

    if zip_bytes.len() > MAX_ARCHIVE_FILE_SIZE as usize {
        return Err(format!(
            "Project file size ({} MB) exceeds maximum allowed ({} MB)",
            zip_bytes.len() / (1024 * 1024),
            MAX_ARCHIVE_FILE_SIZE / (1024 * 1024)
        ));
    }

    atomic_write(&canonical_path, &zip_bytes)?;

    // A successful save is unambiguous proof this is the user's project (the
    // path came from the native Save dialog or an already-active project), so
    // unlike the read paths this activates directly. Recorded as the last read
    // too, so a later `set_active_project` for the same path is consistent.
    note_read_project(&state, &canonical_path);
    set_active_project_path(&state, canonical_path.clone());

    Ok(canonical_path.to_string_lossy().to_string())
}

/// Open the native "Open" dialog (project + image filters) directly from
/// Rust and read the chosen file. No filesystem path ever crosses the IPC
/// boundary from JS for this flow — the picker and the read happen on the
/// same trusted side, so a compromised renderer has no arbitrary-path
/// primitive here.
#[tauri::command]
pub async fn pick_and_open(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<OpenPickResult, String> {
    let default_dir = get_project_dir().ok();

    let mut builder = app
        .dialog()
        .file()
        .add_filter("All Supported", &["bshot", "png", "jpg", "jpeg", "gif", "webp", "bmp"])
        .add_filter("beautiFULLshot Project", &["bshot"])
        .add_filter("Images", &["png", "jpg", "jpeg", "gif", "webp", "bmp"]);

    if let Some(dir) = &default_dir {
        builder = builder.set_directory(dir);
    }

    let picked = builder.blocking_pick_file();
    let file_path = match picked {
        Some(fp) => fp,
        None => return Ok(OpenPickResult::Cancelled),
    };

    let path = file_path
        .into_path()
        .map_err(|e| format!("Invalid file selection: {}", e))?;
    let canonical = canonicalize_existing(&path)?;

    if has_extension(&canonical, &["bshot"]) {
        let data = read_project_from_path(&canonical)?;
        // Reading is not activation, even from the trusted dialog: if the
        // frontend fails to restore the project, the previous project must
        // stay the delete target rather than this half-opened one.
        note_read_project(&state, &canonical);
        Ok(OpenPickResult::Project {
            path: canonical.to_string_lossy().to_string(),
            data,
        })
    } else if has_extension(&canonical, IMAGE_EXTENSIONS) {
        let bytes = read_file_bounded(&canonical)?;
        Ok(OpenPickResult::Image {
            path: canonical.to_string_lossy().to_string(),
            bytes,
        })
    } else {
        Err("Unsupported file type".to_string())
    }
}

/// Read a `.bshot` project the OS offered to the app (a webview drag-drop,
/// or a file-association open). The path argument is *not* trusted on its
/// own: a one-use grant recorded by the Rust-side event handler must exist
/// for it, so the renderer can only ask for files the user actually dropped
/// or double-clicked. The path is additionally canonicalized (resolving
/// symlinks), required to be a regular file, and required to carry the
/// `.bshot` extension before the bounded ZIP reader touches it.
///
/// Reading does **not** make the project deletable. It only records the path
/// as this process's last successful read; the frontend must call
/// `set_active_project` once the open has actually succeeded to confer delete
/// authority.
#[tauri::command]
pub async fn read_dropped_project(
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<ProjectData, String> {
    let path = PathBuf::from(&path);
    let canonical = canonicalize_existing(&path)?;
    consume_path_grant(&state, &canonical)?;

    if !has_extension(&canonical, &["bshot"]) {
        return Err("Not a beautiFULLshot project file".to_string());
    }

    let data = read_project_from_path(&canonical)?;
    note_read_project(&state, &canonical);
    Ok(data)
}

/// Read an image the OS offered to the app. Same trust model as
/// `read_dropped_project`: requires a one-use Rust-issued grant, then
/// canonicalizes, requires a regular file, and enforces the image
/// extension allowlist.
#[tauri::command]
pub async fn read_dropped_image(
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<Vec<u8>, String> {
    let path = PathBuf::from(&path);
    let canonical = canonicalize_existing(&path)?;
    consume_path_grant(&state, &canonical)?;

    if !has_extension(&canonical, IMAGE_EXTENSIONS) {
        return Err("Not a supported image file".to_string());
    }

    read_file_bounded(&canonical)
}

/// Delete a file — move to system trash or permanently delete.
/// Security: only permitted for the currently tracked active project path
/// (set by saving, or by an explicit `set_active_project` after a successful
/// open), canonicalized to defeat symlink tricks, and restricted to `.bshot`
/// files. The renderer cannot delete an arbitrary path — a read grant alone
/// is not enough, since grants never touch `active_project_path`.
#[tauri::command]
pub async fn delete_file(
    state: tauri::State<'_, AppState>,
    path: String,
    move_to_trash: bool,
) -> Result<(), String> {
    let path = PathBuf::from(&path);
    let canonical = canonicalize_existing(&path)?;

    {
        let active = lock_tolerant(&state.active_project_path);
        validate_delete_target(&canonical, &active)?;
    }

    if move_to_trash {
        trash::delete(&canonical)
            .map_err(|e| format!("Failed to move to trash: {}", e))?;
    } else {
        fs::remove_file(&canonical)
            .map_err(|e| format!("Failed to delete file: {}", e))?;
    }

    *lock_tolerant(&state.active_project_path) = None;
    // The file is gone; a stale "last read" for it must not be promotable.
    *lock_tolerant(&state.last_read_project) = None;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_dir(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "bshot_test_{}_{}_{}",
            label,
            std::process::id(),
            nanos
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn sample_metadata(version: u32, has_custom_image: bool) -> ProjectMetadata {
        ProjectMetadata {
            version,
            created_at: "2026-01-01T00:00:00Z".to_string(),
            updated_at: "2026-01-01T00:00:00Z".to_string(),
            source_image: "screenshot.png".to_string(),
            canvas: CanvasMeta { original_width: 100, original_height: 200 },
            background: BackgroundMeta {
                bg_type: "gradient".to_string(),
                gradient: None,
                solid_color: None,
                wallpaper: None,
                blur_amount: 0,
                shadow_blur: 50,
                corner_radius: 12,
                padding_percent: 5,
                border_width: 0,
                border_color: "#000000".to_string(),
                border_opacity: 100,
                auto_color: Some("#abcdef".to_string()),
                has_custom_image,
            },
            annotations: Vec::new(),
            export_settings: ExportSettingsMeta {
                format: "png".to_string(),
                quality: 0.9,
                pixel_ratio: 1,
                output_aspect_ratio: "auto".to_string(),
            },
            crop: Some(CropMeta {
                aspect_ratio: Some(1.5),
                is_cropping: true,
                crop_rect: Some(CropRectMeta {
                    x: 10.0,
                    y: 20.0,
                    width: 300.0,
                    height: 200.0,
                }),
            }),
            number_counter: 3,
        }
    }

    /// Build a `.bshot` zip in memory the same way `write_project` does,
    /// for tests that need a real archive without going through the full
    /// Tauri-command signature (which needs an AppHandle/State).
    fn build_zip(metadata: &ProjectMetadata, screenshot: &[u8], background: Option<&[u8]>) -> Vec<u8> {
        let mut buf = Cursor::new(Vec::new());
        {
            let mut writer = zip::ZipWriter::new(&mut buf);
            let options = zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Deflated);

            let json = serde_json::to_string_pretty(metadata).unwrap();
            writer.start_file("project.json", options).unwrap();
            writer.write_all(json.as_bytes()).unwrap();

            writer.start_file("screenshot.png", options).unwrap();
            writer.write_all(screenshot).unwrap();

            if let Some(bg) = background {
                writer.start_file("background.png", options).unwrap();
                writer.write_all(bg).unwrap();
            }

            writer.finish().unwrap();
        }
        buf.into_inner()
    }

    // ─── atomic_write ───────────────────────────────────────────────

    #[test]
    fn atomic_write_creates_file_with_content() {
        let dir = unique_temp_dir("atomic_create");
        let path = dir.join("project.bshot");

        atomic_write(&path, b"hello world").unwrap();

        assert_eq!(fs::read(&path).unwrap(), b"hello world");
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn atomic_write_replaces_existing_file() {
        let dir = unique_temp_dir("atomic_replace");
        let path = dir.join("project.bshot");

        fs::write(&path, b"old content").unwrap();
        atomic_write(&path, b"new content").unwrap();

        assert_eq!(fs::read(&path).unwrap(), b"new content");
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn atomic_write_leaves_no_temp_file_behind() {
        let dir = unique_temp_dir("atomic_cleanup");
        let path = dir.join("project.bshot");

        atomic_write(&path, b"content").unwrap();

        let entries: Vec<_> = fs::read_dir(&dir).unwrap().collect();
        assert_eq!(entries.len(), 1, "only the final file should remain, no .tmp sibling");
        fs::remove_dir_all(&dir).ok();
    }

    // ─── zip bomb guard ─────────────────────────────────────────────

    #[test]
    fn read_zip_entry_bounded_accepts_entries_within_limit() {
        let zip_bytes = build_zip(&sample_metadata(2, false), b"small screenshot", None);
        let mut archive = zip::ZipArchive::new(Cursor::new(zip_bytes)).unwrap();

        let bytes = read_zip_entry_bounded_with_limit(&mut archive, "screenshot.png", "screenshot.png", 1024).unwrap();
        assert_eq!(bytes, b"small screenshot");
    }

    #[test]
    fn read_zip_entry_bounded_rejects_entries_over_the_declared_size_limit() {
        let big_screenshot = vec![0u8; 2048];
        let zip_bytes = build_zip(&sample_metadata(2, false), &big_screenshot, None);
        let mut archive = zip::ZipArchive::new(Cursor::new(zip_bytes)).unwrap();

        // Limit is smaller than the entry's actual/declared size.
        let result = read_zip_entry_bounded_with_limit(&mut archive, "screenshot.png", "screenshot.png", 1024);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("exceeds maximum allowed"));
    }

    #[test]
    fn read_zip_entry_bounded_reports_missing_entries() {
        let zip_bytes = build_zip(&sample_metadata(2, false), b"data", None);
        let mut archive = zip::ZipArchive::new(Cursor::new(zip_bytes)).unwrap();

        let result = read_zip_entry_bounded_with_limit(&mut archive, "background.png", "background.png", 1024);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("missing background.png"));
    }

    // ─── round trip + version gate ──────────────────────────────────

    #[test]
    fn read_project_from_path_round_trips_every_v2_field() {
        let dir = unique_temp_dir("roundtrip");
        let path = dir.join("project.bshot");

        let metadata = sample_metadata(2, true);
        let background_bytes = vec![9u8, 9, 9];
        let zip_bytes = build_zip(&metadata, b"screenshot-bytes", Some(&background_bytes));
        fs::write(&path, &zip_bytes).unwrap();

        let data = read_project_from_path(&path).unwrap();

        assert_eq!(data.metadata.version, 2);
        assert_eq!(data.metadata.background.auto_color.as_deref(), Some("#abcdef"));
        assert!(data.metadata.background.has_custom_image);
        let crop = data.metadata.crop.unwrap();
        assert_eq!(crop.aspect_ratio, Some(1.5));
        assert!(crop.is_cropping);
        let rect = crop.crop_rect.unwrap();
        assert_eq!((rect.x, rect.y, rect.width, rect.height), (10.0, 20.0, 300.0, 200.0));
        assert_eq!(data.metadata.number_counter, 3);
        assert_eq!(data.screenshot_bytes, b"screenshot-bytes");
        assert_eq!(data.background_image_bytes, Some(background_bytes));

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn read_project_from_path_rejects_unsupported_future_versions() {
        let dir = unique_temp_dir("version_gate");
        let path = dir.join("project.bshot");

        let metadata = sample_metadata(SUPPORTED_PROJECT_VERSION + 1, false);
        let zip_bytes = build_zip(&metadata, b"screenshot-bytes", None);
        fs::write(&path, &zip_bytes).unwrap();

        let result = read_project_from_path(&path);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("newer version"));

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn read_project_from_path_accepts_v1_files_missing_v2_fields() {
        // v1 project.json has none of the v2 keys at all — verify serde's
        // `#[serde(default)]` fills them in rather than failing to parse.
        let dir = unique_temp_dir("v1_compat");
        let path = dir.join("project.bshot");

        let v1_json = serde_json::json!({
            "version": 1,
            "createdAt": "2025-01-01T00:00:00Z",
            "updatedAt": "2025-01-01T00:00:00Z",
            "sourceImage": "screenshot.png",
            "canvas": { "originalWidth": 10, "originalHeight": 20 },
            "background": {
                "type": "gradient",
                "gradient": null,
                "solidColor": null,
                "wallpaper": null,
                "blurAmount": 0,
                "shadowBlur": 50,
                "cornerRadius": 12,
                "paddingPercent": 5,
                "borderWidth": 0,
                "borderColor": "#000000",
                "borderOpacity": 100
            },
            "annotations": [],
            "exportSettings": {
                "format": "png",
                "quality": 0.9,
                "pixelRatio": 1,
                "outputAspectRatio": "auto"
            }
        });

        let mut buf = Cursor::new(Vec::new());
        {
            let mut writer = zip::ZipWriter::new(&mut buf);
            let options = zip::write::SimpleFileOptions::default();
            writer.start_file("project.json", options).unwrap();
            writer.write_all(v1_json.to_string().as_bytes()).unwrap();
            writer.start_file("screenshot.png", options).unwrap();
            writer.write_all(b"v1-screenshot").unwrap();
            writer.finish().unwrap();
        }
        fs::write(&path, buf.into_inner()).unwrap();

        let data = read_project_from_path(&path).unwrap();
        assert_eq!(data.metadata.number_counter, 1);
        assert!(!data.metadata.background.has_custom_image);
        assert!(data.metadata.crop.is_none());

        fs::remove_dir_all(&dir).ok();
    }

    /// Build a project.json with an arbitrary `annotations` value, zip it,
    /// and try to read it back. Used to pin down which shapes are rejected.
    fn read_with_annotations(label: &str, annotations: serde_json::Value) -> Result<ProjectData, String> {
        let dir = unique_temp_dir(label);
        let path = dir.join("project.bshot");

        let mut json = serde_json::to_value(sample_metadata(2, false)).unwrap();
        json["annotations"] = annotations;

        let mut buf = Cursor::new(Vec::new());
        {
            let mut writer = zip::ZipWriter::new(&mut buf);
            let options = zip::write::SimpleFileOptions::default();
            writer.start_file("project.json", options).unwrap();
            writer.write_all(json.to_string().as_bytes()).unwrap();
            writer.start_file("screenshot.png", options).unwrap();
            writer.write_all(b"screenshot").unwrap();
            writer.finish().unwrap();
        }
        fs::write(&path, buf.into_inner()).unwrap();

        let result = read_project_from_path(&path);
        fs::remove_dir_all(&dir).ok();
        result
    }

    #[test]
    fn read_project_rejects_null_annotations() {
        // Regression: `annotations: serde_json::Value` accepted null here,
        // and the renderer then crashed on annotations.map().
        let result = read_with_annotations("ann_null", serde_json::Value::Null);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to parse project.json"));
    }

    #[test]
    fn read_project_rejects_annotations_that_are_not_a_list() {
        let result = read_with_annotations("ann_scalar", serde_json::json!("not a list"));
        assert!(result.is_err());
    }

    #[test]
    fn read_project_rejects_annotation_entries_missing_discriminators() {
        // An entry without `type` would reach the renderer's switch and fall
        // through to undefined behavior; reject it at parse time.
        let result = read_with_annotations("ann_no_type", serde_json::json!([{ "id": "a1" }]));
        assert!(result.is_err());
    }

    #[test]
    fn read_project_preserves_unknown_annotation_fields() {
        // Rust must not model each shape's fields — a valid annotation's
        // extra keys have to survive the round trip to the renderer intact.
        let data = read_with_annotations(
            "ann_ok",
            serde_json::json!([{
                "id": "a1",
                "type": "rectangle",
                "x": 1.0,
                "width": 40.0,
                "fill": "#ff0000"
            }]),
        )
        .unwrap();

        assert_eq!(data.metadata.annotations.len(), 1);
        let ann = &data.metadata.annotations[0];
        assert_eq!(ann.id, "a1");
        assert_eq!(ann.annotation_type, "rectangle");
        assert_eq!(ann.rest.get("fill").unwrap(), "#ff0000");
        assert_eq!(ann.rest.get("width").unwrap(), 40.0);
    }

    // ─── bounded file reads ──────────────────────────────────────────

    #[test]
    fn read_file_bounded_reads_a_small_file() {
        let dir = unique_temp_dir("bounded_ok");
        let path = dir.join("image.png");
        fs::write(&path, b"png-bytes").unwrap();

        assert_eq!(read_file_bounded(&path).unwrap(), b"png-bytes");

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn read_file_bounded_reports_a_missing_file() {
        let dir = unique_temp_dir("bounded_missing");
        let result = read_file_bounded(&dir.join("nope.png"));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to read file"));
        fs::remove_dir_all(&dir).ok();
    }

    // ─── drag-drop read grants ───────────────────────────────────────

    #[test]
    fn grant_path_read_records_the_canonical_path() {
        let dir = unique_temp_dir("grant_record");
        let path = dir.join("project.bshot");
        fs::write(&path, b"x").unwrap();

        let state = AppState::default();
        grant_path_read(&state, &path);

        let mut granted = lock_tolerant(&state.pending_path_grants);
        assert!(granted.consume(&path.canonicalize().unwrap(), Instant::now()));

        drop(granted);
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn grant_path_read_ignores_paths_that_do_not_exist() {
        let state = AppState::default();
        grant_path_read(&state, Path::new("/definitely/not/a/real/file.bshot"));
        assert_eq!(lock_tolerant(&state.pending_path_grants).len(), 0);
    }

    #[test]
    fn a_grant_is_consumed_by_a_single_read() {
        // The core of the threat model: a grant authorizes exactly one read,
        // so a renderer cannot replay a legitimate drop to re-authorize a
        // path later.
        let dir = unique_temp_dir("grant_once");
        let path = dir.join("project.bshot");
        fs::write(&path, b"x").unwrap();
        let canonical = path.canonicalize().unwrap();

        let state = AppState::default();
        grant_path_read(&state, &path);

        let now = Instant::now();
        let mut grants = lock_tolerant(&state.pending_path_grants);
        assert!(grants.consume(&canonical, now), "first read should find a grant");
        assert!(!grants.consume(&canonical, now), "second read should find none");

        drop(grants);
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_grant_expires_after_its_ttl() {
        // Grants leak whenever the frontend decides not to redeem one (the
        // user cancels the unsaved-changes prompt, a modal holds the
        // transition lock, the drop had extra files). Expiry bounds how long
        // such a grant stays replayable.
        let mut grants = PathGrants::default();
        let issued = Instant::now();
        let path = PathBuf::from("/tmp/victim.bshot");

        grants.insert(path.clone(), issued);

        assert!(!grants.consume(&path, issued + GRANT_TTL + Duration::from_secs(1)));
        assert_eq!(grants.len(), 0, "expired grants are dropped, not kept");
    }

    #[test]
    fn a_grant_is_still_valid_just_before_its_ttl() {
        let mut grants = PathGrants::default();
        let issued = Instant::now();
        let path = PathBuf::from("/tmp/ok.bshot");

        grants.insert(path.clone(), issued);

        assert!(grants.consume(&path, issued + GRANT_TTL - Duration::from_millis(1)));
    }

    #[test]
    fn outstanding_grants_are_capped() {
        // A pathological sequence of drops must not grow the list without
        // bound; the oldest entries are evicted.
        let mut grants = PathGrants::default();
        let now = Instant::now();

        for i in 0..(MAX_PENDING_GRANTS + 10) {
            grants.insert(PathBuf::from(format!("/tmp/f{}.bshot", i)), now);
        }

        assert_eq!(grants.len(), MAX_PENDING_GRANTS);
        // The oldest is gone, the newest survives.
        assert!(!grants.consume(Path::new("/tmp/f0.bshot"), now));
        assert!(grants.consume(
            Path::new(&format!("/tmp/f{}.bshot", MAX_PENDING_GRANTS + 9)),
            now
        ));
    }

    #[test]
    fn re_granting_a_path_does_not_consume_extra_slots() {
        let mut grants = PathGrants::default();
        let now = Instant::now();
        let path = PathBuf::from("/tmp/same.bshot");

        for _ in 0..10 {
            grants.insert(path.clone(), now);
        }

        assert_eq!(grants.len(), 1);
    }

    #[test]
    fn revoking_releases_an_unused_grant() {
        let mut grants = PathGrants::default();
        let now = Instant::now();
        let path = PathBuf::from("/tmp/unused.bshot");

        grants.insert(path.clone(), now);
        grants.revoke(&path, now);

        assert!(!grants.consume(&path, now));
    }

    #[test]
    fn revoking_an_ungranted_path_is_a_no_op() {
        // The frontend revokes unconditionally in a `finally`, so this must
        // not panic or disturb other grants.
        let mut grants = PathGrants::default();
        let now = Instant::now();
        grants.insert(PathBuf::from("/tmp/keep.bshot"), now);

        grants.revoke(Path::new("/tmp/never-granted.bshot"), now);

        assert_eq!(grants.len(), 1);
        assert!(grants.consume(Path::new("/tmp/keep.bshot"), now));
    }

    // ─── read grants do not confer delete authority ──────────────────

    #[test]
    fn reading_a_project_does_not_make_it_deletable() {
        // The escalation this split exists to prevent: a leaked read grant
        // must not become a delete primitive. Reading records the path as
        // "last read" but leaves active_project_path — the only thing
        // delete_file trusts — untouched.
        let dir = unique_temp_dir("read_no_delete");
        let path = dir.join("project.bshot");
        fs::write(&path, build_zip(&sample_metadata(2, false), b"shot", None)).unwrap();
        let canonical = path.canonicalize().unwrap();

        let state = AppState::default();
        note_read_project(&state, &canonical);

        let active = lock_tolerant(&state.active_project_path);
        assert!(
            validate_delete_target(&canonical, &active).is_err(),
            "a read alone must not authorize deletion"
        );

        drop(active);
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn only_the_last_read_project_can_be_promoted() {
        // set_active_project takes a path from the renderer, so it must not
        // accept an arbitrary one: promotion is limited to the file this
        // process actually just read.
        let dir = unique_temp_dir("promote_scope");
        let opened = dir.join("opened.bshot");
        let other = dir.join("other.bshot");
        fs::write(&opened, b"x").unwrap();
        fs::write(&other, b"x").unwrap();

        let state = AppState::default();
        note_read_project(&state, &opened.canonicalize().unwrap());

        let last_read = lock_tolerant(&state.last_read_project).clone();
        assert_eq!(last_read.as_deref(), Some(opened.canonicalize().unwrap().as_path()));
        assert_ne!(last_read.as_deref(), Some(other.canonicalize().unwrap().as_path()));

        fs::remove_dir_all(&dir).ok();
    }

    // ─── delete_file path validation ─────────────────────────────────

    #[test]
    fn validate_delete_target_accepts_the_exact_active_project() {
        let dir = unique_temp_dir("delete_ok");
        let path = dir.join("project.bshot");
        fs::write(&path, b"x").unwrap();
        let canonical = path.canonicalize().unwrap();

        assert!(validate_delete_target(&canonical, &Some(canonical.clone())).is_ok());
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn validate_delete_target_rejects_a_path_that_is_not_the_active_project() {
        let dir = unique_temp_dir("delete_mismatch");
        let target = dir.join("target.bshot");
        let other = dir.join("other.bshot");
        fs::write(&target, b"x").unwrap();
        fs::write(&other, b"y").unwrap();

        let target_canonical = target.canonicalize().unwrap();
        let other_canonical = other.canonicalize().unwrap();

        let result = validate_delete_target(&target_canonical, &Some(other_canonical));
        assert!(result.is_err());
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn validate_delete_target_rejects_when_no_project_is_active() {
        let dir = unique_temp_dir("delete_none_active");
        let target = dir.join("target.bshot");
        fs::write(&target, b"x").unwrap();
        let canonical = target.canonicalize().unwrap();

        assert!(validate_delete_target(&canonical, &None).is_err());
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn validate_delete_target_rejects_non_bshot_extension() {
        let dir = unique_temp_dir("delete_ext");
        let target = dir.join("target.txt");
        fs::write(&target, b"x").unwrap();
        let canonical = target.canonicalize().unwrap();

        let result = validate_delete_target(&canonical, &Some(canonical.clone()));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("beautiFULLshot project files"));
        fs::remove_dir_all(&dir).ok();
    }

    // ─── extension allowlist ──────────────────────────────────────────

    #[test]
    fn has_extension_is_case_insensitive() {
        assert!(has_extension(Path::new("photo.PNG"), IMAGE_EXTENSIONS));
        assert!(has_extension(Path::new("photo.png"), IMAGE_EXTENSIONS));
        assert!(!has_extension(Path::new("archive.zip"), IMAGE_EXTENSIONS));
    }
}
