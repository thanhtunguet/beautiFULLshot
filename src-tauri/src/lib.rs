// BeautyFullShot - Screenshot Beautification App
// Tauri commands: https://tauri.app/develop/calling-rust/

use tauri::{Manager, RunEvent, WindowEvent};

mod clipboard;
mod file_ops;
mod overlay;
mod permissions;
mod screenshot;
mod shortcuts;
mod tray;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Create system tray
            tray::create_tray(app.handle())?;

            // Note: Overlay window is created on-demand when needed
            // to avoid fullscreen white screen at startup

            Ok(())
        })
        .on_window_event(|window, event| {
            // Intercept close request on main window - hide instead of quit
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    // Prevent default close behavior
                    api.prevent_close();
                    // Hide window instead
                    let _ = window.hide();

                    // On macOS, also hide from dock when window is hidden
                    #[cfg(target_os = "macos")]
                    {
                        let app = window.app_handle();
                        let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            screenshot::capture_fullscreen,
            screenshot::capture_region,
            screenshot::capture_window,
            screenshot::get_windows,
            screenshot::get_window_thumbnail,
            screenshot::get_monitors,
            permissions::check_screen_permission,
            permissions::check_accessibility_permission,
            permissions::request_accessibility_permission,
            permissions::request_screen_permission,
            permissions::check_wayland,
            permissions::open_screen_recording_settings,
            permissions::open_accessibility_settings,
            file_ops::save_file,
            file_ops::get_pictures_dir,
            file_ops::get_desktop_dir,
            shortcuts::update_shortcuts,
            overlay::create_overlay_window,
            overlay::close_overlay_window,
            overlay::get_screenshot_data,
            overlay::clear_screenshot_data,
            clipboard::copy_image_to_clipboard,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {
            // Handle macOS dock click to reopen window
            #[cfg(target_os = "macos")]
            if let RunEvent::Reopen { .. } = _event {
                // Restore dock icon
                let _ = _app.set_activation_policy(tauri::ActivationPolicy::Regular);

                if let Some(window) = _app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        });
}
