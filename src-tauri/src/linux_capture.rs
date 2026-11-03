// Linux screen capture backends
// X11 is handled by xcap; this module covers Wayland (where each desktop exposes a
// different API) plus CLI fallbacks for X11. Backends are tried in a desktop-specific
// order and every failure is reported, instead of only the last one.
//
//   GNOME & most desktops : xdg-desktop-portal Screenshot -> gnome-screenshot -> ...
//   KDE Plasma            : spectacle -> portal
//   wlroots (Sway etc.)   : grim -> portal (caller then tries xcap's wlr-screencopy)
//
// Portal and tools are never assumed present: a missing backend is skipped.

use image::RgbaImage;
use std::collections::HashMap;
use std::ffi::OsString;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

use crate::linux_env::{install_hint, Desktop, LinuxEnv, SessionType};

/// Long enough for the user to answer the first-run permission dialog
const PORTAL_TIMEOUT: Duration = Duration::from_secs(30);
const TOOL_TIMEOUT: Duration = Duration::from_secs(20);
const PROBE_TIMEOUT: Duration = Duration::from_secs(3);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Backend {
    Portal,
    GnomeScreenshot,
    Spectacle,
    Grim,
    Xfce4Screenshooter,
    Maim,
    Scrot,
    ImageMagick,
}

impl Backend {
    /// Executable name, or None for the D-Bus portal
    fn program(self) -> Option<&'static str> {
        match self {
            Backend::Portal => None,
            Backend::GnomeScreenshot => Some("gnome-screenshot"),
            Backend::Spectacle => Some("spectacle"),
            Backend::Grim => Some("grim"),
            Backend::Xfce4Screenshooter => Some("xfce4-screenshooter"),
            Backend::Maim => Some("maim"),
            Backend::Scrot => Some("scrot"),
            Backend::ImageMagick => Some("import"),
        }
    }

    fn label(self) -> &'static str {
        self.program().unwrap_or("xdg-desktop-portal")
    }

    /// Arguments that make the tool write a full-desktop PNG to `out`
    fn args(self, out: &Path) -> Vec<OsString> {
        let out = out.as_os_str().to_owned();
        let flags: &[&str] = match self {
            Backend::Portal | Backend::Grim | Backend::Maim | Backend::Scrot => &[],
            Backend::GnomeScreenshot => &["-f"],
            Backend::Spectacle => &["-b", "-n", "-f", "-o"],
            Backend::Xfce4Screenshooter => &["-f", "-s"],
            Backend::ImageMagick => &["-window", "root"],
        };
        flags.iter().map(OsString::from).chain([out]).collect()
    }
}

/// Backends to try for a whole-desktop capture, best first.
/// Wayland needs compositor-specific APIs; on X11 these are only fallbacks for xcap.
pub fn backend_order(env: &LinuxEnv) -> Vec<Backend> {
    use Backend::*;
    let (preferred, rest): (&[Backend], &[Backend]) = if env.session == SessionType::Wayland {
        let preferred: &[Backend] = match env.desktop {
            Desktop::Kde => &[Spectacle, Portal],
            Desktop::Wlroots => &[Grim, Portal],
            Desktop::Gnome => &[Portal, GnomeScreenshot],
            _ => &[Portal],
        };
        (preferred, &[Portal, GnomeScreenshot, Spectacle, Grim])
    } else {
        let preferred: &[Backend] = match env.desktop {
            Desktop::Gnome | Desktop::Budgie | Desktop::Cinnamon | Desktop::Mate => {
                &[GnomeScreenshot]
            }
            Desktop::Kde => &[Spectacle],
            Desktop::Xfce => &[Xfce4Screenshooter],
            _ => &[],
        };
        (
            preferred,
            &[Maim, Scrot, ImageMagick, GnomeScreenshot, Spectacle, Xfce4Screenshooter],
        )
    };

    let mut order = preferred.to_vec();
    for backend in rest {
        if !order.contains(backend) {
            order.push(*backend);
        }
    }
    order
}

enum AttemptError {
    NotInstalled,
    Failed(String),
}

/// Capture the whole desktop (all monitors) with the first backend that works
pub fn capture_desktop(env: &LinuxEnv) -> Result<RgbaImage, String> {
    let mut failures: Vec<String> = Vec::new();
    let mut missing: Vec<&str> = Vec::new();

    for backend in backend_order(env) {
        match run_backend(backend) {
            Ok(image) => return Ok(image),
            Err(AttemptError::NotInstalled) => missing.push(backend.label()),
            Err(AttemptError::Failed(reason)) => {
                eprintln!("[capture] {} failed: {}", backend.label(), reason);
                failures.push(format!("{}: {}", backend.label(), reason));
            }
        }
    }

    Err(failure_message(env, &failures, &missing))
}

