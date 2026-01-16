// Overlay window management for region selection
// Captures screenshot first, then shows overlay with screenshot as background

use base64::{engine::general_purpose::STANDARD, Engine};
use image::codecs::png::{CompressionType, FilterType, PngEncoder};
use image::ImageEncoder;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use xcap::Monitor;

// Store screenshot data for overlay background
static OVERLAY_SCREENSHOT: Mutex<Option<String>> = Mutex::new(None);

/// Wait for Windows DWM animation to complete
#[cfg(target_os = "windows")]
fn wait_for_dwm_animation() {
    for _ in 0..10 {
        unsafe {
            let _ = windows::Win32::Graphics::Dwm::DwmFlush();
        }
        thread::sleep(Duration::from_millis(10));
    }
}

/// Capture screenshot and convert to base64 (optimized for speed)
fn capture_for_overlay() -> Result<String, String> {
    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    let primary = monitors
        .into_iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .ok_or("No primary monitor found")?;

    let image = primary.capture_image().map_err(|e| e.to_string())?;

    let width = image.width();
    let height = image.height();

    if width == 0 || height == 0 {
        return Err("Screen recording permission not granted".to_string());
    }

    // Fast PNG encoding
    let estimated_size = (width * height * 4) as usize + 1024;
    let mut bytes: Vec<u8> = Vec::with_capacity(estimated_size);
    let encoder =
        PngEncoder::new_with_quality(&mut bytes, CompressionType::Fast, FilterType::NoFilter);
    encoder
        .write_image(
            image.as_raw(),
            width,
            height,
            image::ExtendedColorType::Rgba8,
        )
        .map_err(|e| e.to_string())?;

    Ok(STANDARD.encode(&bytes))
}

/// Show overlay window for region selection
#[tauri::command]
pub async fn show_overlay_window(app: AppHandle) -> Result<(), String> {
    // Hide main window first
    if let Some(main_window) = app.get_webview_window("main") {
        let _ = main_window.hide();
    }

    // Wait for window hide animation
    #[cfg(target_os = "windows")]
    wait_for_dwm_animation();

    #[cfg(not(target_os = "windows"))]
    thread::sleep(Duration::from_millis(50));

    // Capture screenshot
    let screenshot_base64 = capture_for_overlay()?;

    // Store screenshot
    {
        let mut data = OVERLAY_SCREENSHOT
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        *data = Some(screenshot_base64);
    }

    // Get or create overlay window
    let window = match app.get_webview_window("region-overlay") {
        Some(w) => w,
        None => {
            WebviewWindowBuilder::new(
                &app,
                "region-overlay",
                WebviewUrl::App("overlay.html".into()),
            )
            .title("")
            .fullscreen(true)
            .decorations(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .focused(true)
            .closable(true)
            .resizable(false)
            .visible(false)
            .build()
            .map_err(|e| {
                // Clear screenshot on failure
                let mut data = OVERLAY_SCREENSHOT
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner());
                *data = None;
                format!("{}", e)
            })?
        }
    };

    let _ = window.set_fullscreen(true);
    let _ = window.emit("overlay-activate", ());

    Ok(())
}

/// Hide overlay window
#[tauri::command]
pub async fn hide_overlay_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("region-overlay") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Get stored screenshot data
#[tauri::command]
pub fn get_screenshot_data() -> Option<String> {
    let data = OVERLAY_SCREENSHOT
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    data.clone()
}

/// Clear stored screenshot data
#[tauri::command]
pub fn clear_screenshot_data() {
    let mut data = OVERLAY_SCREENSHOT
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    *data = None;
}

// Compatibility aliases
#[tauri::command]
pub async fn create_overlay_window(app: AppHandle) -> Result<(), String> {
    show_overlay_window(app).await
}

#[tauri::command]
pub async fn close_overlay_window(app: AppHandle) -> Result<(), String> {
    hide_overlay_window(app).await
}
