# Files Menu — Implementation Plan (Part 1: Rust Backend)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a native File menu with project file (.bshot) support — Open, Save, Export, Close, Delete.

**Architecture:** Hybrid — Rust native menu bar emits Tauri events; React hooks handle all UI logic. Project files are ZIP archives (`.bshot`) with `project.json` + `screenshot.png`.

**Tech Stack:** Rust (Tauri v2, `zip` + `trash` crates), TypeScript (React 18, Zustand, Konva)

**Part 1 covers:** Rust dependency addition, project types, Rust file operations.

---

### Task 1: Add Rust dependencies (zip, trash)

**Goal:** Add `zip` and `trash` crates to the Tauri Cargo.toml for ZIP archive I/O and system trash support.

**Files:**
- Modify: `src-tauri/Cargo.toml`

**Acceptance Criteria:**
- [ ] `cargo build` succeeds with new dependencies
- [ ] `zip` crate available for ZIP archive read/write
- [ ] `trash` crate available for system trash operations

**Verify:** `cd src-tauri && cargo build 2>&1 | head -5` → no errors

**Steps:**

- [ ] **Step 1: Add dependencies to Cargo.toml**

Open `src-tauri/Cargo.toml`. Add after the existing `mouse_position` dependency line (line 33):

```toml
mouse_position = "0.1.4"
zip = "2.2"
trash = "5.2"
```

The full dependencies section should now end with:

```toml
mouse_position = "0.1.4"
zip = "2.2"
trash = "5.2"

[target.'cfg(target_os = "macos")'.dependencies]
```

- [ ] **Step 2: Verify build**

Run: `cd src-tauri && cargo build 2>&1 | tail -5`
Expected: `Finished` with no errors (new crates are downloaded and compiled)

- [ ] **Step 3: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "build: add zip and trash crate dependencies for .bshot project files"
```

---

### Task 2: Create project data types

**Goal:** Create TypeScript types matching the `project.json` schema for use across stores, hooks, and file API wrappers.

**Files:**
- Create: `src/types/project.ts`

**Acceptance Criteria:**
- [ ] All types match the project.json schema from the design spec
- [ ] Types are exported and importable
- [ ] Annotation types are compatible with existing `types/annotations.ts`

**Verify:** `npx tsc --noEmit` → no type errors

**Steps:**

- [ ] **Step 1: Create `src/types/project.ts`**

```typescript
// Project file types — matches .bshot project.json schema

import type { Annotation } from './annotations';

// Background types match background-store.ts
export type BackgroundType = 'gradient' | 'solid' | 'transparent' | 'wallpaper' | 'image' | 'auto';

export interface GradientMeta {
  id: string;
  name: string;
  colors: string[];
}

export interface WallpaperMeta {
  id: string;
  src: string;       // file path reference (not embedded)
  thumbnail: string;
}

export interface BackgroundMeta {
  type: BackgroundType;
  gradient: GradientMeta | null;
  solidColor: string | null;
  wallpaper: WallpaperMeta | null;
  blurAmount: number;
  shadowBlur: number;
  cornerRadius: number;
  paddingPercent: number;
  borderWidth: number;
  borderColor: string;
  borderOpacity: number;
}

export interface CanvasMeta {
  originalWidth: number;
  originalHeight: number;
}

export interface ExportSettingsMeta {
  format: 'png' | 'jpeg';
  quality: number;
  pixelRatio: number;
  outputAspectRatio: string;
}

// The project.json contents
export interface ProjectMetadata {
  version: number;
  createdAt: string;
  updatedAt: string;
  sourceImage: string;
  canvas: CanvasMeta;
  background: BackgroundMeta;
  annotations: Annotation[];
  exportSettings: ExportSettingsMeta;
}

// What Rust returns from read_project: metadata + raw PNG bytes
export interface ProjectLoadResult {
  metadata: ProjectMetadata;
  screenshotBytes: number[]; // Array<number> comes from JSON serialization over IPC
}