fn failure_message(env: &LinuxEnv, failures: &[String], missing: &[&str]) -> String {
    let mut message = format!("Screen capture failed ({}).", env.describe());
    if !failures.is_empty() {
        message.push_str(&format!(" {}.", failures.join("; ")));
    }
    if !missing.is_empty() {
        message.push_str(&format!(" Not installed: {}.", missing.join(", ")));
    }
    message.push(' ');
    message.push_str(&recommendation(env));
    message
}

/// Packages that make capture work for this desktop, formatted for the distro
pub fn recommendation(env: &LinuxEnv) -> String {
    let packages: &[&str] = if env.session == SessionType::Wayland {
        match env.desktop {
            Desktop::Kde => &["spectacle", "xdg-desktop-portal-kde"],
            Desktop::Wlroots => &["grim"],
            Desktop::Gnome => &["xdg-desktop-portal-gnome", "gnome-screenshot"],
            _ => &["xdg-desktop-portal", "grim"],
        }
    } else {
        &["maim"]
    };
    format!(
        "Install with: {}",
        install_hint(env.distro.package_manager(), packages)
    )
}

/// Whether xcap's own Wayland capture (wlr-screencopy) is worth trying after the chain.
/// GNOME and KDE never implement that protocol, so retrying there only repeats the portal.
pub fn xcap_wayland_fallback_useful(env: &LinuxEnv) -> bool {
    !matches!(env.desktop, Desktop::Gnome | Desktop::Kde)
}

/// Warning for the UI when this Wayland session has no usable capture backend
pub fn diagnose(env: &LinuxEnv) -> Option<String> {
    if env.session != SessionType::Wayland {
        return None;
    }
    // xcap's built-in wlr-screencopy needs no helper tool
    if env.desktop == Desktop::Wlroots {
        return None;
    }
    let usable = backend_order(env).into_iter().any(|backend| match backend.program() {
        Some(program) => find_in_path(program).is_some(),
        None => portal_available(),
    });
    if usable {
        return None;
    }
    Some(format!(
        "No screenshot backend found for {}. {}",
        env.describe(),
        recommendation(env)
    ))
}

// ---------------------------------------------------------------------------
// CLI tools
// ---------------------------------------------------------------------------

fn run_backend(backend: Backend) -> Result<RgbaImage, AttemptError> {
    let Some(program) = backend.program() else {
        return capture_portal();
    };

    let file = TempFile::new();
    run_tool(program, &backend.args(&file.path))?;
    read_png(&file.path)
}

fn run_tool(program: &str, args: &[OsString]) -> Result<(), AttemptError> {
    let mut child = Command::new(program)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| match e.kind() {
            std::io::ErrorKind::NotFound => AttemptError::NotInstalled,
            _ => AttemptError::Failed(format!("cannot start: {}", e)),
        })?;

    let mut stderr = child.stderr.take();
    let reader = thread::spawn(move || {
        let mut text = String::new();
        if let Some(pipe) = stderr.as_mut() {
            let _ = pipe.read_to_string(&mut text);
        }
        text
    });

    let deadline = Instant::now() + TOOL_TIMEOUT;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if Instant::now() >= deadline => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(AttemptError::Failed("timed out".to_string()));
            }
            Ok(None) => thread::sleep(Duration::from_millis(25)),
            Err(e) => return Err(AttemptError::Failed(e.to_string())),
        }
    };

    if status.success() {
        return Ok(());
    }
    let stderr = reader.join().unwrap_or_default();
    let stderr = stderr.trim();
    Err(AttemptError::Failed(if stderr.is_empty() {
        format!("exited with {}", status)
    } else {
        stderr.lines().next().unwrap_or(stderr).to_string()
    }))
}

fn read_png(path: &Path) -> Result<RgbaImage, AttemptError> {
    let image = image::open(path)
        .map_err(|e| AttemptError::Failed(format!("no usable image written: {}", e)))?
        .to_rgba8();
    if image.width() == 0 || image.height() == 0 {
        return Err(AttemptError::Failed("empty image".to_string()));
    }
    Ok(image)
}

