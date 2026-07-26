// BeautyFullShot - Screenshot Beautification App
// Tauri commands: https://tauri.app/develop/calling-rust/

use std::sync::atomic::AtomicBool;
#[cfg(target_os = "macos")]
use std::sync::atomic::Ordering;
use std::sync::Mutex;
use tauri::{DragDropEvent, Emitter, Manager, WebviewEvent, WindowEvent};
#[cfg(target_os = "macos")]
use tauri::RunEvent;

/// Path of a .bshot file passed to the app at launch (CLI arg on Windows/Linux,
/// Apple Events on macOS). The frontend reads this once via get_startup_file()
/// after it is ready. Wrapped in Mutex so it is safe to write from the run()
/// event loop and read from a Tauri command on any thread.
static STARTUP_FILE: Mutex<Option<String>> = Mutex::new(None);

/// Payload for the `files-dropped` event. Carries the single path the app will
/// open plus enough context for the frontend to explain what happened to the
/// rest, rather than silently ignoring them.
#[derive(Clone, serde::Serialize)]
struct FilesDropped {
    /// The granted path to open, or None when nothing droppable was found.
    path: Option<String>,
    /// How many additional files were dropped and skipped.
    ignored: usize,
    /// True when files were dropped but none had a supported extension.
    unsupported: bool,
}

/// Whether `path` names an existing `.bshot` file. Extension matching is
/// case-insensitive and goes through the same helper the read commands use —
/// a plain `ends_with(".bshot")` would miss `Project.BSHOT` on the
/// case-insensitive filesystems (APFS, NTFS) where double-clicking such a
/// file is exactly how this code gets called, and would accept a bare
/// `.bshot` dotfile that the read path then rejects.
fn is_bshot_file(path: &std::path::Path) -> bool {
    file_ops::has_bshot_extension(path) && path.is_file()
}

/// Store a file path if it is a .bshot file that exists on disk. Returns
/// whether the path was accepted, so the caller knows to issue a matching
/// read grant.
fn store_startup_file(path: &std::path::Path) -> bool {
    if !is_bshot_file(path) {
        return false;
    }
    // Tolerate poisoning rather than silently dropping the open: the value is
    // a single Option<String> with no invariant a partial write could break.
    let mut guard = STARTUP_FILE.lock().unwrap_or_else(|p| p.into_inner());
    *guard = Some(path.to_string_lossy().into_owned());
    true
}

/// Called by the frontend once it is ready. Consumes and returns the startup
/// file path (if any), so a second call returns None.
///
/// The read grant is issued *here*, not when the path was stored. Granting at
/// launch meant the clock started before the frontend could possibly redeem
/// it: an app sitting on the permissions screen would strand the grant until
/// it expired, and any attempt to clean that up races the legitimate open
/// (both would have to consume the same one-shot value). Issuing the grant at
/// the moment the frontend takes the path removes the window entirely.
///
/// This stays trusted-side: the path comes from `STARTUP_FILE`, which only
/// Rust writes, from an OS event. The renderer cannot influence which path it
/// gets — only whether it asks.
#[tauri::command]
fn get_startup_file(state: tauri::State<file_ops::AppState>) -> Option<String> {
    take_startup_file(&state)
}

/// Body of `get_startup_file`, taking `&AppState` so it is unit-testable
/// without a Tauri runtime.
fn take_startup_file(state: &file_ops::AppState) -> Option<String> {
    let path = STARTUP_FILE
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .take()?;

    file_ops::grant_path_read(state, std::path::Path::new(&path));
    Some(path)
}

