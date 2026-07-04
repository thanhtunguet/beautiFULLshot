// File operations for beautiFULLshot export and project system

use std::fs;
use std::io::{Cursor, Read, Write};
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

/// Maximum file size limit (50MB) - prevents DoS from excessively large exports
const MAX_FILE_SIZE: usize = 50 * 1024 * 1024;

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
    pub annotations: serde_json::Value,
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
    if data.len() > MAX_FILE_SIZE {
        return Err(format!(
            "File size ({} MB) exceeds maximum allowed ({} MB)",
            data.len() / (1024 * 1024),
            MAX_FILE_SIZE / (1024 * 1024)
        ));
    }

    let path = PathBuf::from(&path);
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
#[tauri::command]
pub async fn read_project(path: String) -> Result<ProjectData, String> {
    let file_bytes = fs::read(&path)
        .map_err(|e| format!("Could not open project file: {}", e))?;

    let cursor = Cursor::new(file_bytes);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|e| format!("Invalid project file (not a valid ZIP): {}", e))?;

    let metadata: ProjectMetadata = {
        let mut file = archive.by_name("project.json")
            .map_err(|_| "Project file is missing project.json".to_string())?;
        let mut contents = String::new();
        file.read_to_string(&mut contents)
            .map_err(|e| format!("Failed to read project.json: {}", e))?;
        serde_json::from_str(&contents)
            .map_err(|e| format!("Failed to parse project.json: {}", e))?
    };

    let screenshot_bytes: Vec<u8> = {
        let mut file = archive.by_name("screenshot.png")
            .map_err(|_| "Project file is missing screenshot.png".to_string())?;
        let mut buf = Vec::new();
        file.read_to_end(&mut buf)
            .map_err(|e| format!("Failed to read screenshot.png: {}", e))?;
        buf
    };

    Ok(ProjectData { metadata, screenshot_bytes })
}

/// Write a .bshot project file (ZIP archive)
#[tauri::command]
pub async fn write_project(
    path: String,
    metadata: ProjectMetadata,
    screenshot_bytes: Vec<u8>,
) -> Result<String, String> {
    let path = PathBuf::from(&path);

    let path = if path.extension().map(|e| e.to_str()) != Some(Some("bshot")) {
        path.with_extension("bshot")
    } else {
        path
    };

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

        zip_writer.finish()
            .map_err(|e| format!("Failed to finalize ZIP archive: {}", e))?;
    }

    let zip_bytes = zip_buffer.into_inner();

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

/// Read a binary file from disk (used for opening image files via File > Open)
#[tauri::command]
pub async fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    let file_bytes = fs::read(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    if file_bytes.len() > MAX_FILE_SIZE {
        return Err(format!(
            "File size ({} MB) exceeds maximum allowed ({} MB)",
            file_bytes.len() / (1024 * 1024),
            MAX_FILE_SIZE / (1024 * 1024)
        ));
    }

    Ok(file_bytes)
}

/// Delete a file — move to system trash or permanently delete
#[tauri::command]
pub async fn delete_file(path: String, move_to_trash: bool) -> Result<(), String> {
    let path = PathBuf::from(&path);

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