fn find_in_path(program: &str) -> Option<PathBuf> {
    use std::os::unix::fs::PermissionsExt;
    std::env::var_os("PATH").and_then(|paths| {
        std::env::split_paths(&paths)
            .map(|dir| dir.join(program))
            .find(|candidate| {
                candidate
                    .metadata()
                    .map(|m| m.is_file() && m.permissions().mode() & 0o111 != 0)
                    .unwrap_or(false)
            })
    })
}

/// Output file that is deleted on drop. Lives in XDG_RUNTIME_DIR (private to the user)
/// when available so the name cannot be pre-created by another local user.
struct TempFile {
    path: PathBuf,
}

impl TempFile {
    fn new() -> Self {
        let dir = std::env::var_os("XDG_RUNTIME_DIR")
            .map(PathBuf::from)
            .filter(|dir| dir.is_dir())
            .unwrap_or_else(std::env::temp_dir);
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        Self {
            path: dir.join(format!("beautyfullshot-{}-{}.png", std::process::id(), nanos)),
        }
    }
}

impl Drop for TempFile {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
    }
}

// ---------------------------------------------------------------------------
// xdg-desktop-portal (org.freedesktop.portal.Screenshot)
// ---------------------------------------------------------------------------

const PORTAL_DEST: &str = "org.freedesktop.portal.Desktop";
const PORTAL_PATH: &str = "/org/freedesktop/portal/desktop";
const SCREENSHOT_IFACE: &str = "org.freedesktop.portal.Screenshot";

fn within_timeout<T: Send + 'static>(
    timeout: Duration,
    timeout_message: &str,
    work: impl FnOnce() -> Result<T, AttemptError> + Send + 'static,
) -> Result<T, AttemptError> {
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let _ = tx.send(work());
    });
    rx.recv_timeout(timeout)
        .unwrap_or_else(|_| Err(AttemptError::Failed(timeout_message.to_string())))
}

fn capture_portal() -> Result<RgbaImage, AttemptError> {
    within_timeout(
        PORTAL_TIMEOUT,
        "timed out waiting for the screenshot portal (permission dialog left open?)",
        portal_screenshot,
    )
}

/// Whether the portal service is running (or activatable) and offers Screenshot
fn portal_available() -> bool {
    within_timeout(PROBE_TIMEOUT, "timed out", || {
        let conn = zbus::blocking::Connection::session()
            .map_err(|e| AttemptError::Failed(e.to_string()))?;
        conn.call_method(
            Some(PORTAL_DEST),
            PORTAL_PATH,
            Some("org.freedesktop.DBus.Properties"),
            "Get",
            &(SCREENSHOT_IFACE, "version"),
        )
        .map(|_| ())
        .map_err(|e| AttemptError::Failed(e.to_string()))
    })
    .is_ok()
}

/// Non-interactive screenshot through the portal.
/// The portal asks the user for permission on first use and remembers the answer
/// in its permission store (table "screenshot").
fn portal_screenshot() -> Result<RgbaImage, AttemptError> {
    use zbus::blocking::{Connection, Proxy};
    use zbus::zvariant::{OwnedValue, Value};

    let failed = |what: &str, e: zbus::Error| AttemptError::Failed(format!("{}: {}", what, e));

    let conn = Connection::session().map_err(|e| failed("no D-Bus session bus", e))?;
    let portal = Proxy::new(&conn, PORTAL_DEST, PORTAL_PATH, SCREENSHOT_IFACE)
        .map_err(|e| failed("portal unavailable", e))?;

    // The Response signal arrives on a request object whose path is derived from our
    // bus name and handle_token, so subscribe before calling to avoid a missed signal.
    let unique_name = conn
        .unique_name()
        .ok_or_else(|| AttemptError::Failed("no D-Bus unique name".to_string()))?;
    let sender = unique_name.as_str().trim_start_matches(':').replace('.', "_");
    let token = format!(
        "beautyfullshot{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    );
    let request_path = format!("/org/freedesktop/portal/desktop/request/{}/{}", sender, token);
    let request = Proxy::new(
        &conn,
        PORTAL_DEST,
        request_path,
        "org.freedesktop.portal.Request",
    )
    .map_err(|e| failed("portal request", e))?;
    let mut responses = request
        .receive_signal("Response")
        .map_err(|e| failed("portal request", e))?;

    let mut options: HashMap<&str, Value> = HashMap::new();
    options.insert("handle_token", Value::from(token.as_str()));
    options.insert("interactive", Value::from(false));
    let _handle: zbus::zvariant::OwnedObjectPath = portal
        .call("Screenshot", &("", options))
        .map_err(|e| failed("portal refused the request", e))?;

    let message = responses
        .next()
        .ok_or_else(|| AttemptError::Failed("portal closed without a response".to_string()))?;
    let (code, mut results): (u32, HashMap<String, OwnedValue>) = message
        .body()
        .deserialize()
        .map_err(|e| failed("unreadable portal response", e.into()))?;

    match code {
        0 => {}
        1 => {
            return Err(AttemptError::Failed(
                "denied or cancelled. If screenshots were denied earlier, reset the saved \
                 answer: gdbus call --session --dest org.freedesktop.impl.portal.PermissionStore \
                 --object-path /org/freedesktop/impl/portal/PermissionStore \
                 --method org.freedesktop.impl.portal.PermissionStore.Delete screenshot screenshot"
                    .to_string(),
            ))
        }
        other => {
            return Err(AttemptError::Failed(format!(
                "portal returned error code {}",
                other
            )))
        }
    }

    let uri = results
        .remove("uri")
        .and_then(|value| String::try_from(value).ok())
        .ok_or_else(|| AttemptError::Failed("portal response has no uri".to_string()))?;
    let path = PathBuf::from(file_uri_to_path(&uri).ok_or_else(|| {
        AttemptError::Failed(format!("unsupported screenshot location: {}", uri))
    })?);

    // The portal saves the file for us; read it and clean up like any other temp output
    let image = read_png(&path);
    let _ = std::fs::remove_file(&path);
    image
}

/// file:///home/me/My%20Pictures/a.png -> /home/me/My Pictures/a.png
fn file_uri_to_path(uri: &str) -> Option<String> {
    let encoded = uri.strip_prefix("file://")?;
    let bytes = encoded.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).ok()?;
            decoded.push(u8::from_str_radix(hex, 16).ok()?);
            i += 3;
        } else {
            decoded.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(decoded).ok()
}

