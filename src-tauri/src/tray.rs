// System tray - tray icon and menu for BeautyShot

use std::sync::atomic::Ordering;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime,
};

use crate::SHOULD_QUIT;

/// Creates and configures the system tray icon with menu
pub fn create_tray<R: Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    // Capture menu items
    let capture_screen = MenuItem::with_id(app, "capture_screen", "Capture Screen", true, None::<&str>)?;
    let capture_region = MenuItem::with_id(app, "capture_region", "Capture Region", true, None::<&str>)?;
    let capture_window = MenuItem::with_id(app, "capture_window", "Capture Window", true, None::<&str>)?;
    let separator1 = PredefinedMenuItem::separator(app)?;
    let show_item = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
    let separator2 = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit beautiFULLshot", true, None::<&str>)?;

    // Build menu
    let menu = Menu::with_items(app, &[
        &capture_screen,
        &capture_region,
        &capture_window,
        &separator1,
        &show_item,
        &separator2,
        &quit_item,
    ])?;

    // Get app icon for tray
    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| tauri::Error::AssetNotFound("default window icon".to_string()))?;

    // Build tray icon
    let _tray = TrayIconBuilder::<R>::new()
        .icon(icon.clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("beautiFULLshot")
        // macOS: don't use template mode so colorful icons display correctly
        .icon_as_template(false)
        .on_menu_event(|app: &AppHandle<R>, event| match event.id.as_ref() {
            "quit" => {
                // Set flag so ExitRequested handler allows quit
                SHOULD_QUIT.store(true, Ordering::SeqCst);
                app.exit(0);
            }
            "show" => {
                // On macOS, restore dock icon before showing window
                #[cfg(target_os = "macos")]
                let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);

                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            "capture_screen" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("tray-capture-screen", ());
                }
            }
            "capture_region" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("tray-capture-region", ());
                }
            }
            "capture_window" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("tray-capture-window", ());
                }
            }
            _ => {}
        })
        .on_tray_icon_event(|tray: &TrayIcon<R>, event| {
            // Left click on tray icon shows window
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();

                // On macOS, restore dock icon before showing window
                #[cfg(target_os = "macos")]
                let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);

                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
