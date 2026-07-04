// BeautyFullShot - Screenshot Beautification App
// Tauri commands: https://tauri.app/develop/calling-rust/

use std::sync::atomic::AtomicBool;
#[cfg(target_os = "macos")]
use std::sync::atomic::Ordering;
use tauri::{Emitter, WindowEvent};
#[cfg(target_os = "macos")]
use tauri::{Manager, RunEvent};

#[cfg(target_os = "macos")]
use tauri::menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};

/// Global flag to track if app should actually quit (from tray menu)
/// vs just hide to tray (from Cmd+Q or window close)
pub static SHOULD_QUIT: AtomicBool = AtomicBool::new(false);

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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Create system tray
            tray::create_tray(app.handle())?;

            // On macOS, create custom app menu to override Cmd+Q behavior
            #[cfg(target_os = "macos")]
            {
                let handle = app.handle();

                // Create "Hide" menu item with Cmd+Q shortcut (replaces default Quit)
                let hide_item = MenuItemBuilder::with_id("hide_to_tray", "Hide to Tray")
                    .accelerator("CmdOrCtrl+Q")
                    .build(handle)?;

                // About metadata with author and links
                // Note: icon is loaded from bundle automatically on macOS
                let about_metadata = AboutMetadata {
                    name: Some("beautiFULLshot".into()),
                    version: Some(env!("CARGO_PKG_VERSION").into()),
                    copyright: Some("© 2025 itsddvn".into()),
                    authors: Some(vec!["itsddvn".into()]),
                    website: Some("https://beautifullshot.itsdd.vn".into()),
                    website_label: Some("beautifullshot.itsdd.vn".into()),
                    ..Default::default()
                };

                // Create app submenu (first menu on macOS)
                let app_submenu = SubmenuBuilder::new(handle, "beautiFULLshot")
                    .item(&PredefinedMenuItem::about(handle, Some("About beautiFULLshot"), Some(about_metadata))?)
                    .separator()
                    .item(&hide_item)
                    .separator()
                    .item(&PredefinedMenuItem::hide(handle, Some("Hide"))?)
                    .item(&PredefinedMenuItem::hide_others(handle, Some("Hide Others"))?)
                    .item(&PredefinedMenuItem::show_all(handle, Some("Show All"))?)
                    .build()?;

                // Create File submenu
                let file_open = MenuItemBuilder::with_id("file_open", "Open...")
                    .accelerator("CmdOrCtrl+O")
                    .build(handle)?;
                let file_save = MenuItemBuilder::with_id("file_save", "Save")
                    .accelerator("CmdOrCtrl+S")
                    .build(handle)?;
                let file_export = MenuItemBuilder::with_id("file_export", "Export...")
                    .accelerator("CmdOrCtrl+Shift+E")
                    .build(handle)?;
                let file_close = MenuItemBuilder::with_id("file_close", "Close Screenshot")
                    .build(handle)?;
                let file_delete = MenuItemBuilder::with_id("file_delete", "Delete Current Project")
                    .build(handle)?;

                let file_submenu = SubmenuBuilder::new(handle, "File")
                    .item(&file_open)
                    .item(&file_save)
                    .item(&file_export)
                    .separator()
                    .item(&file_close)
                    .item(&file_delete)
                    .build()?;

                // Create Edit submenu for standard text editing shortcuts
                let edit_submenu = SubmenuBuilder::new(handle, "Edit")
                    .item(&PredefinedMenuItem::undo(handle, Some("Undo"))?)
                    .item(&PredefinedMenuItem::redo(handle, Some("Redo"))?)
                    .separator()
                    .item(&PredefinedMenuItem::cut(handle, Some("Cut"))?)
                    .item(&PredefinedMenuItem::copy(handle, Some("Copy"))?)
                    .item(&PredefinedMenuItem::paste(handle, Some("Paste"))?)
                    .item(&PredefinedMenuItem::select_all(handle, Some("Select All"))?)
                    .build()?;

                // Create Window submenu
                let window_submenu = SubmenuBuilder::new(handle, "Window")
                    .item(&PredefinedMenuItem::minimize(handle, Some("Minimize"))?)
                    .item(&PredefinedMenuItem::maximize(handle, Some("Zoom"))?)
                    .separator()
                    .item(&PredefinedMenuItem::close_window(handle, Some("Close"))?)
                    .build()?;

                // Build and set the menu
                let menu = MenuBuilder::new(handle)
                    .item(&app_submenu)
                    .item(&file_submenu)
                    .item(&edit_submenu)
                    .item(&window_submenu)
                    .build()?;

                app.set_menu(menu)?;

                // Handle custom menu events
                let handle_clone = handle.clone();
                app.on_menu_event(move |_app, event| {
                    let event_id = event.id().as_ref();
                    match event_id {
                        "hide_to_tray" => {
                            if let Some(window) = handle_clone.get_webview_window("main") {
                                let _ = window.hide();
                            }
                            let _ = handle_clone.set_activation_policy(tauri::ActivationPolicy::Accessory);
                        }
                        // File menu events — forward to frontend
                        "file_open" | "file_save" | "file_export"
                        | "file_close" | "file_delete" => {
                            if let Some(window) = handle_clone.get_webview_window("main") {
                                let frontend_event = format!("menu-{}", event_id.replace('_', "-"));
                                let _ = window.emit(&frontend_event, ());
                            }
                        }
                        _ => {}
                    }
                });
            }

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
            screenshot::get_cursor_monitor,
            screenshot::capture_monitor,
            screenshot::capture_region_from_monitor,
            permissions::check_screen_permission,
            permissions::check_accessibility_permission,
            permissions::request_accessibility_permission,
            permissions::request_screen_permission,
            permissions::check_wayland,
            permissions::open_screen_recording_settings,
            permissions::open_accessibility_settings,
            file_ops::save_file,
            file_ops::get_project_dir,
            file_ops::read_project,
            file_ops::write_project,
            file_ops::delete_file,
            file_ops::read_binary_file,
            shortcuts::update_shortcuts,
            overlay::create_overlay_window,
            overlay::close_overlay_window,
            overlay::show_overlay_window_on_monitor,
            overlay::get_overlay_monitor,
            overlay::capture_and_show_overlay,
            overlay::get_screenshot_data,
            overlay::clear_screenshot_data,
            clipboard::copy_image_to_clipboard,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| {
            match &event {
                // Handle Cmd+Q (macOS) - hide to tray instead of quit
                // Unless SHOULD_QUIT flag is set (from tray menu quit)
                #[cfg(target_os = "macos")]
                RunEvent::ExitRequested { api, .. } => {
                    // Check if we should actually quit (set by tray menu)
                    if SHOULD_QUIT.load(Ordering::SeqCst) {
                        // Allow exit - don't call prevent_exit()
                        return;
                    }

                    // Prevent app from quitting (hide to tray instead)
                    api.prevent_exit();

                    // Hide main window to tray
                    if let Some(window) = _app.get_webview_window("main") {
                        let _ = window.hide();
                    }

                    // Hide from dock
                    let _ = _app.set_activation_policy(tauri::ActivationPolicy::Accessory);
                }

                // Handle macOS dock click to reopen window
                #[cfg(target_os = "macos")]
                RunEvent::Reopen { .. } => {
                    // Restore dock icon
                    let _ = _app.set_activation_policy(tauri::ActivationPolicy::Regular);

                    if let Some(window) = _app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                }

                _ => {}
            }
        });
}