// ---------------------------------------------------------------------------
// Monitor cropping
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// Cut one monitor out of a whole-desktop capture.
/// Monitor rects come from X11/XWayland and may be in logical or physical units while the
/// capture is in physical pixels, so positions are scaled by the capture-to-layout ratio.
pub fn crop_monitor(desktop: RgbaImage, monitor: Rect, all: &[Rect]) -> RgbaImage {
    if all.len() <= 1 {
        return desktop;
    }
    let min_x = all.iter().map(|r| r.x).min().unwrap_or(0);
    let min_y = all.iter().map(|r| r.y).min().unwrap_or(0);
    let max_x = all.iter().map(|r| r.x + r.width as i32).max().unwrap_or(0);
    let max_y = all.iter().map(|r| r.y + r.height as i32).max().unwrap_or(0);
    let layout_w = (max_x - min_x) as f64;
    let layout_h = (max_y - min_y) as f64;
    if layout_w <= 0.0 || layout_h <= 0.0 {
        return desktop;
    }

    let scale_x = desktop.width() as f64 / layout_w;
    let scale_y = desktop.height() as f64 / layout_h;
    let x = (((monitor.x - min_x) as f64 * scale_x).round().max(0.0) as u32).min(desktop.width());
    let y = (((monitor.y - min_y) as f64 * scale_y).round().max(0.0) as u32).min(desktop.height());
    let width = ((monitor.width as f64 * scale_x).round() as u32).min(desktop.width() - x);
    let height = ((monitor.height as f64 * scale_y).round() as u32).min(desktop.height() - y);
    if width == 0 || height == 0 {
        return desktop;
    }
    image::imageops::crop_imm(&desktop, x, y, width, height).to_image()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::linux_env::{parse_os_release, Distro};

    fn env(session: SessionType, desktop: Desktop) -> LinuxEnv {
        LinuxEnv {
            session,
            desktop,
            distro: Distro::default(),
        }
    }

    #[test]
    fn gnome_wayland_prefers_portal_then_gnome_screenshot() {
        let order = backend_order(&env(SessionType::Wayland, Desktop::Gnome));
        assert_eq!(order[..2], [Backend::Portal, Backend::GnomeScreenshot]);
    }

    #[test]
    fn kde_wayland_prefers_spectacle() {
        let order = backend_order(&env(SessionType::Wayland, Desktop::Kde));
        assert_eq!(order[..2], [Backend::Spectacle, Backend::Portal]);
    }

    #[test]
    fn wlroots_prefers_grim() {
        let order = backend_order(&env(SessionType::Wayland, Desktop::Wlroots));
        assert_eq!(order[0], Backend::Grim);
    }

    #[test]
    fn unknown_wayland_desktop_still_tries_portal_first() {
        let order = backend_order(&env(SessionType::Wayland, Desktop::Other));
        assert_eq!(order[0], Backend::Portal);
    }

    #[test]
    fn x11_fallbacks_never_include_wayland_only_backends() {
        for desktop in [Desktop::Xfce, Desktop::Gnome, Desktop::Kde, Desktop::Cinnamon] {
            let order = backend_order(&env(SessionType::X11, desktop));
            assert!(!order.contains(&Backend::Portal));
            assert!(!order.contains(&Backend::Grim));
        }
        let xfce = backend_order(&env(SessionType::X11, Desktop::Xfce));
        assert_eq!(xfce[0], Backend::Xfce4Screenshooter);
    }

    #[test]
    fn backend_order_has_no_duplicates() {
        for session in [SessionType::Wayland, SessionType::X11] {
            for desktop in [Desktop::Gnome, Desktop::Kde, Desktop::Xfce, Desktop::Wlroots] {
                let order = backend_order(&env(session, desktop));
                for (i, b) in order.iter().enumerate() {
                    assert!(!order[i + 1..].contains(b));
                }
            }
        }
    }

    #[test]
    fn xcap_fallback_skipped_on_compositors_without_wlr_screencopy() {
        assert!(!xcap_wayland_fallback_useful(&env(SessionType::Wayland, Desktop::Gnome)));
        assert!(!xcap_wayland_fallback_useful(&env(SessionType::Wayland, Desktop::Kde)));
        assert!(xcap_wayland_fallback_useful(&env(SessionType::Wayland, Desktop::Wlroots)));
        assert!(xcap_wayland_fallback_useful(&env(SessionType::Wayland, Desktop::Lxqt)));
    }

    #[test]
    fn recommendation_uses_distro_package_manager() {
        let mut e = env(SessionType::Wayland, Desktop::Gnome);
        e.distro = parse_os_release("ID=ubuntu\nID_LIKE=debian\n");
        assert!(recommendation(&e).contains("sudo apt install xdg-desktop-portal-gnome"));
        e.distro = parse_os_release("ID=arch\n");
        assert!(recommendation(&e).contains("sudo pacman -S xdg-desktop-portal-gnome"));
        e.distro = parse_os_release("ID=nixos\n");
        assert!(recommendation(&e).contains("xdg.portal"));
    }

    #[test]
    fn file_uri_decoding() {
        assert_eq!(
            file_uri_to_path("file:///home/me/My%20Pictures/a.png").as_deref(),
            Some("/home/me/My Pictures/a.png")
        );
        assert_eq!(file_uri_to_path("file:///tmp/a.png").as_deref(), Some("/tmp/a.png"));
        assert_eq!(file_uri_to_path("https://example.com/a.png"), None);
        assert_eq!(file_uri_to_path("file:///tmp/%zz"), None);
    }

    fn solid(width: u32, height: u32) -> RgbaImage {
        RgbaImage::from_pixel(width, height, image::Rgba([1, 2, 3, 255]))
    }

    #[test]
    fn crop_single_monitor_returns_whole_capture() {
        let monitor = Rect { x: 0, y: 0, width: 1920, height: 1080 };
        let out = crop_monitor(solid(1920, 1080), monitor, &[monitor]);
        assert_eq!((out.width(), out.height()), (1920, 1080));
    }

    #[test]
    fn crop_second_monitor_of_side_by_side_layout() {
        let left = Rect { x: 0, y: 0, width: 1920, height: 1080 };
        let right = Rect { x: 1920, y: 0, width: 1280, height: 1024 };
        let out = crop_monitor(solid(3200, 1080), right, &[left, right]);
        assert_eq!((out.width(), out.height()), (1280, 1024));
    }

    #[test]
    fn crop_scales_when_capture_is_hidpi() {
        // Layout reported in logical units, capture in 2x physical pixels
        let left = Rect { x: 0, y: 0, width: 1000, height: 500 };
        let right = Rect { x: 1000, y: 0, width: 1000, height: 500 };
        let out = crop_monitor(solid(4000, 1000), right, &[left, right]);
        assert_eq!((out.width(), out.height()), (2000, 1000));
    }

    #[test]
    fn crop_never_exceeds_the_capture() {
        let left = Rect { x: 0, y: 0, width: 1000, height: 500 };
        let right = Rect { x: 1000, y: 0, width: 1000, height: 500 };
        // Capture smaller than the layout claims: result must stay inside it
        let out = crop_monitor(solid(1500, 500), right, &[left, right]);
        assert!(out.width() <= 1500 && out.height() <= 500);
    }
}
