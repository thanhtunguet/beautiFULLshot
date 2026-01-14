/**
 * Detects the current OS
 */
export function getOS(): 'macos' | 'windows' | 'linux' | 'unknown' {
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (userAgent.includes('mac')) return 'macos';
    if (userAgent.includes('win')) return 'windows';
    if (userAgent.includes('linux')) return 'linux';
    return 'unknown';
}

/**
 * Formats a hotkey string for display
 * replaces long modifier names with short ones or symbols based on OS
 */
export function formatHotkey(hotkey: string): string {
    if (!hotkey) return '';

    const os = getOS();

    let formatted = hotkey
        // Normalize logic operators
        .replace('CommandOrControl', os === 'macos' ? 'Cmd' : 'Ctrl')
        .replace('CmdOrCtrl', os === 'macos' ? 'Cmd' : 'Ctrl')
        .replace('Command', 'Cmd')
        .replace('Control', 'Ctrl')
        .replace('Option', os === 'macos' ? 'Opt' : 'Alt')
        .replace('Alt', os === 'macos' ? 'Opt' : 'Alt')
        .replace('Shift', 'Shift')
        .replace('Super', 'Cmd')
        .replace('Meta', 'Cmd');

    // Ensure uppercase keys
    const parts = formatted.split('+');
    if (parts.length > 0) {
        const lastPart = parts.pop();
        if (lastPart) {
            parts.push(lastPart.toUpperCase());
        }
        formatted = parts.join('+');
    }

    return formatted;
}
