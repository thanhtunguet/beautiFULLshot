// Linux environment detection: display session, desktop environment and distro
// Decides which screenshot API is usable (X11 vs portal vs wlroots tools)
// Parsers take explicit inputs so they can be unit-tested without a real session

use std::fs;
use std::sync::OnceLock;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionType {
    X11,
    Wayland,
    Unknown,
}

impl SessionType {
    pub fn label(self) -> &'static str {
        match self {
            SessionType::X11 => "X11",
            SessionType::Wayland => "Wayland",
            SessionType::Unknown => "unknown session",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Desktop {
    Gnome,
    Kde,
    Xfce,
    Cinnamon,
    Mate,
    Budgie,
    Lxqt,
    Cosmic,
    Pantheon,
    /// wlroots-based compositors: Sway, Hyprland, river, Wayfire, labwc, niri
    Wlroots,
    Other,
}

impl Desktop {
    pub fn label(self) -> &'static str {
        match self {
            Desktop::Gnome => "GNOME",
            Desktop::Kde => "KDE Plasma",
            Desktop::Xfce => "Xfce",
            Desktop::Cinnamon => "Cinnamon",
            Desktop::Mate => "MATE",
            Desktop::Budgie => "Budgie",
            Desktop::Lxqt => "LXQt",
            Desktop::Cosmic => "COSMIC",
            Desktop::Pantheon => "Pantheon",
            Desktop::Wlroots => "wlroots compositor",
            Desktop::Other => "unknown desktop",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PackageManager {
    Apt,
    Pacman,
    Dnf,
    Zypper,
    Nix,
    Unknown,
}

/// Fields of /etc/os-release that matter for choosing install hints
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Distro {
    pub id: String,
    pub id_like: Vec<String>,
    pub pretty_name: String,
}

impl Distro {
    /// Ubuntu, Xubuntu, Kubuntu, Mint, Debian, Kali -> Apt; Arch -> Pacman; NixOS -> Nix
    pub fn package_manager(&self) -> PackageManager {
        let is = |name: &str| self.id == name || self.id_like.iter().any(|l| l == name);
        if is("nixos") {
            PackageManager::Nix
        } else if is("debian") || is("ubuntu") {
            PackageManager::Apt
        } else if is("arch") {
            PackageManager::Pacman
        } else if is("fedora") || is("rhel") {
            PackageManager::Dnf
        } else if is("opensuse") || is("suse") {
            PackageManager::Zypper
        } else {
            PackageManager::Unknown
        }
    }

    pub fn label(&self) -> &str {
        if self.pretty_name.is_empty() {
            "Linux"
        } else {
            &self.pretty_name
        }
    }
}

#[derive(Debug, Clone)]
pub struct LinuxEnv {
    pub session: SessionType,
    pub desktop: Desktop,
    pub distro: Distro,
}

impl LinuxEnv {
    pub fn describe(&self) -> String {
        format!(
            "{} on {}, {}",
            self.desktop.label(),
            self.session.label(),
            self.distro.label()
        )
    }
}

/// Detected once per process; the session cannot change under a running app
pub fn current() -> &'static LinuxEnv {
    static ENV: OnceLock<LinuxEnv> = OnceLock::new();
    ENV.get_or_init(detect)
}

fn detect() -> LinuxEnv {
    let var = |key: &str| std::env::var(key).ok().filter(|v| !v.is_empty());

    let os_release = fs::read_to_string("/etc/os-release")
        .or_else(|_| fs::read_to_string("/usr/lib/os-release"))
        .unwrap_or_default();

    LinuxEnv {
        session: detect_session(
            var("XDG_SESSION_TYPE").as_deref(),
            var("WAYLAND_DISPLAY").is_some(),
            var("DISPLAY").is_some(),
        ),
        desktop: detect_desktop(
            var("XDG_CURRENT_DESKTOP").as_deref(),
            var("DESKTOP_SESSION").as_deref(),
        ),
        distro: parse_os_release(&os_release),
    }
}

/// XDG_SESSION_TYPE is authoritative when it says x11/wayland; otherwise infer from sockets.
/// Under Wayland, DISPLAY is also set (XWayland), so WAYLAND_DISPLAY must be checked first.
pub fn detect_session(
    xdg_session_type: Option<&str>,
    has_wayland_display: bool,
    has_display: bool,
) -> SessionType {
    match xdg_session_type.map(|s| s.to_ascii_lowercase()).as_deref() {
        Some("wayland") => SessionType::Wayland,
        Some("x11") => SessionType::X11,
        _ if has_wayland_display => SessionType::Wayland,
        _ if has_display => SessionType::X11,
        _ => SessionType::Unknown,
    }
}

/// XDG_CURRENT_DESKTOP is a colon-separated list (e.g. "ubuntu:GNOME", "Budgie:GNOME");
/// the first recognised entry wins. DESKTOP_SESSION is the fallback.
pub fn detect_desktop(xdg_current_desktop: Option<&str>, desktop_session: Option<&str>) -> Desktop {
    if let Some(list) = xdg_current_desktop {
        for token in list.split(':') {
            if let Some(desktop) = desktop_from_token(token) {
                return desktop;
            }
        }
    }
    if let Some(session) = desktop_session {
        if let Some(desktop) = desktop_from_token(session) {
            return desktop;
        }
    }
    Desktop::Other
}

fn desktop_from_token(token: &str) -> Option<Desktop> {
    let token = token.trim().to_ascii_lowercase();
    let token = token.strip_prefix("x-").unwrap_or(&token);
    match token {
        "budgie" | "budgie-desktop" => Some(Desktop::Budgie),
        "gnome" | "gnome-classic" | "gnome-flashback" | "gnome-xorg" | "gnome-wayland"
        | "ubuntu-xorg" | "ubuntu-wayland" | "unity" => Some(Desktop::Gnome),
        "kde" | "plasma" | "plasmawayland" | "plasmax11" => Some(Desktop::Kde),
        "xfce" | "xubuntu" => Some(Desktop::Xfce),
        "cinnamon" => Some(Desktop::Cinnamon),
        "mate" => Some(Desktop::Mate),
        "lxqt" => Some(Desktop::Lxqt),
        "cosmic" => Some(Desktop::Cosmic),
        "pantheon" => Some(Desktop::Pantheon),
        "sway" | "hyprland" | "river" | "wayfire" | "labwc" | "niri" | "wlroots" => {
            Some(Desktop::Wlroots)
        }
        // DESKTOP_SESSION=ubuntu on GNOME-based Ubuntu
        "ubuntu" => Some(Desktop::Gnome),
        _ => None,
    }
}

/// Parse KEY=VALUE lines of os-release(5); values may be single/double quoted
pub fn parse_os_release(content: &str) -> Distro {
    let mut distro = Distro::default();
    for line in content.lines() {
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let value = value.trim().trim_matches(|c| c == '"' || c == '\'');
        match key.trim() {
            "ID" => distro.id = value.to_ascii_lowercase(),
            "ID_LIKE" => {
                distro.id_like = value
                    .split_whitespace()
                    .map(|s| s.to_ascii_lowercase())
                    .collect()
            }
            "PRETTY_NAME" => distro.pretty_name = value.to_string(),
            _ => {}
        }
    }
    distro
}

/// Build a "how to install X" hint using the distro's package manager
pub fn install_hint(pm: PackageManager, packages: &[&str]) -> String {
    let list = packages.join(" ");
    match pm {
        PackageManager::Apt => format!("sudo apt install {}", list),
        PackageManager::Pacman => format!("sudo pacman -S {}", list),
        PackageManager::Dnf => format!("sudo dnf install {}", list),
        PackageManager::Zypper => format!("sudo zypper install {}", list),
        // NixOS has no imperative install; portals must be declared in the system config
        PackageManager::Nix => format!(
            "NixOS: set xdg.portal.enable = true and add the portal backend to \
             xdg.portal.extraPortals, or add {} to environment.systemPackages",
            packages
                .iter()
                .map(|p| format!("pkgs.{}", p))
                .collect::<Vec<_>>()
                .join(", ")
        ),
        PackageManager::Unknown => format!("install: {}", list),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn session_prefers_xdg_session_type() {
        // XWayland sets DISPLAY too, so the explicit type must win
        assert_eq!(detect_session(Some("wayland"), true, true), SessionType::Wayland);
        assert_eq!(detect_session(Some("x11"), true, true), SessionType::X11);
        assert_eq!(detect_session(Some("X11"), false, true), SessionType::X11);
    }

    #[test]
    fn session_falls_back_to_sockets() {
        assert_eq!(detect_session(None, true, true), SessionType::Wayland);
        assert_eq!(detect_session(Some("tty"), false, true), SessionType::X11);
        assert_eq!(detect_session(None, false, false), SessionType::Unknown);
    }

    #[test]
    fn desktop_from_xdg_current_desktop() {
        assert_eq!(detect_desktop(Some("ubuntu:GNOME"), None), Desktop::Gnome);
        assert_eq!(detect_desktop(Some("GNOME"), None), Desktop::Gnome);
        assert_eq!(detect_desktop(Some("KDE"), None), Desktop::Kde);
        assert_eq!(detect_desktop(Some("XFCE"), None), Desktop::Xfce);
        assert_eq!(detect_desktop(Some("X-Cinnamon"), None), Desktop::Cinnamon);
        assert_eq!(detect_desktop(Some("MATE"), None), Desktop::Mate);
        assert_eq!(detect_desktop(Some("LXQt"), None), Desktop::Lxqt);
        assert_eq!(detect_desktop(Some("Hyprland"), None), Desktop::Wlroots);
        assert_eq!(detect_desktop(Some("sway"), None), Desktop::Wlroots);
        assert_eq!(detect_desktop(Some("COSMIC"), None), Desktop::Cosmic);
        assert_eq!(detect_desktop(Some("pop:GNOME"), None), Desktop::Gnome);
    }

    #[test]
    fn budgie_wins_over_its_gnome_suffix() {
        assert_eq!(detect_desktop(Some("Budgie:GNOME"), None), Desktop::Budgie);
    }

    #[test]
    fn desktop_falls_back_to_desktop_session() {
        assert_eq!(detect_desktop(None, Some("plasma")), Desktop::Kde);
        assert_eq!(detect_desktop(Some(""), Some("xfce")), Desktop::Xfce);
        assert_eq!(detect_desktop(Some("i3"), Some("i3")), Desktop::Other);
        assert_eq!(detect_desktop(None, None), Desktop::Other);
    }

    const UBUNTU: &str = "PRETTY_NAME=\"Ubuntu 24.04.1 LTS\"\nNAME=\"Ubuntu\"\nID=ubuntu\nID_LIKE=debian\n";
    const MINT: &str = "NAME=\"Linux Mint\"\nID=linuxmint\nID_LIKE=\"ubuntu debian\"\nPRETTY_NAME=\"Linux Mint 22\"\n";
    const KALI: &str = "PRETTY_NAME=\"Kali GNU/Linux Rolling\"\nID=kali\nID_LIKE=debian\n";
    const DEBIAN: &str = "PRETTY_NAME=\"Debian GNU/Linux 12 (bookworm)\"\nID=debian\n";
    const ARCH: &str = "NAME=\"Arch Linux\"\nPRETTY_NAME=\"Arch Linux\"\nID=arch\n";
    const NIXOS: &str = "ID=nixos\nPRETTY_NAME=\"NixOS 24.11 (Vicuna)\"\nID_LIKE=\n";

    #[test]
    fn package_manager_for_supported_distros() {
        for (os_release, expected) in [
            (UBUNTU, PackageManager::Apt),
            (MINT, PackageManager::Apt),
            (KALI, PackageManager::Apt),
            (DEBIAN, PackageManager::Apt),
            (ARCH, PackageManager::Pacman),
            (NIXOS, PackageManager::Nix),
            ("", PackageManager::Unknown),
        ] {
            assert_eq!(parse_os_release(os_release).package_manager(), expected);
        }
    }

    #[test]
    fn os_release_parsing_handles_quotes_and_empty_values() {
        let d = parse_os_release(MINT);
        assert_eq!(d.id, "linuxmint");
        assert_eq!(d.id_like, vec!["ubuntu", "debian"]);
        assert_eq!(d.pretty_name, "Linux Mint 22");
        assert!(parse_os_release(NIXOS).id_like.is_empty());
    }

    #[test]
    fn install_hint_matches_package_manager() {
        assert_eq!(
            install_hint(PackageManager::Apt, &["grim"]),
            "sudo apt install grim"
        );
        assert_eq!(
            install_hint(PackageManager::Pacman, &["grim", "slurp"]),
            "sudo pacman -S grim slurp"
        );
        assert!(install_hint(PackageManager::Nix, &["grim"]).contains("pkgs.grim"));
    }
}
