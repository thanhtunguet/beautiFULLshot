// Screenshot capture module using xcap crate
// Provides fullscreen, region, and window capture functionality
// On Linux Wayland, capture goes through the desktop's own API (see linux_capture.rs)
// Supports multi-monitor capture with cursor-based monitor detection

use base64::{engine::general_purpose::STANDARD, Engine};
use image::codecs::png::{CompressionType, FilterType, PngEncoder};
use image::{ImageEncoder, RgbaImage};
use mouse_position::mouse_position::Mouse;
use serde::{Deserialize, Serialize};
use xcap::{Monitor, Window as XcapWindow};

#[cfg(target_os = "linux")]
use crate::{
    linux_capture,
    linux_env::{self, SessionType},
};

#[derive(Debug, Serialize, Deserialize)]
pub struct MonitorInfo {
    pub id: u32,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub is_primary: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WindowInfo {
    pub id: u32,
    pub app_name: String,
    pub title: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// Pick the primary monitor. XWayland and some X servers mark none as primary,
/// so fall back to the first monitor instead of failing the capture.
fn pick_primary(monitors: Vec<Monitor>) -> Option<Monitor> {
    let index = monitors
        .iter()
        .position(|m| m.is_primary().unwrap_or(false))
        .unwrap_or(0);
    monitors.into_iter().nth(index)
}

/// Capture one monitor as an image
#[cfg(not(target_os = "linux"))]
pub(crate) fn capture_monitor_image(monitor: &Monitor) -> Result<RgbaImage, String> {
    monitor.capture_image().map_err(|e| e.to_string())
}

/// Capture one monitor as an image.
/// X11 uses xcap. Wayland has no common API, so the whole desktop is captured through the
/// desktop's own mechanism (portal, spectacle, grim, ...) and cropped to the monitor.
#[cfg(target_os = "linux")]
pub(crate) fn capture_monitor_image(monitor: &Monitor) -> Result<RgbaImage, String> {
    let env = linux_env::current();

    if env.session == SessionType::Wayland {
        return match linux_capture::capture_desktop(env) {
            Ok(desktop) => Ok(crop_to_monitor(desktop, monitor)),
            // wlroots-style compositors: xcap's wlr-screencopy may still work
            Err(chain_error) if linux_capture::xcap_wayland_fallback_useful(env) => monitor
                .capture_image()
                .map_err(|e| format!("{} xcap: {}", chain_error, e)),
            Err(chain_error) => Err(chain_error),
        };
    }

    let xcap_error = match monitor.capture_image() {
        Ok(image) if image.width() > 0 && image.height() > 0 => return Ok(image),
        Ok(_) => "empty image".to_string(),
        Err(e) => e.to_string(),
    };
    eprintln!("[capture] xcap failed on X11: {}", xcap_error);
    // Rare on X11 (no XRandR, odd server): fall back to screenshot tools
    linux_capture::capture_desktop(env)
        .map(|desktop| crop_to_monitor(desktop, monitor))
        .map_err(|e| format!("xcap: {}. {}", xcap_error, e))
}

#[cfg(target_os = "linux")]
fn crop_to_monitor(desktop: RgbaImage, monitor: &Monitor) -> RgbaImage {
    let rect = |m: &Monitor| linux_capture::Rect {
        x: m.x().unwrap_or(0),
        y: m.y().unwrap_or(0),
        width: m.width().unwrap_or(0),
        height: m.height().unwrap_or(0),
    };
    let all: Vec<_> = Monitor::all()
        .map(|monitors| monitors.iter().map(rect).collect())
        .unwrap_or_default();
    linux_capture::crop_monitor(desktop, rect(monitor), &all)
}

/// Capture the primary monitor
fn capture_primary_image() -> Result<RgbaImage, String> {
    let monitors = match Monitor::all() {
        Ok(monitors) => monitors,
        Err(e) => return capture_without_monitor_list(e.to_string()),
    };
    let primary = pick_primary(monitors).ok_or("No primary monitor found")?;
    let image = capture_monitor_image(&primary)?;

    // Verify we got a valid image
    if image.width() == 0 || image.height() == 0 {
        return Err("Screen recording permission not granted".to_string());
    }
    Ok(image)
}

/// Pure Wayland without XWayland: xcap cannot list monitors, but the desktop API still works
#[cfg(target_os = "linux")]
fn capture_without_monitor_list(reason: String) -> Result<RgbaImage, String> {
    let env = linux_env::current();
    if env.session == SessionType::Wayland {
        linux_capture::capture_desktop(env)
    } else {
        Err(reason)
    }
}

#[cfg(not(target_os = "linux"))]
fn capture_without_monitor_list(reason: String) -> Result<RgbaImage, String> {
    Err(reason)
}

/// Crop an image to the requested region (clamped to the image) and encode it
fn crop_region_to_base64(
    image: &RgbaImage,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<String, String> {
    // Validate region bounds
    let start_x = x.max(0) as u32;
    let start_y = y.max(0) as u32;
    let crop_width = width.min(image.width().saturating_sub(start_x));
    let crop_height = height.min(image.height().saturating_sub(start_y));

    if crop_width == 0 || crop_height == 0 {
        return Err("Invalid region dimensions".to_string());
    }

    let cropped = image::imageops::crop_imm(image, start_x, start_y, crop_width, crop_height).to_image();
    image_to_base64_png(&cropped)
}

/// Convert RgbaImage to base64-encoded PNG string (maximum speed)
fn image_to_base64_png(img: &image::RgbaImage) -> Result<String, String> {
    // Pre-allocate buffer for speed (estimate: width * height * 4 bytes + overhead)
    let estimated_size = (img.width() * img.height() * 4) as usize + 1024;
    let mut bytes: Vec<u8> = Vec::with_capacity(estimated_size);
    // NoFilter = fastest encoding (no per-row analysis), Fast compression
    let encoder = PngEncoder::new_with_quality(&mut bytes, CompressionType::Fast, FilterType::NoFilter);
    encoder
        .write_image(
            img.as_raw(),
            img.width(),
            img.height(),
            image::ExtendedColorType::Rgba8,
        )
        .map_err(|e| e.to_string())?;
    Ok(STANDARD.encode(&bytes))
}

/// Capture primary monitor - returns base64-encoded PNG
#[tauri::command]
pub fn capture_fullscreen() -> Result<String, String> {
    image_to_base64_png(&capture_primary_image()?)
}

/// Capture specific region from primary monitor - returns base64-encoded PNG
#[tauri::command]
pub fn capture_region(x: i32, y: i32, width: u32, height: u32) -> Result<String, String> {
    crop_region_to_base64(&capture_primary_image()?, x, y, width, height)
}

/// Minimum window size to filter out icons and tiny windows
const MIN_WINDOW_SIZE: u32 = 100;

/// Get list of capturable windows
#[tauri::command]
pub fn get_windows() -> Result<Vec<WindowInfo>, String> {
    let windows = XcapWindow::all().map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for w in windows {
        let title = w.title().unwrap_or_default();
        let width = w.width().unwrap_or(0);
        let height = w.height().unwrap_or(0);

        // Skip windows with empty title or too small (icons, menu items, etc.)
        if title.is_empty() || width < MIN_WINDOW_SIZE || height < MIN_WINDOW_SIZE {
            continue;
        }
        result.push(WindowInfo {
            id: w.id().unwrap_or(0),
            app_name: w.app_name().unwrap_or_default(),
            title,
            x: w.x().unwrap_or(0),
            y: w.y().unwrap_or(0),
            width,
            height,
        });
    }
    Ok(result)
}

/// Capture window thumbnail (small preview) - returns base64-encoded PNG
#[tauri::command]
pub fn get_window_thumbnail(window_id: u32, max_size: u32) -> Result<String, String> {
    let windows = XcapWindow::all().map_err(|e| e.to_string())?;
    let window = windows
        .into_iter()
        .find(|w| w.id().unwrap_or(0) == window_id)
        .ok_or("Window not found")?;

    let image = window.capture_image().map_err(|e| e.to_string())?;

    // Resize to thumbnail
    let (width, height) = (image.width(), image.height());
    let (new_width, new_height) = if width > height {
        let ratio = max_size as f32 / width as f32;
        (max_size, (height as f32 * ratio) as u32)
    } else {
        let ratio = max_size as f32 / height as f32;
        ((width as f32 * ratio) as u32, max_size)
    };

    let thumbnail = image::imageops::resize(&image, new_width, new_height, image::imageops::FilterType::Lanczos3);
    image_to_base64_png(&thumbnail)
}

/// Capture specific window by ID - returns base64-encoded PNG
#[tauri::command]
pub fn capture_window(window_id: u32) -> Result<String, String> {
    let windows = XcapWindow::all().map_err(|e| e.to_string())?;
    let window = windows
        .into_iter()
        .find(|w| w.id().unwrap_or(0) == window_id)
        .ok_or("Window not found")?;

    let image = window.capture_image().map_err(|e| e.to_string())?;
    image_to_base64_png(&image)
}

/// Get monitor list
#[tauri::command]
pub fn get_monitors() -> Result<Vec<MonitorInfo>, String> {
    let monitors = Monitor::all().map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for m in monitors {
        result.push(MonitorInfo {
            id: m.id().unwrap_or(0),
            name: m.name().unwrap_or_default(),
            width: m.width().unwrap_or(0),
            height: m.height().unwrap_or(0),
            x: m.x().unwrap_or(0),
            y: m.y().unwrap_or(0),
            is_primary: m.is_primary().unwrap_or(false),
        });
    }
    Ok(result)
}

/// Get current cursor position
fn get_cursor_position() -> Option<(i32, i32)> {
    match Mouse::get_mouse_position() {
        Mouse::Position { x, y } => Some((x, y)),
        Mouse::Error => None,
    }
}

/// Find monitor containing the given point
fn find_monitor_at_point(monitors: &[Monitor], x: i32, y: i32) -> Option<&Monitor> {
    monitors.iter().find(|m| {
        let mx = m.x().unwrap_or(0);
        let my = m.y().unwrap_or(0);
        let mw = m.width().unwrap_or(0) as i32;
        let mh = m.height().unwrap_or(0) as i32;
        x >= mx && x < mx + mw && y >= my && y < my + mh
    })
}

/// Get the monitor where cursor is currently located
#[tauri::command]
pub fn get_cursor_monitor() -> Result<MonitorInfo, String> {
    let monitors = Monitor::all().map_err(|e| e.to_string())?;

    let (cx, cy) = get_cursor_position().ok_or("Failed to get cursor position")?;

    let monitor = find_monitor_at_point(&monitors, cx, cy)
        .or_else(|| monitors.iter().find(|m| m.is_primary().unwrap_or(false)))
        .ok_or("No monitor found")?;

    Ok(MonitorInfo {
        id: monitor.id().unwrap_or(0),
        name: monitor.name().unwrap_or_default(),
        width: monitor.width().unwrap_or(0),
        height: monitor.height().unwrap_or(0),
        x: monitor.x().unwrap_or(0),
        y: monitor.y().unwrap_or(0),
        is_primary: monitor.is_primary().unwrap_or(false),
    })
}

/// Capture specific monitor by ID - returns base64-encoded PNG
#[tauri::command]
pub fn capture_monitor(monitor_id: u32) -> Result<String, String> {
    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    let monitor = monitors
        .into_iter()
        .find(|m| m.id().unwrap_or(0) == monitor_id)
        .ok_or("Monitor not found")?;

    let image = capture_monitor_image(&monitor)?;

    if image.width() == 0 || image.height() == 0 {
        return Err("Screen recording permission not granted".to_string());
    }

    image_to_base64_png(&image)
}

/// Capture specific region from a specific monitor - returns base64-encoded PNG
/// Coordinates are relative to the monitor's origin
#[tauri::command]
pub fn capture_region_from_monitor(
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    monitor_id: u32,
) -> Result<String, String> {
    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    let monitor = monitors
        .into_iter()
        .find(|m| m.id().unwrap_or(0) == monitor_id)
        .ok_or("Monitor not found")?;

    let image = capture_monitor_image(&monitor)?;
    crop_region_to_base64(&image, x, y, width, height)
}
