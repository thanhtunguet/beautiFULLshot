use std::sync::{LazyLock, Mutex};

use tauri::{Emitter, Manager};

/// Startup file-open requests captured from CLI args before frontend listeners are ready.
static STARTUP_OPEN_PATHS: LazyLock<Mutex<Vec<String>>> =
    LazyLock::new(|| Mutex::new(Vec::new()));

const APP_OPEN_FILE_EVENT: &str = "app-open-file";

fn is_supported_open_path(path: &str) -> bool {
    let lower = path.to_lowercase();
    lower.ends_with(".bshot")
        || lower.ends_with(".png")
        || lower.ends_with(".jpg")
        || lower.ends_with(".jpeg")
        || lower.ends_with(".webp")
        || lower.ends_with(".gif")
        || lower.ends_with(".bmp")
        || lower.ends_with(".tif")
        || lower.ends_with(".tiff")
        || lower.ends_with(".svg")
}

pub fn queue_startup_open_path(path: String) {
    if !is_supported_open_path(&path) {
        return;
    }

    if let Ok(mut pending) = STARTUP_OPEN_PATHS.lock() {
        pending.push(path);
    }
}

pub fn emit_open_file_event(app: &tauri::AppHandle, path: String) {
    if !is_supported_open_path(&path) {
        return;
    }

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit(APP_OPEN_FILE_EVENT, path);
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();

        #[cfg(target_os = "macos")]
        {
            let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
        }
    }
}

#[tauri::command]
pub fn take_startup_open_paths() -> Vec<String> {
    if let Ok(mut pending) = STARTUP_OPEN_PATHS.lock() {
        let paths = pending.clone();
        pending.clear();
        return paths;
    }

    Vec::new()
}