// What we send to Rust for write_project
export interface ProjectSaveData {
  metadata: ProjectMetadata;
  screenshotBytes: number[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/types/project.ts
git commit -m "feat: add project data types for .bshot file format"
```

---

### Task 3: Implement Rust project file operations

**Goal:** Add `ProjectData` structs and `read_project`, `write_project`, `delete_file` Tauri commands in `file_ops.rs`. Register them in `lib.rs`.

**Files:**
- Modify: `src-tauri/src/file_ops.rs`
- Modify: `src-tauri/src/lib.rs` (register new commands)

**Acceptance Criteria:**
- [ ] `ProjectData` and `ProjectMetadata` structs with serde Serialize/Deserialize
- [ ] `read_project` opens .bshot ZIP, reads project.json + screenshot.png, returns ProjectData JSON
- [ ] `write_project` creates ZIP archive with project.json + screenshot.png
- [ ] `delete_file` uses trash crate or fs::remove_file based on flag
- [ ] All commands registered in `lib.rs` `invoke_handler`

**Verify:** `cd src-tauri && cargo build 2>&1 | tail -3` → `Finished` with no errors

**Steps:**

- [ ] **Step 1: Define Rust structs and implement commands in `file_ops.rs`**

Replace the entire content of `src-tauri/src/file_ops.rs` with:

```rust
// File operations for beautiFULLshot export and project system

use std::fs;
use std::io::{Cursor, Read, Write};
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

/// Maximum file size limit (50MB) - prevents DoS from excessively large exports
const MAX_FILE_SIZE: usize = 50 * 1024 * 1024;

// ─── Project Data Structures ───────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
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
    pub annotations: serde_json::Value, // Flexible — matches Annotation union type
    #[serde(rename = "exportSettings")]
    pub export_settings: ExportSettingsMeta,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProjectData {
    pub metadata: ProjectMetadata,
    #[serde(rename = "screenshotBytes")]
    pub screenshot_bytes: Vec<u8>,
}

// ─── Save File (existing) ──────────────────────────────────────────

/// Save binary data to file at specified path
/// Security: Validates path and enforces size limits
#[tauri::command]
pub async fn save_file(path: String, data: Vec<u8>) -> Result<String, String> {
    // Enforce file size limit
    if data.len() > MAX_FILE_SIZE {
        return Err(format!(
            "File size ({} MB) exceeds maximum allowed ({} MB)",
            data.len() / (1024 * 1024),
            MAX_FILE_SIZE / (1024 * 1024)
        ));
    }

    let path = PathBuf::from(&path);

    // Canonicalize path to prevent directory traversal attacks
    let canonical_path = if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;

        let canonical_parent = parent
            .canonicalize()
            .map_err(|e| format!("Invalid path: {}", e))?;

        if let Some(filename) = path.file_name() {
            canonical_parent.join(filename)
        } else {
            return Err("Invalid filename".to_string());
        }
    } else {
        return Err("Invalid path: no parent directory".to_string());
    };

    let path_str = canonical_path.to_string_lossy();
    if path_str.contains("..") {
        return Err("Invalid path: directory traversal not allowed".to_string());
    }

    std::fs::write(&canonical_path, data)
        .map_err(|e| format!("Failed to save file: {}", e))?;

    Ok(canonical_path.to_string_lossy().to_string())
}

/// Get Pictures directory with BeautyShot subfolder
#[tauri::command]
pub fn get_pictures_dir() -> Result<String, String> {
    dirs::picture_dir()
        .map(|p| p.join("BeautyShot").to_string_lossy().to_string())
        .ok_or_else(|| "Could not find Pictures directory".to_string())
}

/// Get Desktop directory
#[tauri::command]
pub fn get_desktop_dir() -> Result<String, String> {
    dirs::desktop_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Could not find Desktop directory".to_string())
}

// ─── Project File Operations ───────────────────────────────────────

/// Read a .bshot project file (ZIP archive)
/// Returns ProjectData with metadata and raw screenshot bytes
#[tauri::command]
pub async fn read_project(path: String) -> Result<ProjectData, String> {
    let file_bytes = fs::read(&path)
        .map_err(|e| format!("Could not open project file: {}", e))?;

    let cursor = Cursor::new(file_bytes);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|e| format!("Invalid project file (not a valid ZIP): {}", e))?;

    // Read project.json
    let metadata: ProjectMetadata = {
        let mut file = archive.by_name("project.json")
            .map_err(|_| "Project file is missing project.json".to_string())?;
        let mut contents = String::new();
        file.read_to_string(&mut contents)
            .map_err(|e| format!("Failed to read project.json: {}", e))?;
        serde_json::from_str(&contents)
            .map_err(|e| format!("Failed to parse project.json: {}", e))?
    };