use tauri::menu::{
    AboutMetadata, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder,
};

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
        .manage(file_ops::AppState::default())
        // Authorize renderer reads of dropped paths from the trusted side,
        // then hand the paths to the frontend ourselves.
        //
        // Tauri also emits its own drag-drop event to the webview, but it
        // does so *before* running these listeners, so a frontend that acted
        // on that event would race the grant. Emitting `files-dropped` after
        // the grants are recorded removes the race: by the time the frontend
        // sees this event, every path in it is already authorized. The
        // frontend uses Tauri's native event only for the drag-hover
        // highlight, never to trigger a read.
        .on_webview_event(|webview, event| {
            let WebviewEvent::DragDrop(DragDropEvent::Drop { paths, .. }) = event else {
                return;
            };

            // Only the first openable path is granted. The frontend opens one
            // file per drop, so granting the rest would leave authorizations
            // outstanding for files nobody is going to read — each one a live
            // capability sitting in the grant list until its TTL expires.
            // Classification happens here, on the trusted side, using the same
            // extension helpers the read commands enforce.
            let openable = paths
                .iter()
                .find(|p| file_ops::has_bshot_extension(p) || file_ops::is_supported_image(p));

            let state = webview.state::<file_ops::AppState>();
            let payload: FilesDropped = match openable {
                Some(path) if file_ops::grant_path_read(&state, path) => FilesDropped {
                    path: Some(path.to_string_lossy().into_owned()),
                    ignored: paths.len().saturating_sub(1),
                    unsupported: false,
                },
                // Something was dropped, but nothing the app can open.
                _ => FilesDropped {
                    path: None,
                    ignored: 0,
                    unsupported: true,
                },
            };

            // emit_to, not emit: Emitter::emit broadcasts to every webview,
            // and capabilities/default.json lets the region-overlay window
            // listen. Granted filesystem paths have no business reaching a
            // second surface.
            let _ = webview.emit_to("main", "files-dropped", payload);
        })
        .setup(|app| {
            // Create system tray
            tray::create_tray(app.handle())?;

            // Application menu. The File submenu is the only way to reach
            // Open / Export / Close / Delete, so it is built on every desktop
            // platform — gating it to macOS left Windows and Linux with no way
            // to open a project at all, which also made the .bshot file
            // association there useless. The macOS-specific app submenu (About
            // / Hide / Cmd+Q-to-tray) stays gated below.
            {
                let handle = app.handle();

                // Create "Hide" menu item with Cmd+Q shortcut (replaces default Quit)
                #[cfg(target_os = "macos")]
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
                #[cfg(target_os = "macos")]
                let app_submenu = SubmenuBuilder::new(handle, "beautiFULLshot")
                    .item(&PredefinedMenuItem::about(
                        handle,
                        Some("About beautiFULLshot"),
                        Some(about_metadata.clone()),
                    )?)
                    .separator()
                    .item(&hide_item)
                    .separator()
                    .item(&PredefinedMenuItem::hide(handle, Some("Hide"))?)
                    .item(&PredefinedMenuItem::hide_others(
                        handle,
                        Some("Hide Others"),
                    )?)
                    .item(&PredefinedMenuItem::show_all(handle, Some("Show All"))?)
                    .build()?;

                // Create File submenu
                let file_open = MenuItemBuilder::with_id("file_open", "Open...")
                    .accelerator("CmdOrCtrl+O")
                    .build(handle)?;
                // No accelerator here: Save is handled entirely in the frontend
                // (use-keyboard-shortcuts.ts) so it honors the user's configured
                // hotkey identically on macOS/Windows/Linux and never double-fires
                // against a native accelerator. Clicking the menu item still works.
                let file_save = MenuItemBuilder::with_id("file_save", "Save").build(handle)?;
                let file_export = MenuItemBuilder::with_id("file_export", "Export...")
                    .accelerator("CmdOrCtrl+Shift+E")
                    .build(handle)?;
                let file_close =
                    MenuItemBuilder::with_id("file_close", "Close Project").build(handle)?;
                let file_delete =
                    MenuItemBuilder::with_id("file_delete", "Delete Project").build(handle)?;

                let file_builder = SubmenuBuilder::new(handle, "File")
                    .item(&file_open)
                    .item(&file_save)
                    .item(&file_export)
                    .separator()
                    .item(&file_close)
                    .item(&file_delete);

                // On Windows/Linux there is no app submenu, so File carries
                // the app-level items that live under the application menu on
                // macOS.
                #[cfg(not(target_os = "macos"))]
                let file_builder = file_builder
                    .separator()
                    .item(&PredefinedMenuItem::about(
                        handle,
                        Some("About beautiFULLshot"),
                        Some(about_metadata),
                    )?)
                    .item(&MenuItemBuilder::with_id("hide_to_tray", "Hide to Tray").build(handle)?)
                    .item(&PredefinedMenuItem::quit(handle, Some("Quit"))?);

                let file_submenu = file_builder.build()?;

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
                let menu_builder = MenuBuilder::new(handle);

                #[cfg(target_os = "macos")]
                let menu_builder = menu_builder.item(&app_submenu);

                let menu = menu_builder
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
                            #[cfg(target_os = "macos")]
                            let _ = handle_clone
                                .set_activation_policy(tauri::ActivationPolicy::Accessory);
                        }
                        // File menu events — forward to frontend. Scoped to the
                        // main window: the region-overlay webview is allowed to
                        // listen, and a broadcast Save would fire there too.
                        "file_open" | "file_save" | "file_export" | "file_close"
                        | "file_delete" => {
                            let frontend_event = format!("menu-{}", event_id.replace('_', "-"));
                            let _ = handle_clone.emit_to("main", &frontend_event, ());
                        }
                        _ => {}
                    }
                });
            }

            // Note: Overlay window is created on-demand when needed
            // to avoid fullscreen white screen at startup

            // Check CLI arguments for a .bshot file path (Windows / Linux
            // file-association launch, or manual `beautyfullshot file.bshot`).
            // On macOS, fresh-launch file-open events arrive via RunEvent::Opened
            // below instead of as CLI args.
            // Only the first .bshot argument is honored, since STARTUP_FILE
            // holds one path. No grant is issued here — get_startup_file()
            // issues it when the frontend actually takes the path, so a
            // launch that never reaches the editor strands nothing.
            if let Some(arg) = std::env::args()
                .skip(1)
                .map(std::path::PathBuf::from)
                .find(|p| is_bshot_file(p))
            {
                store_startup_file(&arg);
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                // Intercept close request on main window - hide instead of quit
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

                // On macOS, the window can be re-shown from several places
                // (global capture hotkeys, the region-overlay flow, tray/dock)
                // via plain window.show()/setFocus() calls from the frontend,
                // none of which restore ActivationPolicy::Regular. Leaving the
                // app in Accessory mode while its window is frontmost causes
                // the native app menu (File/Edit/Window) to become unresponsive
                // to clicks. Self-heal centrally whenever the main window
                // regains focus, instead of relying on every show-path to
                // remember to restore the policy.
                #[cfg(target_os = "macos")]
                if let WindowEvent::Focused(true) = event {
                    let app = window.app_handle();
                    let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
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
            file_ops::write_project,
            file_ops::delete_file,
            file_ops::pick_and_open,
            file_ops::read_dropped_project,
            file_ops::read_dropped_image,
            file_ops::clear_active_project,
            file_ops::set_active_project,
            file_ops::revoke_path_grants,
            get_startup_file,
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

                // Handle macOS file-open Apple Event (triggered when a .bshot
                // file is double-clicked, dragged onto the dock icon, or
                // opened with "Open With"). Fires for both a fresh launch and
                // an already-running instance.
                //
                // The variant itself is macOS/iOS/Android-only in tauri, so
                // this arm must be cfg-gated like its neighbours — without the
                // gate the Linux and Windows builds fail to compile.
                #[cfg(target_os = "macos")]
                RunEvent::Opened { urls } => {
                    // Selecting several files in Finder delivers them all, but
                    // the app opens one document at a time, so take the first
                    // openable one and ignore the rest.
                    let first = urls
                        .iter()
                        .filter(|url| url.scheme() == "file")
                        .filter_map(|url| url.to_file_path().ok())
                        .find(|path| is_bshot_file(path));

                    if let Some(path) = first {
                        // The two delivery routes are mutually exclusive.
                        //
                        // Window up: emit straight to the frontend and grant
                        // the read here, because the frontend acts on the
                        // event without going through get_startup_file(). Do
                        // NOT also stash the path — it would linger in
                        // STARTUP_FILE and get opened a second time by the
                        // next get_startup_file() call.
                        //
                        // No window yet (fresh launch): stash it only. The
                        // grant is issued when the frontend takes the path,
                        // so a launch that stalls on the permissions screen
                        // leaves no unredeemed authorization behind.
                        match _app.get_webview_window("main") {
                            Some(window) => {
                                file_ops::grant_path_read(
                                    &_app.state::<file_ops::AppState>(),
                                    &path,
                                );

                                // The app may be sitting as a tray icon
                                // (ActivationPolicy::Accessory, window hidden).
                                // Bring it back before delivering the event.
                                let _ = _app
                                    .set_activation_policy(tauri::ActivationPolicy::Regular);
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                                let _ = window.emit_to(
                                    "main",
                                    "file-open-requested",
                                    path.to_string_lossy().into_owned(),
                                );
                            }
                            None => {
                                store_startup_file(&path);
                            }
                        }
                    }
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_bshot(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("bshot_lib_{}_{}", label, nanos));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("project.bshot");
        std::fs::write(&path, b"x").unwrap();
        path
    }

    /// These share the STARTUP_FILE global, so they run under one #[test] to
    /// keep the harness's thread pool from interleaving them.
    #[test]
    fn startup_file_lifecycle() {
        let path = temp_bshot("lifecycle");

        // Storing does not grant. A launch that never reaches the editor
        // (blocked on the permissions screen, say) must leave no outstanding
        // authorization behind — that was the whole reason the grant moved
        // out of the launch path.
        assert!(store_startup_file(&path));
        let state = file_ops::AppState::default();
        assert_eq!(
            file_ops::pending_grant_count(&state),
            0,
            "storing a startup file must not issue a grant"
        );

        // Taking it hands over the path and issues the grant together, so
        // there is no window in which one exists without the other.
        let taken = take_startup_file(&state);
        assert_eq!(taken.as_deref(), Some(path.to_string_lossy().as_ref()));
        assert_eq!(file_ops::pending_grant_count(&state), 1);

        // Consumed exactly once: a second caller cannot re-take the path and
        // mint a second grant for it.
        assert_eq!(take_startup_file(&state), None);
        assert_eq!(file_ops::pending_grant_count(&state), 1);

        std::fs::remove_dir_all(path.parent().unwrap()).ok();
    }

    #[test]
    fn store_startup_file_rejects_non_projects() {
        let dir = std::env::temp_dir().join(format!(
            "bshot_lib_reject_{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();

        let image = dir.join("photo.png");
        std::fs::write(&image, b"x").unwrap();
        assert!(!store_startup_file(&image));

        assert!(!store_startup_file(&dir.join("missing.bshot")));

        // A directory named like a project is not a file.
        let dir_like = dir.join("folder.bshot");
        std::fs::create_dir_all(&dir_like).unwrap();
        assert!(!store_startup_file(&dir_like));

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn bshot_extension_matching_is_case_insensitive() {
        // Regression: `ends_with(".bshot")` meant double-clicking
        // Project.BSHOT on APFS/NTFS silently did nothing at all.
        let dir = std::env::temp_dir().join(format!(
            "bshot_lib_case_{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();

        let upper = dir.join("Project.BSHOT");
        std::fs::write(&upper, b"x").unwrap();
        assert!(is_bshot_file(&upper));

        std::fs::remove_dir_all(&dir).ok();
    }
}
