// Overlay window management for region selection
// Creates and manages transparent fullscreen overlay for interactive region capture

use serde::Serialize;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Debug, Serialize)]
pub struct MonitorBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
}

/// Create fullscreen transparent overlay window for region selection
#[tauri::command]
pub async fn create_overlay_window(app: AppHandle) -> Result<(), String> {
    // Get primary monitor dimensions
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    let primary = monitors
        .iter()
        .find(|m| m.name().map(|n| n.contains("primary")).unwrap_or(false))
        .or_else(|| monitors.first())
        .ok_or("No monitor found")?;

    let size = primary.size();
    let position = primary.position();

    // Create overlay window
    WebviewWindowBuilder::new(&app, "region-overlay", WebviewUrl::App("overlay.html".into()))
        .title("Region Selection")
        .inner_size(size.width as f64, size.height as f64)
        .position(position.x as f64, position.y as f64)
        .fullscreen(false) // Manual fullscreen via size
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(true)
        .resizable(false)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Close overlay window
#[tauri::command]
pub async fn close_overlay_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("region-overlay") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Get primary monitor info for overlay sizing and DPI calculations
#[tauri::command]
pub fn get_primary_monitor_info(app: AppHandle) -> Result<MonitorBounds, String> {
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    let primary = monitors
        .iter()
        .find(|m| m.name().map(|n| n.contains("primary")).unwrap_or(false))
        .or_else(|| monitors.first())
        .ok_or("No monitor found")?;

    let size = primary.size();
    let position = primary.position();
    let scale = primary.scale_factor();

    Ok(MonitorBounds {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        scale_factor: scale,
    })
}