    // Read screenshot.png
    let screenshot_bytes: Vec<u8> = {
        let mut file = archive.by_name("screenshot.png")
            .map_err(|_| "Project file is missing screenshot.png".to_string())?;
        let mut buf = Vec::new();
        file.read_to_end(&mut buf)
            .map_err(|e| format!("Failed to read screenshot.png: {}", e))?;
        buf
    };

    Ok(ProjectData {
        metadata,
        screenshot_bytes,
    })
}

/// Write a .bshot project file (ZIP archive)
/// Takes ProjectData with metadata and screenshot bytes
#[tauri::command]
pub async fn write_project(path: String, data: ProjectData) -> Result<String, String> {
    let path = PathBuf::from(&path);

    // Ensure .bshot extension
    let path = if path.extension().map(|e| e.to_str()) != Some(Some("bshot")) {
        path.with_extension("bshot")
    } else {
        path
    };

    // Canonicalize parent directory
    let canonical_path = if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
        let canonical_parent = parent
            .canonicalize()
            .map_err(|e| format!("Invalid path: {}", e))?;
        if let Some(filename) = path.file_name() {
            canonical_parent.join(filename)
        } else {
            return Err("Invalid filename".to_string());
        }
    } else {
        return Err("Invalid path: no parent directory".to_string());
    };

    // Build ZIP archive in memory
    let mut zip_buffer = Cursor::new(Vec::new());
    {
        let mut zip_writer = zip::ZipWriter::new(&mut zip_buffer);

        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        // Write project.json
        let json_str = serde_json::to_string_pretty(&data.metadata)
            .map_err(|e| format!("Failed to serialize project metadata: {}", e))?;
        zip_writer.start_file("project.json", options)
            .map_err(|e| format!("Failed to write project.json header: {}", e))?;
        zip_writer.write_all(json_str.as_bytes())
            .map_err(|e| format!("Failed to write project.json content: {}", e))?;

        // Write screenshot.png
        zip_writer.start_file("screenshot.png", options)
            .map_err(|e| format!("Failed to write screenshot.png header: {}", e))?;
        zip_writer.write_all(&data.screenshot_bytes)
            .map_err(|e| format!("Failed to write screenshot.png content: {}", e))?;

        zip_writer.finish()
            .map_err(|e| format!("Failed to finalize ZIP archive: {}", e))?;
    }

    let zip_bytes = zip_buffer.into_inner();

    // Enforce size limit
    if zip_bytes.len() > MAX_FILE_SIZE {
        return Err(format!(
            "Project file size ({} MB) exceeds maximum allowed ({} MB)",
            zip_bytes.len() / (1024 * 1024),
            MAX_FILE_SIZE / (1024 * 1024)
        ));
    }

    fs::write(&canonical_path, &zip_bytes)
        .map_err(|e| format!("Failed to save project file: {}", e))?;

    Ok(canonical_path.to_string_lossy().to_string())
}

/// Delete a file — move to system trash or permanently delete
#[tauri::command]
pub async fn delete_file(path: String, move_to_trash: bool) -> Result<(), String> {
    let path = PathBuf::from(&path);

    // Validate file exists
    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    if move_to_trash {
        trash::delete(&path)
            .map_err(|e| format!("Failed to move to trash: {}", e))?;
    } else {
        fs::remove_file(&path)
            .map_err(|e| format!("Failed to delete file: {}", e))?;
    }

    Ok(())
}
```

- [ ] **Step 2: Register new commands in `lib.rs`**

In `src-tauri/src/lib.rs`, the `invoke_handler` block (around line 138-167) needs three new entries. Find this section:

```rust
            file_ops::save_file,
            file_ops::get_pictures_dir,
            file_ops::get_desktop_dir,
```

Replace with:

```rust
            file_ops::save_file,
            file_ops::get_pictures_dir,
            file_ops::get_desktop_dir,
            file_ops::read_project,
            file_ops::write_project,
            file_ops::delete_file,
```

- [ ] **Step 3: Verify build**

Run: `cd src-tauri && cargo build 2>&1 | tail -5`
Expected: `Finished` with no errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/file_ops.rs src-tauri/src/lib.rs
git commit -m "feat: add read_project, write_project, delete_file Rust commands"
```
