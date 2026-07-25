// File API - TypeScript wrappers for Tauri file operations

import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import type { ProjectLoadResult, ProjectSaveData } from '../types/project';
import type { ExportFormat } from '../stores/export-store';

/**
 * Normalize Windows extended-length path prefix (\\?\)
 * Windows dialog can return paths like \\?\C:\Users\... which need cleanup for display
 */
export function normalizePath(path: string): string {
  // Remove Windows extended-length path prefix
  if (path.startsWith('\\\\?\\')) {
    return path.slice(4);
  }
  return path;
}

/**
 * Extract filename from path (cross-platform)
 */
export function extractFilename(path: string): string {
  // Normalize first to handle \\?\ prefix
  const normalized = normalizePath(path);
  // Handle both Windows (\) and Unix (/) separators
  const parts = normalized.split(/[\\/]/);
  return parts[parts.length - 1] || 'image';
}

/**
 * Save file using Tauri backend
 */
export async function saveFile(
  path: string,
  data: Uint8Array
): Promise<string> {
  return await invoke('save_file', {
    path,
    data: Array.from(data),
  });
}

/**
 * Get (and create if needed) the beautiFULLshot project directory.
 * Returns ~/Pictures/beautiFULLshot on all platforms.
 */
export async function getProjectDir(): Promise<string> {
  return await invoke<string>('get_project_dir');
}

/**
 * Show native save dialog for image export
 * Defaults to the beautiFULLshot project directory
 */
export async function showSaveDialog(
  defaultName: string,
  format: ExportFormat
): Promise<string | null> {
  const filters =
    format === 'png'
      ? [{ name: 'PNG Image', extensions: ['png'] }]
      : [{ name: 'JPEG Image', extensions: ['jpg', 'jpeg'] }];

  const projectDir = await getProjectDir();
  const path = await save({
    defaultPath: `${projectDir}/${defaultName}`,
    filters,
  });

  return path;
}

/**
 * Write a .bshot project file (ZIP archive), atomically.
 * Serializes metadata, screenshot bytes, and (if present) a custom
 * background image into a ZIP via Rust.
 */
export async function writeProject(
  path: string,
  data: ProjectSaveData
): Promise<string> {
  return await invoke<string>('write_project', {
    path,
    metadata: data.metadata,
    screenshotBytes: data.screenshotBytes,
    backgroundImageBytes: data.backgroundImageBytes ?? null,
  });
}

/**
 * Delete a file from disk.
 * Rust restricts this to the currently-open `.bshot` project path — it is
 * not a general-purpose delete primitive.
 * @param moveToTrash — if true, use system trash; otherwise permanent delete
 */
export async function deleteFile(
  path: string,
  moveToTrash: boolean
): Promise<void> {
  await invoke('delete_file', { path, moveToTrash });
}

/** Tagged result of the native Open dialog (project, image, or cancelled). */
export type OpenPickResult =
  | { kind: 'project'; path: string; data: ProjectLoadResult }
  | { kind: 'image'; path: string; bytes: number[] }
  | { kind: 'cancelled' };

/**
 * Show the native "Open" dialog (accepts both .bshot projects and image
 * files) and read the selected file — entirely on the Rust side. No path
 * is ever passed from the renderer for this flow.
 */
export async function pickAndOpen(): Promise<OpenPickResult> {
  return await invoke<OpenPickResult>('pick_and_open');
}

/**
 * Read a `.bshot` project dropped onto the window. The path comes from the
 * OS drag-drop session (see editor-layout.tsx); Rust still validates
 * extension/canonicalizes/bounds the read before trusting it.
 */
export async function readDroppedProject(path: string): Promise<ProjectLoadResult> {
  return await invoke<ProjectLoadResult>('read_dropped_project', { path });
}

/**
 * Read an image dropped onto the window (see readDroppedProject).
 */
export async function readDroppedImage(path: string): Promise<Uint8Array> {
  const bytes: number[] = await invoke<number[]>('read_dropped_image', { path });
  return new Uint8Array(bytes);
}

/**
 * Retrieve a .bshot file path that was passed to the app at launch via OS
 * file association (double-click, Open With, CLI argument). Returns null if
 * no startup file is pending. Consumes the value — a second call returns null.
 */
export async function getStartupFile(): Promise<string | null> {
  return await invoke<string | null>('get_startup_file');
}

/**
 * Tell the backend no project is open anymore, so `delete_file` (which only
 * trusts the tracked active project path) can no longer act on the
 * previously-open project's file.
 */
export async function clearActiveProject(): Promise<void> {
  await invoke('clear_active_project');
}
