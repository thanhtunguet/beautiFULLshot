// File API - TypeScript wrappers for Tauri file operations

import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import type { ExportFormat } from '../stores/export-store';
import type { ProjectLoadResult, ProjectSaveData } from '../types/project';

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
 * Get Pictures directory with BeautyShot subfolder
 */
export async function getPicturesDir(): Promise<string> {
  return await invoke('get_pictures_dir');
}

/**
 * Get Desktop directory
 */
export async function getDesktopDir(): Promise<string> {
  return await invoke('get_desktop_dir');
}

/**
 * Show native save dialog
 */
export async function showSaveDialog(
  defaultName: string,
  format: ExportFormat
): Promise<string | null> {
  const filters =
    format === 'png'
      ? [{ name: 'PNG Image', extensions: ['png'] }]
      : [{ name: 'JPEG Image', extensions: ['jpg', 'jpeg'] }];

  const path = await save({
    defaultPath: defaultName,
    filters,
  });

  return path;
}

/**
 * Read a .bshot project file (ZIP archive)
 * Returns metadata and raw screenshot bytes from the Rust backend
 */
export async function readProject(path: string): Promise<ProjectLoadResult> {
  return await invoke<ProjectLoadResult>('read_project', { path });
}

/**
 * Write a .bshot project file (ZIP archive)
 * Serializes metadata and screenshot bytes into a ZIP via Rust
 */
export async function writeProject(
  path: string,
  data: ProjectSaveData
): Promise<string> {
  return await invoke<string>('write_project', { path, data });
}

/**
 * Delete a file from disk
 * @param moveToTrash — if true, use system trash; otherwise permanent delete
 */
export async function deleteFile(
  path: string,
  moveToTrash: boolean
): Promise<void> {
  await invoke('delete_file', { path, moveToTrash });
}

/**
 * Show native open file dialog filtered to .bshot project files
 * Returns the selected file path, or null if cancelled
 */
export async function showOpenDialog(): Promise<string | null> {
  const selected = await open({
    filters: [{ name: 'beautiFULLshot Project', extensions: ['bshot'] }],
    multiple: false,
  });

  return selected as string | null;
}
